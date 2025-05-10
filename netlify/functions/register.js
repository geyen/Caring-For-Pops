const { hashPassword, generateToken, getUserByUsername } = require('./auth');
const { getDb } = require('./db');
const { users, referrals } = require('./schema');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { username, password, email, fullName, companyName, phoneNumber, referralCode } = JSON.parse(event.body);

    if (!username || !password || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Username, password, and email are required' })
      };
    }

    const existingUser = await getUserByUsername(username);

    if (existingUser) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Username already exists' })
      };
    }

    const hashedPassword = await hashPassword(password);
    const { db, pool } = getDb();

    try {
      let referrerId = null;
      if (referralCode) {
        const referrerResult = await pool.query(
          'SELECT id FROM users WHERE referral_code = $1',
          [referralCode]
        );

        if (referrerResult.rows.length > 0) {
          referrerId = referrerResult.rows[0].id;
        }
      }

      const userValues = {
        username,
        password: hashedPassword,
        email,
        fullName,
        companyName,
        phoneNumber,
        subscriptionLevel: 'free',
        isAdmin: false
      };

      if (referrerId) {
        userValues.referredBy = referrerId;
      }

      const [newUser] = await db.insert(users).values(userValues).returning();

      if (referrerId) {
        await db.insert(referrals).values({
          referrerId: referrerId,
          referredId: newUser.id,
          status: 'pending'
        });

        console.log(`User ${referrerId} referred new user ${newUser.id}`);
      }

      const token = generateToken(newUser);

      const userData = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        companyName: newUser.companyName,
        subscriptionLevel: newUser.subscriptionLevel,
        referredBy: newUser.referredBy
      };

      const cookieHeader = `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24}`;

      return {
        statusCode: 201,
        headers: {
          'Set-Cookie': cookieHeader,
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: userData,
          token: token,
          wasReferred: !!referrerId
        })
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Registration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Registration failed' })
    };
  }
};
