// Utilities for referral system
const crypto = require('crypto');

// Generate a unique 8-character referral code
function generateReferralCode() {
  // Create a code with alphanumeric characters (excluding similar-looking ones)
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  
  // Generate an 8-character code
  const randomBytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    const index = randomBytes[i] % characters.length;
    code += characters.charAt(index);
  }
  
  return code;
}

// Rules for referral qualification
const REFERRAL_RULES = {
  // Number of free leads awarded to referrer
  BONUS_LEADS_FOR_REFERRER: 2,
  
  // Minimum payment amount for the referred user before bonus is awarded
  MINIMUM_PAYMENT_AMOUNT: 5000, // $50.00
  
  // Expiration days for a referral (after which it can't be claimed)
  EXPIRATION_DAYS: 90
};

// Check if a referral code is expired
function isReferralExpired(referralDate) {
  const createdAt = new Date(referralDate);
  const now = new Date();
  const differenceInMs = now - createdAt;
  const differenceInDays = differenceInMs / (1000 * 60 * 60 * 24);
  
  return differenceInDays > REFERRAL_RULES.EXPIRATION_DAYS;
}

module.exports = {
  generateReferralCode,
  REFERRAL_RULES,
  isReferralExpired
};
