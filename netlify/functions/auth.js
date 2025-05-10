const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');

// Use a real secret in production and store it in Netlify environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

exports.hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

exports.comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

exports.generateToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '1d',
  });
};

exports.getUserByUsername = async (username) => {
  const { db } = getDb();
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0] || null;
};
