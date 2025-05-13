const { Pool } = require('pg');

function getDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  return {
    db: pool, // optional alias
    pool
  };
}

module.exports = { getDb };
