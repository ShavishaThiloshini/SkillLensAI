const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const { initDb } = require("./database/initDb");

// Validate critical environment variables safely without leaking secrets
function validateEnvironment() {
  const warnings = [];
  if (!process.env.JWT_SECRET) {
    warnings.push("JWT_SECRET is not set in environment; using default fallback secret. Set JWT_SECRET for production.");
  }
  if (!process.env.DB_HOST || !process.env.DB_USER) {
    warnings.push("Database configuration variables (DB_HOST, DB_USER) may be incomplete.");
  }
  if (!process.env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY is not configured; AI features will operate using rule-based fallbacks.");
  }
  warnings.forEach((msg) => console.warn(`[Config Warning] ${msg}`));
  return warnings;
}
validateEnvironment();

const app = express();

// Security HTTP Headers with Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

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

// Explicit body size limits to prevent denial-of-service via large payload floods
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: true,
  message: {
    success: false,
    message: "Too many requests from this IP address, please try again after 15 minutes.",
  },
  skip: (req) => process.env.NODE_ENV === "test" && req.headers["x-test-skip-limit"] === "true",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: true,
  message: {
    success: false,
    message: "Too many authentication attempts from this IP address, please try again after 15 minutes.",
  },
  skip: (req) => process.env.NODE_ENV === "test" && req.headers["x-test-skip-limit"] === "true",
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: true,
  message: {
    success: false,
    message: "Too many AI analysis requests from this IP address, please try again later.",
  },
  skip: (req) => process.env.NODE_ENV === "test" && req.headers["x-test-skip-limit"] === "true",
});

// Apply rate limiting
app.use("/api", generalLimiter);

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

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/job-descriptions", jobRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);
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

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`SkillLens AI backend running on port ${PORT}`);
    // Attempt DB table verification asynchronously without blocking server startup
    try {
      await initDb();
    } catch (err) {
      console.warn("[DB] Initialization check skipped or deferred:", err.message);
    }
  });
}

module.exports = app;
