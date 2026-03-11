import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.10.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const DEFAULT_FEE_PERCENT = 0.10; // 10%
const PRO_FEE_PERCENT = 0.03; // 3%
const PRO_PLAN_COST = 6900; // £69 in pence

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.user_type !== 'trainer') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get trainer profile
    const trainers = await base44.entities.TrainerProfile.filter({ user_id: user.id });
    const trainer = trainers[0];

    if (!trainer) {
      return Response.json({ error: 'Trainer not found' }, { status: 404 });
    }

    // Get all active paying clients
    const clients = await base44.asServiceRole.entities.ClientProfile.filter({
      trainer_id: trainer.id,
      subscription_status: 'active'
    });

    // Get clients with payment issues
    const pastDueClients = await base44.asServiceRole.entities.ClientProfile.filter({
      trainer_id: trainer.id,
      subscription_status: 'past_due'
    });

    // Calculate monthly revenue
    let monthlyRevenue = 0;
    const activePayingClients = clients.length;

    for (const client of clients) {
      if (client.stripe_subscription_id) {
        try {
          const subscription = await stripe.subscriptions.retrieve(client.stripe_subscription_id);
          if (subscription.items?.data[0]?.price?.unit_amount) {
            monthlyRevenue += subscription.items.data[0].price.unit_amount;
          }
        } catch (error) {
          console.error('Error fetching subscription:', error);
        }
      }
    }

    // Calculate platform fees
    const feePercent = trainer.is_pro ? PRO_FEE_PERCENT : DEFAULT_FEE_PERCENT;
    const platformFees = Math.round(monthlyRevenue * feePercent);
    const netEarnings = monthlyRevenue - platformFees - (trainer.is_pro ? PRO_PLAN_COST : 0);

    // Calculate savings if upgrading to Pro
    const defaultFees = Math.round(monthlyRevenue * DEFAULT_FEE_PERCENT);
    const proFees = Math.round(monthlyRevenue * PRO_FEE_PERCENT);
    const upgradeSavings = defaultFees - proFees - PRO_PLAN_COST;

    // Get upcoming payouts from Stripe
    let upcomingPayouts = [];
    if (trainer.stripe_account_id) {
      try {
        const payouts = await stripe.payouts.list(
          { limit: 3 },
          { stripeAccount: trainer.stripe_account_id }
        );
        upcomingPayouts = payouts.data.map(p => ({
          amount: p.amount,
          arrival_date: p.arrival_date,
          status: p.status
        }));
      } catch (error) {
        console.error('Error fetching payouts:', error);
      }
    }

    // Get failed payments with client details
    const failedPayments = [];
    for (const client of pastDueClients) {
      const users = await base44.asServiceRole.entities.User.filter({ id: client.user_id });
      if (users[0]) {
        failedPayments.push({
          clientId: client.id,
          clientName: users[0].full_name,
          clientEmail: users[0].email
        });
      }
    }

    // Calculate break-even point
    const monthlyRevenueToBreakEven = PRO_PLAN_COST / (DEFAULT_FEE_PERCENT - PRO_FEE_PERCENT);
    const distanceToBreakEven = monthlyRevenueToBreakEven - monthlyRevenue;

    return Response.json({
      stripeConnected: !!trainer.stripe_account_id,
      currentPlan: trainer.is_pro ? 'pro' : 'default',
      feePercent: feePercent * 100,
      monthlyRevenue,
      platformFees,
      netEarnings,
      proPlanCost: trainer.is_pro ? PRO_PLAN_COST : 0,
      activePayingClients,
      failedPayments,
      upcomingPayouts,
      upgradeSavings: upgradeSavings > 0 ? upgradeSavings : 0,
      distanceToBreakEven: distanceToBreakEven > 0 ? distanceToBreakEven : 0,
      shouldUpgrade: upgradeSavings > 0
    });
  } catch (error) {
    console.error('Error getting trainer earnings:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});