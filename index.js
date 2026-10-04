require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const connectDB = require("./src/utils/db");
const { UPLOAD_DIR } = require("./src/middleware/upload");

// Fail fast on missing config
const { accessSecret } = require("./src/utils/config");
const problems = [];
if (!process.env.MONGO_URI || process.env.MONGO_URI.startsWith("<")) problems.push("MONGO_URI");
if (!accessSecret() || accessSecret().startsWith("<")) problems.push("JWT_SECRET (or JWT_ACCESS_SECRET)");
if (problems.length) {
  console.error(`Missing or placeholder values in .env: ${problems.join(", ")}`);
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.startsWith("<")) {
  console.warn("Warning: GEMINI_API_KEY is empty. The server will run, but AI features will return an error until you add it.");
}

const app = express();

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Middleware
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));

// Routes
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/materials", require("./src/routes/materials"));
app.use("/api/admin", require("./src/routes/admin"));

// Health check
app.get("/", (req, res) => res.json({ message: "AI StudyBuddy API is running" }));

// 404 for unknown routes
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.message);

  let status = err.status || 500;
  let message = err.message || "Something went wrong";

  if (err.name === "MulterError") {
    status = 400;
  } else if (err.name === "CastError") {
    status = 400;
    message = "Invalid id";
  } else if (err.name === "ValidationError") {
    status = 400;
  } else if (err.code === 11000) {
    status = 400;
    message = "Email already in use";
  }

  res.status(status).json({ message });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch((err) => {
    console.error("Failed to start:", err.message);
    process.exit(1);
  });
