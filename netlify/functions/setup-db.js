const { getDb } = require('./utils/db');
const { hashPassword } = require('./utils/auth');

exports.handler = async (event) => {
  const apiKey = event.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.SETUP_API_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const { pool } = getDb();
    const results = {};

    // Create tables
    results.tables = await createTables(pool);

    // Create subscription plans if needed
    results.plans = await createSubscriptionPlans(pool);

    // Create admin user if requested
    if (event.queryStringParameters?.createAdmin === 'true') {
      results.admin = await createAdminUser(pool);
    }

    // Create first affiliate if requested
    if (event.queryStringParameters?.createAffiliate === 'true') {
      results.affiliate = await createFirstAffiliate(pool);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Database setup completed successfully',
        results
      })
    };
  } catch (error) {
    console.error('Database setup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Database setup failed',
        message: error.message
      })
    };
  }
};
