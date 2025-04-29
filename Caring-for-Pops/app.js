const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/')));

// Lead storage path
const LEADS_FILE = path.join(__dirname, 'leads.json');

// Initialize leads file if it doesn't exist
if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2));
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/provider', (req, res) => {
  res.sendFile(path.join(__dirname, 'provider.html'));
});

// API endpoint to submit a new lead
app.post('/api/submit-lead', (req, res) => {
  try {
    const newLead = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...req.body
    };

    // Read existing leads
    const leadsData = fs.readFileSync(LEADS_FILE, 'utf8');
    const leads = JSON.parse(leadsData);
    
    // Add new lead
    leads.push(newLead);
    
    // Save updated leads
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    
    res.redirect('/thankyou.html');
  } catch (error) {
    console.error('Error saving lead:', error);
    res.status(500).json({ error: 'Failed to save lead information' });
  }
});

// API endpoint to get all leads
app.get('/api/leads', (req, res) => {
  try {
    const leadsData = fs.readFileSync(LEADS_FILE, 'utf8');
    const leads = JSON.parse(leadsData);
    res.json(leads);
  } catch (error) {
    console.error('Error reading leads:', error);
    res.status(500).json({ error: 'Failed to retrieve leads' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the website`);
});