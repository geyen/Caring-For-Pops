// Database utilities for Netlify functions
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('../../../shared/schema');

// Get DB connection
function getDb() {
  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  // Create a new pool for each function invocation
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for some PostgreSQL providers like Neon
  });
  
  // Create Drizzle instance
  const db = drizzle(pool, { schema });
  
  return { db, pool };
}

module.exports = {
  getDb
};
