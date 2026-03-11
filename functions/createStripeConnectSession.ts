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

    const trainer = await base44.entities.TrainerProfile.filter({
      user_id: user.id
    });

    if (!trainer[0]) {
      return Response.json({ error: 'Trainer profile not found' }, { status: 404 });
    }

    // Create or fetch Stripe Connect account
    let accountId = trainer[0].stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: user.email,
        business_profile: {
          name: trainer[0].display_name,
          url: 'https://motion.fitness'
        }
      });
      accountId = account.id;

      // Update trainer profile
      await base44.entities.TrainerProfile.update(trainer[0].id, {
        stripe_account_id: accountId
      });
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: `${req.headers.get('origin')}/app/trainer/onboarding?success=true`,
      refresh_url: `${req.headers.get('origin')}/app/trainer/onboarding`
    });

    return Response.json({ url: accountLink.url });
  } catch (error) {
    console.error('Error creating Stripe Connect session:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});