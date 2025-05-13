const { getUserFromRequest } = require('./utils/auth');
const { getDb } = require('./utils/db');
const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const user = await getUserFromRequest(event);
    if (!user) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    const { leadId, useBonusLead = false } = JSON.parse(event.body);
    if (!leadId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Lead ID is required' })
      };
    }

    const { pool } = getDb();

    // Check that lead exists and is not already claimed
    const leadResult = await pool.query(
      'SELECT * FROM care_requests WHERE id = $1 AND claimed_by IS NULL',
      [leadId]
    );

    const lead = leadResult.rows[0];
    if (!lead) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Lead not found or already claimed' })
      };
    }

    // Fetch user lead status
    const userResult = await pool.query(
      `SELECT id, bonus_leads_available, subscription_level, leads_available, stripe_customer_id 
       FROM users WHERE id = $1`,
      [user.id]
    );

    const userData = userResult.rows[0];
    if (!userData) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    // 🔹 Use subscription lead
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Lead claimed using subscription',
          leadId,
          leadType: 'subscription',
          paymentRequired: false,
          remainingLeads: userData.leads_available - 1
        })
      };
    }

    // 🔹 Use bonus lead
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Lead claimed using bonus lead',
          leadId,
          leadType: 'bonus',
          paymentRequired: false,
          remainingBonusLeads: userData.bonus_leads_available - 1
        })
      };
    }

    // 🔹 Pay-per-lead via Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5000, // $50.00 in cents
      currency: 'usd',
      customer: userData.stripe_customer_id || undefined,
      metadata: {
        leadId: leadId.toString(),
        userId: user.id.toString()
      },
      description: `Lead purchase: ${lead.patient_name}`
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        leadId,
        leadType: 'paid',
        amount: 5000,
        paymentRequired: true,
        clientSecret: paymentIntent.client_secret
      })
    };
  } catch (error) {
    console.error('Purchase lead error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to process lead purchase',
        message: error.message
      })
    };
  }
};
