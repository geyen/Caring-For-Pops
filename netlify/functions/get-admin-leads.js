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
    SELECT cr.*, u.full_name AS claimed_by_name
    FROM care_requests cr
    LEFT JOIN users u ON cr.claimed_by = u.id
    ORDER BY cr.created_at DESC
    LIMIT 100
  `);

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows),
  };
};
