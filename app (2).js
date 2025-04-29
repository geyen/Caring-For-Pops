const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs-extra");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Homepage
app.get("/", (req, res) => {
  res.render("index");
});

// Form submission
app.post("/submit-lead", async (req, res) => {
  const formData = req.body;
  const leads = await fs.readJson("leads.json").catch(() => []);
  leads.push({ ...formData, claimed: false, timestamp: Date.now() });
  await fs.writeJson("leads.json", leads, { spaces: 2 });
  res.redirect("/thankyou");
});

// Thank You
app.get("/thankyou", (req, res) => {
  res.render("thankyou");
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});