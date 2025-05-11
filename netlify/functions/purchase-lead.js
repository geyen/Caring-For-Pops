// Function for purchasing individual leads
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
    const { leadId, useBonusLead = false } = JSON.parse(event.body);
    if (!leadId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Lead ID is required' })
      };
    }

    // Initialize database and Stripe
    const { db, pool } = getDb();
    
    try {
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
      
      // Get latest user data for available leads
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
      
      // Check if using a subscription lead
      if (userData.subscription_level !== 'free' && userData.leads_available > 0) {
        // User has subscription leads available
        await pool.query(
          'UPDATE users SET leads_available = leads_available - 1 WHERE id = $1',
          [user.id]
        );
        
        // Mark lead as claimed
        await pool.query(
          'UPDATE care_requests SET status = $1, claimed_by = $2 WHERE id = $3',
          ['claimed', user.id, leadId]
        );
        
        // Record the lead purchase
        await pool.query(
          `INSERT INTO lead_purchases 
          (user_id, lead_id, amount, purchased_at)
          VALUES ($1, $2, 0, NOW())`,
          [user.id, leadId]
        );
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Lead claimed using subscription',
            leadId: leadId,
            paymentRequired: false,
            leadType: 'subscription',
            remainingLeads: userData.leads_available - 1
          })
        };
      } 
      // Check if using a bonus lead
      else if (useBonusLead && userData.bonus_leads_available > 0) {
        // User wants to use a bonus lead and has them available
        await pool.query(
          'UPDATE users SET bonus_leads_available = bonus_leads_available - 1 WHERE id = $1',
          [user.id]
        );
        
        // Mark lead as claimed
        await pool.query(
          'UPDATE care_requests SET status = $1, claimed_by = $2 WHERE id = $3',
          ['claimed', user.id, leadId]
        );
        
        // Record the lead purchase
        await pool.query(
          `INSERT INTO lead_purchases 
          (user_id, lead_id, amount, purchased_at)
          VALUES ($1, $2, 0, NOW())`,
          [user.id, leadId]
        );
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Lead claimed using bonus lead',
            leadId: leadId,
            paymentRequired: false,
            leadType: 'bonus',
            remainingBonusLeads: userData.bonus_leads_available - 1
          })
        };
      } 
      else {
        // No subscription or bonus leads available, create a payment
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        
        // Create payment intent for $50 per lead
        const paymentIntent = await stripe.paymentIntents.create({
          amount: 5000, // $50.00 in cents
          currency: 'usd',
          customer: user.stripeCustomerId || undefined,
          metadata: {
            leadId: leadId.toString(),
            userId: user.id.toString()
          },
          description: `Lead purchase: ${lead.patient_name}`
        });

        // Return client secret for completing payment on the client
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            clientSecret: paymentIntent.client_secret,
            leadId: leadId,
            amount: 5000,
            paymentRequired: true,
            leadType: 'paid'
          })
        };
      }
    } finally {
      await pool.end();
    }
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
