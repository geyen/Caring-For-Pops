const { getDb } = require('../utils/db');
const { getUserFromRequest } = require('../utils/auth');

exports.handler = async (event) => {
  const user = await getUserFromRequest(event);
  if (!user || !user.is_admin) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Admin access required' }),
    };
  }

  const { pool } = getDb();

  const result = await pool.query(`
    SELECT 
      u.id, u.full_name, u.company_name, u.email, u.phone_number,
      u.subscription_level, u.created_at,
      COUNT(lp.id) AS leads_claimed
    FROM users u
    LEFT JOIN lead_purchases lp ON lp.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT 100
  `);

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows),
  };
};
