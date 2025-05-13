const { getUserFromRequest } = require('./utils/auth');
const { getDb } = require('./utils/db');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
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

    const { pool } = getDb();

    // Get latest user data
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

    // Get unclaimed care requests
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

    // Get referral stats
    const referralsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_referrals,
        COUNT(CASE WHEN status = 'qualified' OR status = 'completed' THEN 1 END) as qualified_referrals,
        COUNT(CASE WHEN bonus_awarded = TRUE THEN 1 END) as successful_referrals
      FROM referrals
      WHERE referrer_id = $1_
