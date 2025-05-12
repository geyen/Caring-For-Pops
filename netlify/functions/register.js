const { hashPassword, generateToken, getUserByUsername } = require('./utils/auth');
const { getDb } = require('./utils/db');
const { REFERRAL_RULES, isReferralExpired, generateReferralCode } = require('./utils/referral');

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
    const { pool } = getDb();

    // Check referral
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

    const userReferralCode = generateReferralCode();

    const newUserResult = await pool.query(
      `INSERT INTO users (username, password, email, full_name, company_name, phone_number, subscription_level, is_admin, referral_code, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'free', false, $7, $8)
       RETURNING *`,
      [username, hashedPassword, email, fullName, companyName, phoneNumber, userReferralCode, referrerId]
    );

    const newUser = newUserResult.rows[0];

    if (referrerId) {
      await pool.query(
        `INSERT INTO referrals (referrer_id, referred_id, status, created_at)
         VALUES ($1, $2, 'pending', NOW())`,
        [referrerId, newUser.id]
      );
    }

    const token = generateToken(newUser);
    const cookieHeader = `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24}`;

    const userData = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      fullName: newUser.full_name,
      companyName: newUser.company_name,
      subscriptionLevel: newUser.subscription_level,
      referredBy: newUser.referred_by
    };

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
  } catch (error) {
    console.error('Registration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Registration failed', message: error.message })
    };
  }
};
