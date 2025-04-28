{\rtf1\ansi\ansicpg1252\cocoartf2709
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww29200\viewh16120\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const express = require("express");\
const bodyParser = require("body-parser");\
const fs = require("fs-extra");\
const path = require("path");\
require("dotenv").config();\
\
const app = express();\
const PORT = process.env.PORT || 3000;\
\
app.use(bodyParser.urlencoded(\{ extended: true \}));\
app.use(express.static("public"));\
app.set("view engine", "ejs");\
\
// Homepage\
app.get("/", (req, res) => \{\
  res.render("index");\
\});\
\
// Form submission\
app.post("/submit-lead", async (req, res) => \{\
  const formData = req.body;\
  const leads = await fs.readJson("leads.json").catch(() => []);\
  leads.push(\{ ...formData, claimed: false, timestamp: Date.now() \});\
  await fs.writeJson("leads.json", leads, \{ spaces: 2 \});\
  res.redirect("/thankyou");\
\});\
\
// Thank You\
app.get("/thankyou", (req, res) => \{\
  res.render("thankyou");\
\});\
\
app.listen(PORT, () => \{\
  console.log(`\uc0\u9989  Server running at http://localhost:$\{PORT\}`);\
\});\
}
