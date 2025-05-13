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

    const { leadId, useBonusLead = false } = JSON.parse(event.body);
    if (!leadId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Lead ID is required' })
      };
    }

    const { pool } = getDb();

    // Check if lead exists and is not claimed
    const leadResult = await pool.query(
      'SELECT * FROM care_requests WHERE id = $1 AND claimed_by IS NULL',
      [leadId]
    );

    const lead = leadResult.rows[0];
    if (!lead) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Lead not found or already claimed' })
      };
    }

    // Get user data
    const userResult = await pool.query(
      'SELECT id, bonus_leads_available, subscription_level, leads_available FROM users WHERE id = $1',
      [user.id]
    );

    if (userResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const userData = userResult.rows[0];

    // 🔹 Subscription lead available
    if (userData.subscription_level !== 'free' && userData.leads_available > 0) {
      await pool.query(
        'UPDATE users SET leads_available = leads_available - 1 WHERE id = $1',
        [user.id]
      );
      await pool.query(
        'UPDATE care_requests SET status = $1, claimed_by = $2 WHERE id = $3',
        ['claimed', user.id, leadId]
      );
      await pool.query(
        `INSERT INTO lead_purchases (user_id, lead_id, amount, purchased_at)
         VALUES ($1, $2, 0, NOW())`,
        [user.id, leadId]
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Lead claimed using subscription',
          leadId,
          paymentRequired: false,
          leadType: 'subscription',
          remainingLeads: userData.leads_available - 1
        })
      };
    }

    // 🔹 Bonus lead available
    if (useBonusLead && userData.bonus_leads_available > 0) {
      await pool.query(
        'UPDATE users SET bonus_leads_available = bonus_leads_available - 1 WHERE id = $1',
        [user.id]
      );
      await pool.query(
        'UPDATE care_requests SET status = $1, claimed_by = $2 WHERE id = $3',
        ['claimed', user.id, leadId]
      );
      await pool.query(
        `INSERT INTO lead_purchases (user_id, lead_id, amount, purchased_at)
         VALUES ($1, $2, 0, NOW())`,
        [user.id, leadId]
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Lead claimed using bonus lead',
          leadId,
          paymentRequired: false,
          leadType: 'bonus',
          remainingBonusLeads: userData.bonus_leads_available - 1
        })
      };
    }

    // 🔹 No free/bonus — use Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5000,
      currency: 'usd',
      customer: user.stripeCustomerId || undefined,
      metadata: {
        leadId: leadId.toString(),
        userId: user.id.toString()
      },
      description: `Lead purchase: ${lead.patient_name}`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret,
        leadId,
        amount: 5000,
        paymentRequired: true,
        leadType: 'paid'
      })
    };
  } catch (error) {
    console.error('Purchase lead error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process lead purchase',
        message: error.message
      })
    };
  }
};
