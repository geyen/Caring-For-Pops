// Database utilities for Netlify functions

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

// Initialize connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Optional: adjust based on your DB config
  },
});

// Function to get the DB instance
function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const db = drizzle(pool); // No schema passed
  return { db, pool };
}

module.exports = { getDb };
