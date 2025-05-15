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
  const result = await pool.query(`SELECT COUNT(*) FROM users WHERE is_admin = false`);
  return {
    statusCode: 200,
    body: JSON.stringify({ total: parseInt(result.rows[0].count) }),
  };
};
