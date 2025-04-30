#!/usr/bin/env node

/**
 * Caring for Pops Website
 * 
 * This is the main entry point for the Caring for Pops website
 * which connects care seekers with home healthcare providers.
 */

// Load environment variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { setupAuth } = require('./server/auth');
const { setupRoutes } = require('./server/routes');

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Set up authentication
setupAuth(app);

// Set up API routes
setupRoutes(app);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Define routes for specific HTML files
app.get('/providers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'providers.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'faq.html'));
});

// Catch-all route for SPA - this should be last
app.get('*', (req, res) => {
  // Check if request is for an API endpoint
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Otherwise, send the index.html file
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Set the port based on environment or default to 5000 (Render-friendly)
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Caring for Pops Website`);
  console.log(`============================`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Website is up and ready for deployment to Render.`);
});