const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// Hash a plain password
function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// Compare plain and hashed passwords
function comparePassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

// Generate JWT from user
function generateToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
}

// Get user by username
async function getUserByUsername(username) {
  const { pool } = getDb();
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0];
}

// Get user by ID
async function getUserById(id) {
  const { pool } = getDb();
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// Extract user from JWT token in request
async function getUserFromRequest(event) {
  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);
    return user;
  } catch (err) {
    console.error('Invalid token', err);
    return null;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  getUserFromRequest,
  getUserByUsername,
  getUserById
};
