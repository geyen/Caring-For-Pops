exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Clear the JWT cookie
    const expiredCookie = 'token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';

    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': expiredCookie,
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Logged out successfully' })
    };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Logout failed', message: error.message })
    };
  }
};
