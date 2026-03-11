import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.10.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get client profile
    const clients = await base44.entities.ClientProfile.filter({ user_id: user.id });
    const client = clients[0];

    if (!client || !client.stripe_customer_id) {
      return Response.json({ error: 'No Stripe customer found' }, { status: 404 });
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripe_customer_id,
      return_url: req.headers.get('origin') + '/app/home'
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});