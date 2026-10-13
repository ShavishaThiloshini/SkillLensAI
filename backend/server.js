const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const { initDb } = require("./database/initDb");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS connected");

    res.json({
      success: true,
      message: "SkillLens AI backend is running",
      database: rows[0].connected === 1 ? "connected" : "not connected",
    });
  } catch (error) {
    console.error("Database connection error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`SkillLens AI backend running on port ${PORT}`);
  // Attempt DB table verification asynchronously without blocking server startup
  try {
    await initDb();
  } catch (err) {
    console.warn("[DB] Initialization check skipped or deferred:", err.message);
  }
});