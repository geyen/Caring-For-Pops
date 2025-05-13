const { getDb } = require('./utils/db');
const Stripe = require('stripe');
const { REFERRAL_RULES } = require('./utils/referral');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = event.headers['stripe-signature'];

  try {
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === 'payment_intent.succeeded') {
      await handleSuccessfulPayment(stripeEvent.data.object);
    } else if (
      stripeEvent.type === 'customer.subscription.created' ||
      stripeEvent.type === 'customer.subscription.updated'
    ) {
      await handleSubscriptionChange(stripeEvent.data.object);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error('Webhook error:', error.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function handleSuccessfulPayment(paymentIntent) {
  const { leadId, userId } = paymentIntent.metadata;

  if (!leadId || !userId) {
    console.error('Missing metadata in payment intent');
    return;
  }

  const { pool } = getDb();

  try {
    await pool.query(
      'UPDATE care_requests SET claimed_by = $1, status = $2 WHERE id = $3',
      [userId, 'claimed', leadId]
    );

    await pool.query(
      `INSERT INTO lead_purchases 
       (user_id, lead_id, amount, payment_intent_id, purchased_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, leadId, paymentIntent.amount, paymentIntent.id]
    );

    console.log(`Lead ${leadId} successfully claimed by user ${userId}`);
    await checkAndProcessReferralBonus(userId, paymentIntent.amount);
  } catch (error) {
    console.error('Error updating lead status:', error);
    throw error;
  }
}

async function handleSubscriptionChange(subscription) {
  const { pool } = getDb();
  const customerId = subscription.customer;

  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE stripe_customer_id = $1',
      [customerId]
    );

    if (userResult.rows.length === 0) {
      console.error(`No user found for Stripe customer ID: ${customerId}`);
      return;
    }

    const user = userResult.rows[0];
    const amount = subscription.plan.amount;
    let subscriptionLevel = 'free';
    let leadsAvailable = 0;

    if (amount >= 60000) {
      subscriptionLevel = 'elite';
      leadsAvailable = 30;
    } else if (amount >= 48000) {
      subscriptionLevel = 'growth';
      leadsAvailable = 20;
    } else if (amount >= 30000) {
      subscriptionLevel = 'basic';
      leadsAvailable = 10;
    }

    await pool.query(
      'UPDATE users SET subscription_level = $1, stripe_subscription_id = $2, leads_available = $3 WHERE id = $4',
      [subscriptionLevel, subscription.id, leadsAvailable, user.id]
    );

    console.log(`Updated subscription for user ${user.id} to ${subscriptionLevel}`);
    await checkAndProcessReferralBonus(user.id, amount);
  } catch (error) {
    console.error('Error handling subscription change:', error);
    throw error;
  }
}

async function checkAndProcessReferralBonus(userId, amount) {
  if (amount < REFERRAL_RULES.MINIMUM_PAYMENT_AMOUNT) return;

  const { pool } = getDb();

  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];
    if (!user.referred_by) return;

    const referralResult = await pool.query(
      'SELECT * FROM referrals WHERE referrer_id = $1 AND referred_id = $2',
      [user.referred_by, userId]
    );

    if (referralResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO referrals (referrer_id, referred_id, status, created_at)
         VALUES ($1, $2, 'pending', NOW())`,
        [user.referred_by, userId]
      );
    } else if (referralResult.rows[0].bonus_awarded) {
      return;
    }

    await pool.query(
      'UPDATE referrals SET status = $1, qualified_at = NOW() WHERE referrer_id = $2 AND referred_id = $3',
      ['qualified', user.referred_by, userId]
    );

    await pool.query(
      'UPDATE users SET bonus_leads_available = bonus_leads_available + $1 WHERE id = $2',
      [REFERRAL_RULES.BONUS_LEADS_FOR_REFERRER, user.referred_by]
    );

    await pool.query(
      'UPDATE referrals SET bonus_awarded = TRUE, bonus_awarded_at = NOW() WHERE referrer_id = $1 AND referred_id = $2',
      [user.referred_by, userId]
    );

    console.log(`Referral bonus awarded to user ${user.referred_by}`);
  } catch (error) {
    console.error('Error processing referral bonus:', error);
  }
}
