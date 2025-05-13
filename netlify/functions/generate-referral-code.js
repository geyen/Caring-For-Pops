const { getUserFromRequest } = require('./utils/auth');
const { getDb } = require('./utils/db');
const { generateReferralCode } = require('./utils/referral');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const user = await getUserFromRequest(event);
    if (!user) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    const { pool } = getDb();

    // If the user already has a referral code, return it
    if (user.referral_code) {
      const referralUrl = `${process.env.BASE_URL || 'https://caringforpops.com'}/join?ref=${user.referral_code}`;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode: user.referral_code,
          referralUrl,
          message: 'Existing referral code returned'
        })
      };
    }

    // Attempt to generate a unique referral code
    let referralCode = '';
    let isUnique = false;

    for (let i = 0; i < 5 && !isUnique; i++) {
      referralCode = generateReferralCode();

      const result = await pool.query(
        'SELECT COUNT(*) FROM users WHERE referral_code = $1',
        [referralCode]
      );

      if (parseInt(result.rows[0].count) === 0) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Could not generate a unique referral code. Try again later.' })
      };
    }

    // Save the code
    await pool.query(
      'UPDATE users SET referral_code = $1 WHERE id = $2',
      [referralCode, user.id]
    );

    const referralUrl = `${process.env.BASE_URL || 'https://caringforpops.com'}/join?ref=${referralCode}`;

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
