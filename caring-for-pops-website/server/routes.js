const express = require('express');
const { db } = require('./db');
const { careRequests, subscriptionPlans, users } = require('../shared/schema');
const { eq, and, isNull, count } = require('drizzle-orm');

function setupRoutes(app) {
  // Middleware to check if user is authenticated
  const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
  };

  // API to submit a care request (for care seekers)
  app.post('/api/care-request', express.json(), async (req, res) => {
    try {
      const {
        patientName,
        contactName,
        email,
        phoneNumber,
        address,
        city,
        state,
        zipCode,
        careType,
        careDetails,
        careHours,
        urgency
      } = req.body;

      // Validate required fields
      if (!patientName || !contactName || !email || !phoneNumber) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create the care request
      const [newRequest] = await db.insert(careRequests).values({
        patientName,
        contactName,
        email,
        phoneNumber,
        address,
        city,
        state,
        zipCode,
        careType,
        careDetails,
        careHours,
        urgency,
        status: 'new'
      }).returning();

      res.status(201).json({ 
        message: 'Care request submitted successfully',
        requestId: newRequest.id
      });
    } catch (err) {
      console.error('Error submitting care request:', err);
      res.status(500).json({ error: 'Failed to submit care request' });
    }
  });

  // Get available care requests (for providers)
  app.get('/api/care-requests', isAuthenticated, async (req, res) => {
    try {
      // Get unclaimed care requests
      const availableRequests = await db.select({
        id: careRequests.id,
        patientName: careRequests.patientName,
        city: careRequests.city,
        state: careRequests.state,
        careType: careRequests.careType,
        urgency: careRequests.urgency,
        createdAt: careRequests.createdAt
      })
      .from(careRequests)
      .where(and(
        eq(careRequests.status, 'new'),
        isNull(careRequests.claimedBy)
      ));

      res.json(availableRequests);
    } catch (err) {
      console.error('Error fetching care requests:', err);
      res.status(500).json({ error: 'Failed to fetch care requests' });
    }
  });

  // Claim a care request (for providers)
  app.post('/api/care-requests/:id/claim', isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = req.user.id;

      // Check the provider's subscription level and lead limit
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      // Get the count of leads already claimed by this provider
      const claimedLeads = await db.select({ count: count() })
        .from(careRequests)
        .where(eq(careRequests.claimedBy, userId));
      
      const leadCount = claimedLeads[0]?.count || 0;
      
      // Check if the provider has reached their lead limit based on subscription level
      let maxLeads = 1; // Default for free tier
      
      if (user.subscriptionLevel === 'basic') {
        maxLeads = 10;
      } else if (user.subscriptionLevel === 'premium') {
        maxLeads = 50;
      } else if (user.subscriptionLevel === 'unlimited') {
        maxLeads = Infinity;
      }
      
      if (leadCount >= maxLeads && user.subscriptionLevel !== 'unlimited') {
        return res.status(403).json({ 
          error: 'You have reached your lead limit. Please upgrade your subscription.' 
        });
      }

      // Check if the care request is available to claim
      const [careRequest] = await db.select()
        .from(careRequests)
        .where(and(
          eq(careRequests.id, requestId),
          eq(careRequests.status, 'new'),
          isNull(careRequests.claimedBy)
        ));

      if (!careRequest) {
        return res.status(404).json({ error: 'Care request not found or already claimed' });
      }

      // Claim the care request
      await db.update(careRequests)
        .set({ 
          status: 'claimed',
          claimedBy: userId
        })
        .where(eq(careRequests.id, requestId));

      res.json({ message: 'Care request claimed successfully' });
    } catch (err) {
      console.error('Error claiming care request:', err);
      res.status(500).json({ error: 'Failed to claim care request' });
    }
  });

  // Get care request details (for the provider who claimed it)
  app.get('/api/care-requests/:id', isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = req.user.id;

      // Get the care request
      const [careRequest] = await db.select()
        .from(careRequests)
        .where(eq(careRequests.id, requestId));

      if (!careRequest) {
        return res.status(404).json({ error: 'Care request not found' });
      }

      // Check if the user is authorized to view this request
      if (careRequest.claimedBy !== userId && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized to view this care request' });
      }

      res.json(careRequest);
    } catch (err) {
      console.error('Error fetching care request details:', err);
      res.status(500).json({ error: 'Failed to fetch care request details' });
    }
  });

  // Get subscription plans
  app.get('/api/subscription-plans', async (req, res) => {
    try {
      const plans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
      res.json(plans);
    } catch (err) {
      console.error('Error fetching subscription plans:', err);
      res.status(500).json({ error: 'Failed to fetch subscription plans' });
    }
  });

  // Get provider's claimed leads
  app.get('/api/my-leads', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;

      const myLeads = await db.select()
        .from(careRequests)
        .where(eq(careRequests.claimedBy, userId));

      res.json(myLeads);
    } catch (err) {
      console.error('Error fetching provider leads:', err);
      res.status(500).json({ error: 'Failed to fetch your leads' });
    }
  });
}

module.exports = {
  setupRoutes
};