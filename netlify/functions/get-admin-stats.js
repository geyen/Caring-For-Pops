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
  const total = await pool.query(`SELECT COUNT(*) FROM care_requests`);
  const claimed = await pool.query(`SELECT COUNT(*) FROM care_requests WHERE status = 'claimed'`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      total: parseInt(total.rows[0].count),
      claimed: parseInt(claimed.rows[0].count),
    }),
  };
};
