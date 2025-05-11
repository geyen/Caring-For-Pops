// Auth utilities for Netlify functions
const { scrypt, randomBytes, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');

const scryptAsync = promisify(scrypt);

// Hash a password
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

// Compare a password with a stored hash
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Generate a JWT token
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin || false
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}

// Verify a JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Get user by username
async function getUserByUsername(username) {
  const { db, pool } = getDb();
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

// Get user by ID
async function getUserById(id) {
  const { db, pool } = getDb();
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    return result.rows[0] || null;
  } finally {
    await pool.end();
  }
}

// Get user from a request
async function getUserFromRequest(event) {
  // Check for token in cookies
  const cookies = parseCookies(event);
  const tokenFromCookie = cookies.token;
  
  // Check for token in Authorization header
  const authHeader = event.headers.authorization || '';
  const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  // Use token from cookie or header
  const token = tokenFromCookie || tokenFromHeader;
  
  if (!token) {
    return null;
  }
  
  // Verify the token
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }
  
  // Get the user from the database
  return await getUserById(decoded.id);
}

// Parse cookies from event
function parseCookies(event) {
  const cookieHeader = event.headers.cookie || '';
  return cookieHeader.split(';')
    .reduce((cookies, cookie) => {
      const [name, value] = cookie.trim().split('=').map(decodeURIComponent);
      cookies[name] = value;
      return cookies;
    }, {});
}

module.exports = {
  hashPassword,
  comparePasswords,
  generateToken,
  verifyToken,
  getUserByUsername,
  getUserById,
  getUserFromRequest,
  parseCookies
};
