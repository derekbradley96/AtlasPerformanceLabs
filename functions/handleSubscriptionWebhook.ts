import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.10.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  try {
    // Construct event with signature verification
    const sig = req.headers.get('stripe-signature');
    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Handle Pro plan subscription (trainer)
    if (event.type === 'customer.subscription.created' || 
        event.type === 'customer.subscription.updated') {
      
      const subscription = event.data.object;
      
      // Check if this is a Pro plan subscription (has trainer_id in metadata)
      if (subscription.metadata?.trainer_id) {
        const trainerId = subscription.metadata.trainer_id;
        const isPro = subscription.status === 'active';
        
        await base44.asServiceRole.entities.TrainerProfile.update(trainerId, {
          is_pro: isPro,
          pro_subscription_id: subscription.id
        });
        
        return Response.json({ received: true });
      }

      // Handle client subscriptions
      const customer = subscription.customer;

      // Get customer from Stripe to find email
      const stripeCustomer = await stripe.customers.retrieve(customer);

      // Find client by customer email
      const clients = await base44.asServiceRole.entities.ClientProfile.filter({
        stripe_customer_id: customer
      });

      if (clients[0]) {
        // Update subscription status
        await base44.asServiceRole.entities.ClientProfile.update(clients[0].id, {
          subscription_status: subscription.status === 'active' ? 'active' : 'pending',
          stripe_subscription_id: subscription.id
        });
      } else if (subscription.status === 'active') {
        // Create new client profile if not exists
        const users = await base44.asServiceRole.entities.User.filter({
          email: stripeCustomer.email
        });

        if (users[0] && subscription.transfer_data?.destination) {
          // Find trainer by Stripe account ID
          const trainers = await base44.asServiceRole.entities.TrainerProfile.filter({
            stripe_account_id: subscription.transfer_data.destination
          });

          if (trainers[0]) {
            await base44.asServiceRole.entities.ClientProfile.create({
              user_id: users[0].id,
              trainer_id: trainers[0].id,
              stripe_customer_id: customer,
              stripe_subscription_id: subscription.id,
              subscription_status: 'active'
            });
          }
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      
      // Check if this is a Pro plan cancellation
      if (subscription.metadata?.trainer_id) {
        await base44.asServiceRole.entities.TrainerProfile.update(subscription.metadata.trainer_id, {
          is_pro: false,
          pro_subscription_id: null
        });
        return Response.json({ received: true });
      }
      
      // Handle client subscription cancellation
      const customers = await base44.asServiceRole.entities.ClientProfile.filter({
        stripe_subscription_id: subscription.id
      });

      if (customers[0]) {
        await base44.asServiceRole.entities.ClientProfile.update(customers[0].id, {
          subscription_status: 'cancelled'
        });
      }
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      
      // Mark client as past_due
      const customers = await base44.asServiceRole.entities.ClientProfile.filter({
        stripe_subscription_id: invoice.subscription
      });

      if (customers[0]) {
        await base44.asServiceRole.entities.ClientProfile.update(customers[0].id, {
          subscription_status: 'past_due'
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});