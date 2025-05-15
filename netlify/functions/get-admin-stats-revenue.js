const { getDb } = require('../../utils/db');
const { getUserFromRequest } = require('../../utils/auth');

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
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM lead_purchases
    WHERE purchased_at >= NOW() - INTERVAL '30 days'
  `);

  return {
    statusCode: 200,
    body: JSON.stringify({
      monthly: (parseInt(result.rows[0].total) / 100).toFixed(2),
    }),
  };
};
