const { getUserFromRequest } = require('./utils/auth');
const { getDb } = require('./utils/db');
const { generateReferralCode } = require('./utils/referral');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const user = await getUserFromRequest(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    const { pool } = getDb();

    // Check if user already has a referral code
    if (user.referralCode) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode: user.referralCode,
          message: 'Existing referral code returned'
        })
      };
    }

    // Try to generate a unique referral code
    let referralCode;
    let isUnique = false;

    for (let attempt = 0; attempt < 5 && !isUnique; attempt++) {
      referralCode = generateReferralCode();

      const existingCode = await pool.query(
        'SELECT COUNT(*) FROM users WHERE referral_code = $1',
        [referralCode]
      );

      if (parseInt(existingCode.rows[0].count) === 0) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to generate a unique referral code' })
      };
    }

    await pool.query(
      'UPDATE users SET referral_code = $1 WHERE id = $2',
      [referralCode, user.id]
    );

    const baseUrl = process.env.BASE_URL || 'https://caringforpops.com';
    const referralUrl = `${baseUrl}/join?ref=${referralCode}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referralCode,
        referralUrl,
        message: 'Referral code generated successfully'
      })
    };
  } catch (error) {
    console.error('Generate referral code error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to generate referral code',
        message: error.message
      })
    };
  }
};
