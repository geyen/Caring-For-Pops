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

    // Get user info
    const userResult = await pool.query(
      `SELECT id, username, subscription_level, 
              COALESCE(leads_available, 0) AS leads_available, 
              COALESCE(bonus_leads_available, 0) AS bonus_leads_available
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

    // Get filter values from query
    const params = event.queryStringParameters || {};
    const zip = params.zip;
    const careType = params.careType;

    // Dynamic filter building
    const filterConditions = [`status = 'new'`];
    const filterValues = [];

    if (zip) {
      filterConditions.push(`zip_code = $${filterValues.length + 1}`);
      filterValues.push(zip);
    }

    if (careType) {
      filterConditions.push(`care_type = $${filterValues.length + 1}`);
      filterValues.push(careType);
    }

    const filterClause = filterConditions.length ? `WHERE ${filterConditions.join(' AND ')}` : '';

    const leadsQuery = `
      SELECT id, patient_name, contact_name, email, phone_number, 
             address, city, state, zip_code, care_type, care_details, care_hours, 
             urgency, created_at
      FROM care_requests
      ${filterClause}
      ORDER BY 
        CASE 
          WHEN urgency = 'immediate' THEN 1
          WHEN urgency = 'within_week' THEN 2
          WHEN urgency = 'within_month' THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT 10
    `;

    const leadsResult = await pool.query(leadsQuery, filterValues);

    const referralsResult = await pool.query(
      `SELECT 
        COUNT(*) AS total_referrals,
        COUNT(CASE WHEN status IN ('qualified', 'completed') THEN 1 END) AS qualified_referrals,
        COUNT(CASE WHEN bonus_awarded = TRUE THEN 1 END) AS successful_referrals
       FROM referrals
       WHERE referrer_id = $1`,
      [user.id]
    );

    const referrals = referralsResult.rows[0] || {
      total_referrals: 0,
      qualified_referrals: 0,
      successful_referrals: 0
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: {
          id: userData.id,
          username: userData.username,
          subscriptionLevel: userData.subscription_level,
          leadsAvailable: parseInt(userData.leads_available),
          bonusLeadsAvailable: parseInt(userData.bonus_leads_available),
          totalLeadsAvailable:
            parseInt(userData.leads_available) + parseInt(userData.bonus_leads_available)
        },
        availableLeads: leadsResult.rows,
        referrals: {
          total: parseInt(referrals.total_referrals),
          qualified: parseInt(referrals.qualified_referrals),
          successful: parseInt(referrals.successful_referrals)
        }
      })
    };
  } catch (error) {
    console.error('Error fetching leads:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to load dashboard',
        message: error.message
      })
    };
  }
};
