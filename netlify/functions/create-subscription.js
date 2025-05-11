// Function to create a subscription
const { getUserFromRequest } = require('./utils/auth');
const { getDb } = require('./utils/db');
const Stripe = require('stripe');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Get user from request
    const user = await getUserFromRequest(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    // Parse request body
    const { planId } = JSON.parse(event.body);
    if (!planId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plan ID is required' })
      };
    }

    const { db, pool } = getDb();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    try {
      // Get the subscription plan
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

      // Ensure user has a Stripe customer ID
      let { stripeCustomerId } = user;
      
      if (!stripeCustomerId) {
        // Create a new Stripe customer
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName || user.username,
          metadata: {
            userId: user.id.toString()
          }
        });
        
        stripeCustomerId = customer.id;
        
        // Update user with Stripe customer ID
        await pool.query(
          'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
          [stripeCustomerId, user.id]
        );
      }

      // Create or get Stripe price ID for this plan
      // In a real-world scenario, you would create products and prices in Stripe Dashboard
      // and store their IDs in your database. For simplicity, we're creating them on the fly.
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

      // Create subscription
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

      // Update user's subscription level
      await pool.query(
        'UPDATE users SET subscription_level = $1, stripe_subscription_id = $2 WHERE id = $3',
        [plan.name, subscription.id, user.id]
      );

      // Return client secret for payment processing
      return {
        statusCode: 200,
        body: JSON.stringify({
          subscriptionId: subscription.id,
          clientSecret: subscription.latest_invoice.payment_intent.client_secret
        })
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Create subscription error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to create subscription',
        message: error.message
      })
    };
  }
};
