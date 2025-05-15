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

    // Get user and their zip code
    const userResult = await pool.query(
      `SELECT id, username, zip_code, subscription_level,
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
    const userZip = userData.zip_code || '55401';

    // Hardcoded nearby ZIPs for MN metro area
    const nearbyZipMap = {
      "55401": ["55401", "55402", "55403", "55404", "55405", "55406", "55407", "55408", "55409", "55410", "55411", "55412", "55413", "55414", "55415", "55416", "55417", "55418", "55419"],
      "55420": ["55420", "55421", "55422", "55423", "55424", "55425", "55426", "55427", "55428", "55429", "55430", "55431", "55432", "55433", "55434", "55435", "55436", "55437", "55438", "55439"],
      "55343": ["55343", "55344", "55345", "55346", "55347", "55305", "55391"],
      "55311": ["55311", "55369", "55374", "55316", "55340", "55357"],
      "55101": ["55101", "55102", "55103", "55104", "55105", "55106", "55107", "55108", "55109", "55110", "55113", "55114", "55116", "55117", "55118", "55119", "55130"],
      "55044": ["55044", "55024", "55057", "55068", "55070"],
      "55123": ["55123", "55124", "55076", "55077", "55121", "55122"],
      "55303": ["55303", "55304", "55330", "55316", "55327", "55398"]
    };

    const allowedZips = nearbyZipMap[userZip] || [userZip];

    // Get available leads in those zips
    const leadsResult = await pool.query(
      `SELECT id, patient_name, contact_name, email, phone_number,
              address, city, state, zip_code, care_type, care_details, care_hours,
              urgency, created_at
       FROM care_requests
       WHERE status = 'new'
         AND zip_code = ANY($1::text[])
       ORDER BY 
         CASE 
           WHEN urgency = 'immediate' THEN 1
           WHEN urgency = 'within_week' THEN 2
           WHEN urgency = 'within_month' THEN 3
           ELSE 4
         END,
         created_at DESC
       LIMIT 10`,
      [allowedZips]
    );

    // Referral stats
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
          zipCode: userZip,
          subscriptionLevel: userData.subscription_level,
          leadsAvailable: parseInt(userData.leads_available),
          bonusLeadsAvailable: parseInt(userData.bonus_leads_available),
          totalLeadsAvailable: parseInt(userData.leads_available) + parseInt(userData.bonus_leads_available)
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
        error: 'Failed to fetch leads',
        message: error.message
      })
    };
  }
};
