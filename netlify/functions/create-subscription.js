const { getUserFromRequest } = require('./utils/auth');
const { getDb } = require('./utils/db');
const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const user = await getUserFromRequest(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    const { planId } = JSON.parse(event.body);
    if (!planId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plan ID is required' })
      };
    }

    const { pool } = getDb();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Get plan details
    const planResult = await pool.query(
      'SELECT * FROM subscription_plans WHERE id = $1',
      [planId]
    );
    const plan = planResult.rows[0];

    if (!plan) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Subscription plan not found' })
      };
    }

    let { stripeCustomerId } = user;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName || user.username,
        metadata: { userId: user.id.toString() }
      });

      stripeCustomerId = customer.id;

      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [stripeCustomerId, user.id]
      );
    }

    const stripePrice = await stripe.prices.create({
      unit_amount: plan.price,
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: {
        name: `Caring for Pops ${plan.name} Plan`,
        description: plan.description
      },
      metadata: {
        planId: plan.id.toString()
      }
    });

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: stripePrice.id }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: user.id.toString(),
        planId: plan.id.toString()
      }
    });

    await pool.query(
      'UPDATE users SET subscription_level = $1, stripe_subscription_id = $2 WHERE id = $3',
      [plan.name, subscription.id, user.id]
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret
      })
    };
  } catch (error) {
    console.error('Create subscription error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to create subscription',
        message: error.message
      })
    };
  }
};
