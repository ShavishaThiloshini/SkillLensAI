const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "skilllens_ai_jwt_secret_key_development_2026";

/**
 * SkillLens AI — Authentication Middleware
 * Validates JSON Web Token in the Authorization header.
 * Expects: Authorization: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No authentication token provided.",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      const isExpired = err.name === "TokenExpiredError";
      return res.status(401).json({
        success: false,
        message: isExpired ? "Session expired. Please log in again." : "Invalid authentication token.",
      });
    }

    req.user = decoded;
    next();
  });
}

module.exports = authenticateToken;
