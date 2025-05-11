const { Pool } = require('pg');

function getDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  return {
    db: pool, // optional if you use db.insert etc.
    pool
  };
}

module.exports = { getDb };

          },
        }),
      }),
    },
  };
}

exports.getDb = getDb;
