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

    const result = await pool.query(
      `SELECT cr.*, lp.purchased_at
       FROM care_requests cr
       JOIN lead_purchases lp ON lp.lead_id = cr.id
       WHERE lp.user_id = $1
       ORDER BY lp.purchased_at DESC`,
      [user.id]
    );

    await pool.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ leads: result.rows })
    };
  } catch (error) {
    console.error('Error fetching claimed leads:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to load your leads' })
    };
  }
};
