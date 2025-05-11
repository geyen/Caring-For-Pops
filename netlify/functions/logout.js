// Logout function for Netlify

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Clear the authentication cookie
    const cookieHeader = 'token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';

    // Return success
    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': cookieHeader,
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Logged out successfully' })
    };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Logout failed' })
    };
  }
};
