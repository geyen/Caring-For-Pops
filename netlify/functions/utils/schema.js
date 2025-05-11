// netlify/functions/utils/schema.js

const users = {
  id: 'uuid',
  email: 'string',
  username: 'string',
  password: 'string',
  created_at: 'date',
};

module.exports = {
  users
};
