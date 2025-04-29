const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs-extra");
const path = require("path");

const app = express();
const PORT = 3000; // Use port 3000 to match the workflow
const HOST = '0.0.0.0';

// Configure middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Data storage
const LEADS_FILE = path.join(__dirname, "leads.json");

// Initialize leads file if it doesn't exist
if (!fs.existsSync(LEADS_FILE)) {
  fs.writeJsonSync(LEADS_FILE, []);
}

// Homepage
app.get("/", (req, res) => {
  res.render("index");
});

// Form submission
app.post("/submit-lead", async (req, res) => {
  try {
    const formData = req.body;
    const leads = await fs.readJson(LEADS_FILE).catch(() => []);
    leads.push({ 
      ...formData, 
      claimed: false, 
      timestamp: Date.now() 
    });
    await fs.writeJson(LEADS_FILE, leads, { spaces: 2 });
    res.redirect("/thankyou");
  } catch (error) {
    console.error("Error processing lead:", error);
    res.status(500).send("An error occurred while processing your request.");
  }
});

// Thank You
app.get("/thankyou", (req, res) => {
  res.render("thankyou");
});

// Status endpoint
app.get("/status", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`✅ Server running at http://${HOST}:${PORT}`);
});