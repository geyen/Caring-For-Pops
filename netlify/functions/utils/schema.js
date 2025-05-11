// netlify/functions/utils/schema.js

const users = {
  tableName: 'users',
  columns: [
    'id',
    'username',
    'password',
    'email',
    'fullName',
    'companyName',
    'phoneNumber',
    'subscriptionLevel',
    'referredBy',
    'isAdmin',
    'createdAt'
  ]
};

const referrals = {
  tableName: 'referrals',
  columns: [
    'id',
    'referrerId',
    'referredId',
    'status',
    'createdAt'
  ]
};

module.exports = {
  users,
  referrals
};
