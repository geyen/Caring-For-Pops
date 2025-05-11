// Function to handle Stripe webhooks
const { getDb } = require('./utils/db');
const Stripe = require('stripe');
const { REFERRAL_RULES } = require('./utils/referral');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = event.headers['stripe-signature'];
  
  // Verify webhook signature
  try {
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET // You'll need to add this to your environment variables
    );

    // Handle the event based on its type
    if (stripeEvent.type === 'payment_intent.succeeded') {
      await handleSuccessfulPayment(stripeEvent.data.object);
    } else if (stripeEvent.type === 'customer.subscription.created' ||
               stripeEvent.type === 'customer.subscription.updated') {
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

// Handle successful payments
async function handleSuccessfulPayment(paymentIntent) {
  // Extract metadata from the payment intent
  const { leadId, userId } = paymentIntent.metadata;
  
  if (!leadId || !userId) {
    console.error('Missing metadata in payment intent');
    return;
  }

  const { db, pool } = getDb();
  
  try {
    // Update the lead to mark it as claimed
    await pool.query(
      'UPDATE care_requests SET claimed_by = $1, status = $2 WHERE id = $3',
      [userId, 'claimed', leadId]
    );

    // Log the purchase
    await pool.query(
      `INSERT INTO lead_purchases 
       (user_id, lead_id, amount, payment_intent_id, purchased_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, leadId, paymentIntent.amount, paymentIntent.id]
    );

    console.log(`Lead ${leadId} successfully claimed by user ${userId}`);
    
    // Check if this payment qualifies for a referral bonus
    await checkAndProcessReferralBonus(userId, paymentIntent.amount);
  } catch (error) {
    console.error('Error updating lead status:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Handle subscription changes
async function handleSubscriptionChange(subscription) {
  const { db, pool } = getDb();
  
  try {
    // Get customer ID from subscription
    const customerId = subscription.customer;
    
    // Find user with this Stripe customer ID
    const userResult = await pool.query(
      'SELECT * FROM users WHERE stripe_customer_id = $1',
      [customerId]
    );
    
    if (userResult.rows.length === 0) {
      console.error(`No user found for Stripe customer ID: ${customerId}`);
      return;
    }
    
    const user = userResult.rows[0];
    
    // Determine subscription level and leads based on the plan
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
    
    // Update user's subscription details
    await pool.query(
      'UPDATE users SET subscription_level = $1, stripe_subscription_id = $2, leads_available = $3 WHERE id = $4',
      [subscriptionLevel, subscription.id, leadsAvailable, user.id]
    );
    
    console.log(`Updated subscription for user ${user.id} to ${subscriptionLevel} with ${leadsAvailable} leads`);
    
    // Check if this subscription purchase qualifies for a referral bonus
    await checkAndProcessReferralBonus(user.id, amount);
  } catch (error) {
    console.error('Error handling subscription change:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Check and process referral bonus if applicable
async function checkAndProcessReferralBonus(userId, amount) {
  const { db, pool } = getDb();
  
  // Only process if amount meets the minimum threshold
  if (amount < REFERRAL_RULES.MINIMUM_PAYMENT_AMOUNT) {
    return;
  }
  
  try {
    // Get user info with referral details
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return;
    }
    
    const user = userResult.rows[0];
    
    // Check if user was referred by someone
    if (!user.referred_by) {
      return;
    }
    
    // Find the referral record
    const referralResult = await pool.query(
      'SELECT * FROM referrals WHERE referrer_id = $1 AND referred_id = $2',
      [user.referred_by, userId]
    );
    
    // If no referral record found, create one
    if (referralResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO referrals 
         (referrer_id, referred_id, status, created_at)
         VALUES ($1, $2, 'pending', NOW())`,
        [user.referred_by, userId]
      );
    } 
    // If already awarded, exit
    else if (referralResult.rows[0].bonus_awarded) {
      return;
    }
    
    // Mark referral as qualified and update status
    await pool.query(
      'UPDATE referrals SET status = $1, qualified_at = NOW() WHERE referrer_id = $2 AND referred_id = $3',
      ['qualified', user.referred_by, userId]
    );
    
    // Award bonus leads to the referrer
    await pool.query(
      'UPDATE users SET bonus_leads_available = bonus_leads_available + $1 WHERE id = $2',
      [REFERRAL_RULES.BONUS_LEADS_FOR_REFERRER, user.referred_by]
    );
    
    // Mark bonus as awarded
    await pool.query(
      'UPDATE referrals SET bonus_awarded = TRUE, bonus_awarded_at = NOW() WHERE referrer_id = $1 AND referred_id = $2',
      [user.referred_by, userId]
    );
    
    console.log(`Awarded ${REFERRAL_RULES.BONUS_LEADS_FOR_REFERRER} bonus leads to user ${user.referred_by} for referral of user ${userId}`);
    
    // In a real implementation, you would send an email notification to the referrer
  } catch (error) {
    console.error('Error processing referral bonus:', error);
  }
}
