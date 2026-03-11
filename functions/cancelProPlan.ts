import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.10.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.user_type !== 'trainer') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trainers = await base44.entities.TrainerProfile.filter({ user_id: user.id });
    const trainer = trainers[0];

    if (!trainer || !trainer.pro_subscription_id) {
      return Response.json({ error: 'No active Pro subscription' }, { status: 404 });
    }

    // Cancel at period end (not immediately)
    await stripe.subscriptions.update(trainer.pro_subscription_id, {
      cancel_at_period_end: true
    });

    return Response.json({
      message: 'Pro plan will be cancelled at the end of the billing period'
    });
  } catch (error) {
    console.error('Error cancelling Pro plan:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});