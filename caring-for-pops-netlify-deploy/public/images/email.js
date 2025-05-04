// Email utility functions using SendGrid
const sgMail = require('@sendgrid/mail');

// Set the API key from environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Default sender address
const DEFAULT_FROM = 'no-reply@caringforpops.com';

/**
 * Send a welcome email to a new affiliate
 * 
 * @param {Object} affiliate - The affiliate object
 * @param {string} affiliate.email - Affiliate's email address
 * @param {string} affiliate.firstName - Affiliate's first name
 * @param {string} [affiliate.companyName] - Affiliate's company name
 * @returns {Promise} - SendGrid response
 */
async function sendWelcomeEmail(affiliate) {
  const msg = {
    to: affiliate.email,
    from: DEFAULT_FROM,
    subject: 'Welcome to Caring for Pops!',
    text: `Hello ${affiliate.firstName},\n\nWelcome to Caring for Pops! We're excited to have you join our network of home health care providers. You're now set up to receive exclusive leads in your service area.\n\nLog in to your dashboard to set up your profile, subscription, and start receiving leads.\n\nThank you,\nThe Caring for Pops Team`,
    html: `<p>Hello ${affiliate.firstName},</p>
           <p>Welcome to Caring for Pops! We're excited to have you join our network of home health care providers. You're now set up to receive exclusive leads in your service area.</p>
           <p>Log in to your dashboard to set up your profile, subscription, and start receiving leads.</p>
           <p>Thank you,<br>The Caring for Pops Team</p>`,
  };
  
  try {
    return await sgMail.send(msg);
  } catch (error) {
    console.error('SendGrid Error:', error);
    // If available, log more detailed error information
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
}

/**
 * Send a lead notification email to an affiliate
 * 
 * @param {Object} affiliate - The affiliate object
 * @param {string} affiliate.email - Affiliate's email address 
 * @param {Object} lead - The lead object
 * @returns {Promise} - SendGrid response
 */
async function sendLeadNotificationEmail(affiliate, lead) {
  const msg = {
    to: affiliate.email,
    from: DEFAULT_FROM,
    subject: 'New Lead Available - Caring for Pops',
    text: `Hello,\n\nA new lead is available in your service area. Log in to your Caring for Pops dashboard to view and claim this lead.\n\nLead Details:\nLocation: ${lead.city}, ${lead.state}\nCare Type: ${lead.careType}\n\nRemember, leads are exclusive once claimed!\n\nThank you,\nThe Caring for Pops Team`,
    html: `<p>Hello,</p>
           <p>A new lead is available in your service area. Log in to your Caring for Pops dashboard to view and claim this lead.</p>
           <p><strong>Lead Details:</strong><br>
           Location: ${lead.city}, ${lead.state}<br>
           Care Type: ${lead.careType}</p>
           <p>Remember, leads are exclusive once claimed!</p>
           <p>Thank you,<br>The Caring for Pops Team</p>`,
  };
  
  try {
    return await sgMail.send(msg);
  } catch (error) {
    console.error('SendGrid Error:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
}

/**
 * Send a lead purchase confirmation email
 * 
 * @param {Object} affiliate - The affiliate object
 * @param {string} affiliate.email - Affiliate's email address
 * @param {Object} lead - The lead object
 * @returns {Promise} - SendGrid response
 */
async function sendLeadPurchaseConfirmationEmail(affiliate, lead) {
  const msg = {
    to: affiliate.email,
    from: DEFAULT_FROM,
    subject: 'Lead Purchase Confirmation - Caring for Pops',
    text: `Hello,\n\nThank you for purchasing a lead from Caring for Pops!\n\nLead Details:\nName: ${lead.firstName} ${lead.lastName}\nPhone: ${lead.phone}\nEmail: ${lead.email}\nLocation: ${lead.city}, ${lead.state}\nCare Type: ${lead.careType}\n\nThis lead is now exclusively yours. We recommend contacting them as soon as possible.\n\nThank you,\nThe Caring for Pops Team`,
    html: `<p>Hello,</p>
           <p>Thank you for purchasing a lead from Caring for Pops!</p>
           <p><strong>Lead Details:</strong><br>
           Name: ${lead.firstName} ${lead.lastName}<br>
           Phone: ${lead.phone}<br>
           Email: ${lead.email}<br>
           Location: ${lead.city}, ${lead.state}<br>
           Care Type: ${lead.careType}</p>
           <p>This lead is now exclusively yours. We recommend contacting them as soon as possible.</p>
           <p>Thank you,<br>The Caring for Pops Team</p>`,
  };
  
  try {
    return await sgMail.send(msg);
  } catch (error) {
    console.error('SendGrid Error:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
}

/**
 * Send a subscription confirmation email
 * 
 * @param {Object} affiliate - The affiliate object
 * @param {string} affiliate.email - Affiliate's email address
 * @param {Object} subscription - The subscription details
 * @param {string} subscription.planName - Name of the subscription plan
 * @param {number} subscription.leadCount - Number of leads in the plan
 * @returns {Promise} - SendGrid response
 */
async function sendSubscriptionConfirmationEmail(affiliate, subscription) {
  const msg = {
    to: affiliate.email,
    from: DEFAULT_FROM,
    subject: 'Subscription Confirmation - Caring for Pops',
    text: `Hello,\n\nThank you for subscribing to our ${subscription.planName} plan at Caring for Pops!\n\nYour subscription includes ${subscription.leadCount} leads per month, and you'll be notified when new leads matching your service area become available.\n\nThank you,\nThe Caring for Pops Team`,
    html: `<p>Hello,</p>
           <p>Thank you for subscribing to our <strong>${subscription.planName}</strong> plan at Caring for Pops!</p>
           <p>Your subscription includes <strong>${subscription.leadCount} leads</strong> per month, and you'll be notified when new leads matching your service area become available.</p>
           <p>Thank you,<br>The Caring for Pops Team</p>`,
  };
  
  try {
    return await sgMail.send(msg);
  } catch (error) {
    console.error('SendGrid Error:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
}

/**
 * Send a general email with custom content
 * 
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content
 * @param {string} [from] - Sender email (uses default if not provided)
 * @returns {Promise} - SendGrid response
 */
async function sendCustomEmail(to, subject, text, html, from = DEFAULT_FROM) {
  const msg = {
    to,
    from,
    subject,
    text,
    html,
  };
  
  try {
    return await sgMail.send(msg);
  } catch (error) {
    console.error('SendGrid Error:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendLeadNotificationEmail,
  sendLeadPurchaseConfirmationEmail,
  sendSubscriptionConfirmationEmail,
  sendCustomEmail
};