import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.10.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const PLATFORM_FEE_PERCENT = 0.10; // 10% default
const PRO_FEE_PERCENT = 0.05; // 5% for pro

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { trainerId, monthlyRate } = body;

    if (!trainerId) {
      return Response.json({ error: 'Missing trainerId' }, { status: 400 });
    }

    const trainer = await base44.asServiceRole.entities.TrainerProfile.get(
      trainerId
    );

    if (!trainer || !trainer.stripe_account_id) {
      return Response.json({ error: 'Trainer not found' }, { status: 404 });
    }

    // Create Stripe customer if not exists
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
        name: user.full_name
      });
      customerId = customer.id;
    }

    // Create product if not exists for this trainer
    const productName = `${trainer.display_name} - Monthly Coaching`;
    let product;

    const existingProducts = await stripe.products.search({
      query: `name:"${productName}"`
    });

    if (existingProducts.data[0]) {
      product = existingProducts.data[0];
    } else {
      product = await stripe.products.create({
        name: productName,
        type: 'service'
      });
    }

    // Create or get price
    const existingPrices = await stripe.prices.search({
      query: `product:"${product.id}" AND active:"true"`
    });

    let price;
    if (
      existingPrices.data[0] &&
      existingPrices.data[0].unit_amount === monthlyRate
    ) {
      price = existingPrices.data[0];
    } else {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: monthlyRate,
        currency: 'gbp',
        recurring: {
          interval: 'month'
        }
      });
    }

    // Calculate platform fee
    const feePercent = trainer.is_pro ? PRO_FEE_PERCENT : PLATFORM_FEE_PERCENT;
    const platformFeeAmount = Math.round(monthlyRate * feePercent);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: price.id,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/app/onboarding/payment?success=true&trainerId=${trainerId}`,
      cancel_url: `${req.headers.get('origin')}/app/onboarding/payment?cancelled=true`,
      subscription_data: {
        transfer_data: {
          destination: trainer.stripe_account_id
        },
        application_fee_percent: feePercent * 100
      }
    });

    return Response.json({
      sessionId: session.id,
      clientSecret: session.client_secret
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});