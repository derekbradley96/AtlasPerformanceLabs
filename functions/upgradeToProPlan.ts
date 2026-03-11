import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.10.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const PRO_PLAN_PRICE_ID = Deno.env.get('STRIPE_PRO_PLAN_PRICE_ID');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.user_type !== 'trainer') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trainers = await base44.entities.TrainerProfile.filter({ user_id: user.id });
    const trainer = trainers[0];

    if (!trainer) {
      return Response.json({ error: 'Trainer not found' }, { status: 404 });
    }

    // Create or get Stripe customer
    let customerId;
    const existingCustomers = await stripe.customers.list({
      email: user.email,
      limit: 1
    });

    if (existingCustomers.data[0]) {
      customerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: {
          trainer_id: trainer.id
        }
      });
      customerId = customer.id;
    }

    // Create checkout session for Pro plan
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: PRO_PLAN_PRICE_ID,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}${new URL(req.url).pathname}?success=true`,
      cancel_url: `${req.headers.get('origin')}${new URL(req.url).pathname}?cancelled=true`,
      metadata: {
        trainer_id: trainer.id
      }
    });

    return Response.json({
      sessionUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error creating Pro plan session:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});