const { getUserFromRequest } = require('./utils/auth');

exports.handler = async (event) => {
  try {
    const user = await getUserFromRequest(event);

    if (!user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Not authenticated' })
      };
    }

    // Restrict to provider roles only
    const validProviderRoles = ['basic', 'growth', 'elite'];
    if (!validProviderRoles.includes(user.subscriptionLevel)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied. Not a provider account.' })
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
