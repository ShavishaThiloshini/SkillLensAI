const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const { initDb } = require("./database/initDb");

const app = express();

// Explicit CORS: allow the Vite dev server (and any production URL in FRONTEND_URL)
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin header) and listed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

// Routes
const resumeRoutes = require("./routes/resumeRoutes");
const jobRoutes = require("./routes/jobRoutes");
const aiRoutes = require("./routes/aiRoutes");
const matchingRoutes = require("./routes/matchingRoutes");
const roadmapRoutes = require("./routes/roadmapRoutes");
const analysisRoutes = require("./routes/analysisRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const resumeImprovementRoutes = require("./routes/resumeImprovementRoutes");
const careerInsightsRoutes = require("./routes/careerInsightsRoutes");
const reportRoutes = require("./routes/reportRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/job-descriptions", jobRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/matching", matchingRoutes);
app.use("/api/roadmap", roadmapRoutes);
app.use("/api/analyses", analysisRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/resume-improvements", resumeImprovementRoutes);
app.use("/api/improvements", resumeImprovementRoutes);
app.use("/api/career-insights", careerInsightsRoutes);
app.use("/api/insights", careerInsightsRoutes);
app.use("/api/reports", reportRoutes);

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