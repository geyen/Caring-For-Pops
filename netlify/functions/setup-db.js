// Imports
const { getDb } = require('./utils/db');
const { hashPassword } = require('./utils/auth');

// Handler function (Netlify will call this)
exports.handler = async (event) => {
  const apiKey = event.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.SETUP_API_KEY) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const { pool } = getDb();
    const results = {};

    // Create tables
    results.tables = await createTables(pool);

    // Create subscription plans
    results.plans = await createSubscriptionPlans(pool);

    // Create admin user if requested
    if (event.queryStringParameters?.createAdmin === 'true') {
      results.admin = await createAdminUser(pool);
    }

    // Create test affiliate if requested
    if (event.queryStringParameters?.createAffiliate === 'true') {
      results.affiliate = await createFirstAffiliate(pool);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Database setup completed successfully',
        results
      })
    };
  } catch (error) {
    console.error('Database setup error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Database setup failed',
        message: error.message
      })
    };
  }
};

// Create database tables
async function createTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(100) NOT NULL,
      full_name VARCHAR(100),
      company_name VARCHAR(100),
      phone_number VARCHAR(20),
      subscription_level VARCHAR(20) DEFAULT 'free',
      created_at TIMESTAMP DEFAULT NOW(),
      is_admin BOOLEAN DEFAULT FALSE,
      stripe_customer_id VARCHAR(100),
      stripe_subscription_id VARCHAR(100),
      referral_code VARCHAR(20) UNIQUE,
      referred_by INTEGER REFERENCES users(id),
      bonus_leads_available INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS care_requests (
      id SERIAL PRIMARY KEY,
      patient_name VARCHAR(100) NOT NULL,
      contact_name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      address TEXT,
      city VARCHAR(50),
      state VARCHAR(20),
      zip_code VARCHAR(10),
      care_type VARCHAR(50),
      care_details TEXT,
      care_hours VARCHAR(50),
      urgency VARCHAR(20),
      status VARCHAR(20) DEFAULT 'new',
      created_at TIMESTAMP DEFAULT NOW(),
      claimed_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      max_leads INTEGER DEFAULT 0,
      features TEXT,
      is_active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS lead_purchases (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      lead_id INTEGER NOT NULL REFERENCES care_requests(id),
      amount INTEGER NOT NULL,
