// Function to fetch available leads for a user (including bonus leads)
const { getUserFromRequest } = require('./utils/auth');
const { getDb } = require('./utils/db');

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
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

    const { db, pool } = getDb();
    
    try {
      // Get latest user data from database
      const userResult = await pool.query(
        `SELECT id, username, subscription_level, 
        COALESCE(leads_available, 0) as leads_available, 
        COALESCE(bonus_leads_available, 0) as bonus_leads_available
        FROM users WHERE id = $1`,
        [user.id]
      );
      
      if (userResult.rows.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'User not found' })
        };
      }
      
      const userData = userResult.rows[0];
      
      // Get list of care requests that are available (not claimed)
      const leadsResult = await pool.query(
        `SELECT id, patient_name, contact_name, email, phone_number, 
        address, city, state, zip_code, care_type, care_details, care_hours, 
        urgency, created_at
        FROM care_requests
        WHERE status = 'new'
        ORDER BY 
          CASE WHEN urgency = 'immediate' THEN 1
               WHEN urgency = 'within_week' THEN 2
               WHEN urgency = 'within_month' THEN 3
               ELSE 4
          END,
          created_at DESC
        LIMIT 10`
      );
      
      // Get count of referrals made by this user
      const referralsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_referrals,
          COUNT(CASE WHEN status = 'qualified' OR status = 'completed' THEN 1 END) as qualified_referrals,
          COUNT(CASE WHEN bonus_awarded = TRUE THEN 1 END) as successful_referrals
        FROM referrals
        WHERE referrer_id = $1`,
        [user.id]
      );
      
      const referralsStats = referralsResult.rows[0] || {
        total_referrals: 0,
        qualified_referrals: 0,
        successful_referrals: 0
      };
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          user: {
            id: userData.id,
            username: userData.username,
            subscriptionLevel: userData.subscription_level,
            leadsAvailable: parseInt(userData.leads_available),
            bonusLeadsAvailable: parseInt(userData.bonus_leads_available),
            totalLeadsAvailable: parseInt(userData.leads_available) + parseInt(userData.bonus_leads_available)
          },
          availableLeads: leadsResult.rows,
          referrals: {
            total: parseInt(referralsStats.total_referrals),
            qualified: parseInt(referralsStats.qualified_referrals),
            successful: parseInt(referralsStats.successful_referrals)
          }
        })
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Error getting available leads:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to get available leads',
        message: error.message
      })
    };
  }
};
