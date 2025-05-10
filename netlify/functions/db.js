const { Pool } = require('pg');

let pool;

function getDb() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  return {
    pool,
    db: {
      query: (...args) => pool.query(...args),
      insert: (table) => ({
        values: (values) => ({
          async returning() {
            const keys = Object.keys(values);
            const vals = Object.values(values);
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
            const query = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`;
            const res = await pool.query(query, vals);
            return res.rows;
          },
        }),
      }),
    },
  };
}

exports.getDb = getDb;
