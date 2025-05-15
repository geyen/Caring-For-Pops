// Get current user function for Netlify
const { getUserFromRequest } = require('./utils/auth');

exports.handler = async (event, context) => {
  try {
    const user = await getUserFromRequest(event);
    
    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Not authenticated' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          companyName: user.companyName,
          subscriptionLevel: user.subscriptionLevel,
          leads_available: user.leads_available,
          isAdmin: user.isAdmin
        }
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
