const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/provider-login', (req, res) => {
  res.render('provider-login');
});

// Handle form submission
app.post('/submit-lead', (req, res) => {
  const leadData = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    status: 'new',
    ...req.body
  };
  
  // Read existing leads
  let leads = [];
  try {
    if (fs.existsSync('./leads.json')) {
      const leadsData = fs.readFileSync('./leads.json', 'utf8');
      leads = JSON.parse(leadsData);
    }
  } catch (error) {
    console.error('Error reading leads file:', error);
  }
  
  // Add new lead
  leads.push(leadData);
  
  // Write back to file
  try {
    fs.writeFileSync('./leads.json', JSON.stringify(leads, null, 2));
    console.log('Lead saved successfully:', leadData.id);
    
    // Send success response
    res.render('thankyou', { referenceId: leadData.id });
  } catch (error) {
    console.error('Error saving lead:', error);
    res.status(500).send('An error occurred while processing your request. Please try again later.');
  }
});

// Mock provider login for demo purposes
app.post('/provider-login', (req, res) => {
  const { email, password } = req.body;
  
  // This is a simple mock for demonstration
  // In a real application, you would validate against a database
  if (email === 'demo@caringforpops.com' && password === 'demo123') {
    res.send('Login successful! Provider dashboard will be implemented in the next phase.');
  } else {
    res.status(401).send('Invalid credentials. Please try again.');
  }
});

// Mock provider signup for demo purposes
app.post('/provider-signup', (req, res) => {
  // Just acknowledge the signup for now
  res.send('Thank you for signing up! Your account is pending approval.');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

module.exports = app;