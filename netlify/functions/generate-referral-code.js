// Function to generate a referral code for a user
const { getUserFromRequest } = require('./utils/auth');
const { getDb } = require('./utils/db');
const { generateReferralCode } = require('./utils/referral');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Get user from request
    const user = await getUserFromRequest(event);
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    const { db, pool } = getDb();
    
    try {
      // Check if user already has a referral code
      if (user.referralCode) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            referralCode: user.referralCode,
            message: 'Existing referral code returned'
          })
        };
      }
      
      // Generate a unique referral code
      let referralCode;
      let isUnique = false;
      
      // Try up to 5 times to generate a unique code
      for (let attempt = 0; attempt < 5 && !isUnique; attempt++) {
        referralCode = generateReferralCode();
        
        // Check if code is unique
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
          body: JSON.stringify({ error: 'Failed to generate a unique referral code' })
        };
      }
      
      // Save the referral code to the user
      await pool.query(
        'UPDATE users SET referral_code = $1 WHERE id = $2',
        [referralCode, user.id]
      );
      
      // Create a referral URL
      const baseUrl = process.env.BASE_URL || 'https://caringforpops.com';
      const referralUrl = `${baseUrl}/join?ref=${referralCode}`;
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          referralCode,
          referralUrl,
          message: 'Referral code generated successfully'
        })
      };
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Generate referral code error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to generate referral code',
        message: error.message
      })
    };
  }
};
