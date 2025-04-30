const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('../shared/schema');

// Check for required environment variable
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create a Drizzle ORM instance
const db = drizzle(pool, { schema });

module.exports = {
  pool,
  db
};