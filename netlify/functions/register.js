// Register function for Netlify
const { hashPassword, generateToken, getUserByUsername } = require('./utils/auth');
const { getDb } = require('./utils/db');
const { users, referrals } = require('../../shared/schema');
const { REFERRAL_RULES, isReferralExpired } = require('./utils/referral');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Parse request body
    const { username, password, email, fullName, companyName, phoneNumber, referralCode } = JSON.parse(event.body);

    // Validate input
    if (!username || !password || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Username, password, and email are required' })
      };
    }

    // Check if username already exists
    const existingUser = await getUserByUsername(username);
    
    if (existingUser) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Username already exists' })
      };
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Create the user in the database
    const { db, pool } = getDb();
    
    try {
      // Check referral code if provided
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
      
      // Insert the new user
      const userValues = {
        username,
        password: hashedPassword,
        email,
        fullName,
        companyName,
        phoneNumber,
        subscriptionLevel: 'free', // Default to free tier
        isAdmin: false
      };
      
      // Add referral information if valid
      if (referrerId) {
        userValues.referredBy = referrerId;
      }
      
      const [newUser] = await db.insert(users).values(userValues).returning();
      
      // If there was a valid referral, create a referral record
      if (referrerId) {
        await db.insert(referrals).values({
          referrerId: referrerId,
          referredId: newUser.id,
          status: 'pending'
        });
        
        // Send a notification to the referrer (in a real implementation, this would be an email)
        console.log(`User ${referrerId} referred new user ${newUser.id}`);
      }
      
      // Generate JWT token
      const token = generateToken(newUser);

      // Create user data to return (exclude password)
      const userData = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        companyName: newUser.companyName,
        subscriptionLevel: newUser.subscriptionLevel,
        referredBy: newUser.referredBy
      };

      // Set cookie for session
      const cookieHeader = `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24}`; // 24 hours

      // Return success with user data and token
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
      // Always close the pool after operation
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
