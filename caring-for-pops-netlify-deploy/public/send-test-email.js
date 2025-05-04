// Simple test function for sending emails through SendGrid
const { sendCustomEmail } = require('./utils/email');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  try {
    // Parse the incoming request body
    const requestBody = JSON.parse(event.body);
    const { email, subject, message } = requestBody;
    
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Email address is required' })
      };
    }

    // Define email content
    const emailSubject = subject || 'Caring for Pops - Test Email';
    const text = message || 'This is a test email from Caring for Pops. If you received this email, your SendGrid integration is working correctly!';
    const html = `
      <h2>${emailSubject}</h2>
      <p>${text}</p>
      <p>Your SendGrid integration with Netlify is working properly.</p>
      <p>Sent at: ${new Date().toLocaleString()}</p>
    `;

    // Send the test email
    await sendCustomEmail(email, emailSubject, text, html);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: 'Test email sent successfully',
        recipient: email
      })
    };
  } catch (error) {
    console.error('Error sending test email:', error);
    
    // Extract more detailed error information
    let errorDetails = 'No additional details available';
    if (error.response && error.response.body) {
      errorDetails = JSON.stringify(error.response.body);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false,
        message: 'Failed to send test email',
        error: error.message,
        details: errorDetails
      })
    };
  }
};