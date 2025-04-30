const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { scrypt, randomBytes, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const { db } = require('./db');
const { users } = require('../shared/schema');
const { eq } = require('drizzle-orm');

const scryptAsync = promisify(scrypt);

// Hash a password using scrypt
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

// Compare a password with its hashed version
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Set up authentication with Passport.js
function setupAuth(app) {
  // Create a session store
  const connectPg = require('connect-pg-simple');
  const { pool } = require('./db');
  const session = require('express-session');
  
  const PostgresStore = connectPg(session);
  const sessionStore = new PostgresStore({
    pool,
    createTableIfMissing: true
  });

  // Configure sessions
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'caring-for-pops-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === 'production'
    }
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Passport to use a local strategy
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      // Find the user by username
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false, { message: 'Invalid username or password' });
      }
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  // Serialize and deserialize user
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });

  // Authentication routes
  app.post('/api/register', async (req, res) => {
    try {
      // Check if username already exists
      const [existingUser] = await db.select().from(users).where(eq(users.username, req.body.username));
      
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(req.body.password);
      
      // Create the user
      const [newUser] = await db.insert(users).values({
        username: req.body.username,
        password: hashedPassword,
        email: req.body.email,
        fullName: req.body.fullName,
        companyName: req.body.companyName,
        phoneNumber: req.body.phoneNumber
      }).returning();
      
      // Log the user in
      req.login(newUser, err => {
        if (err) return res.status(500).json({ error: 'Login failed after registration' });
        return res.status(201).json({
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.fullName,
          companyName: newUser.companyName
        });
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Login route
  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info.message || 'Login failed' });
      
      req.login(user, err => {
        if (err) return next(err);
        return res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          companyName: user.companyName,
          subscriptionLevel: user.subscriptionLevel
        });
      });
    })(req, res, next);
  });

  // Logout route
  app.post('/api/logout', (req, res) => {
    req.logout(err => {
      if (err) return res.status(500).json({ error: 'Logout failed' });
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Get current user
  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      fullName: req.user.fullName,
      companyName: req.user.companyName,
      subscriptionLevel: req.user.subscriptionLevel
    });
  });
}

module.exports = {
  setupAuth,
  hashPassword,
  comparePasswords
};