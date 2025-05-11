// Get current user function for Netlify
const { getUserFromRequest } = require('./utils/auth');

exports.handler = async (event, context) => {
  try {
    // Get user from the request (token verification)
    const user = await getUserFromRequest(event);
    
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Not authenticated' })
      };
    }

    // Return user data (exclude password)
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        companyName: user.companyName,
        subscriptionLevel: user.subscriptionLevel,
        isAdmin: user.isAdmin
      })
    };
  } catch (error) {
    console.error('Get user error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get user' })
    };
  }
};
