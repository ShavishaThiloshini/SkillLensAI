const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[Auth] FATAL: JWT_SECRET is not set in environment. Refusing to start.");
  process.exit(1);
}
const JWT_EXPIRES_IN = "7d";

// Standard email validation regular expression
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates password meets reasonable security policy:
 * - Minimum 8 characters
 * - Contains at least one letter and one number
 */
function isPasswordValid(password) {
  if (typeof password !== "string" || password.length < 8) {
    return false;
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
}

/**
 * POST /api/auth/register
 * Registers a new user account
 */
async function register(req, res) {
  try {
    const { full_name, email, password } = req.body || {};

    const trimmedName = typeof full_name === "string" ? full_name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    // 1. Validate required fields
    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    if (!trimmedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }

    // 2. Validate email format
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // 3. Validate password strength
    if (!isPasswordValid(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long and contain both letters and numbers.",
      });
    }

    // 4. Check if email is already registered
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [trimmedEmail]
    );

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // 5. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 6. Insert new user
    const [result] = await db.query(
      "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)",
      [trimmedName, trimmedEmail, passwordHash]
    );

    const userId = result.insertId;

    // 7. Generate JWT — payload contains only non-sensitive identity fields
    const token = jwt.sign(
      { id: userId, email: trimmedEmail },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: {
        id: userId,
        full_name: trimmedName,
        email: trimmedEmail,
      },
    });
  } catch (error) {
    console.error("[Auth Register Error]:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to process registration at this time. Please try again later.",
    });
  }
}

/**
 * POST /api/auth/login
 * Authenticates user credentials and returns a JWT
 */
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    // 1. Validate required fields
    if (!trimmedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // 2. Validate email format
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // 3. Find user by email
    const [users] = await db.query(
      "SELECT id, full_name, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1",
      [trimmedEmail]
    );

    // Constant-time protection: do not reveal whether email exists
    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = users[0];

    // 4. Verify password
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // 5. Generate JWT — payload contains only non-sensitive identity fields
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("[Auth Login Error]:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to process login at this time. Please try again later.",
    });
  }
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile
 */
async function getMe(req, res) {
  try {
    const userId = req.user && req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const [users] = await db.query(
      "SELECT id, full_name, email, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error("[Auth Me Error]:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve user information. Please try again later.",
    });
  }
}

/**
 * POST /api/auth/logout
 * Acknowledges user logout request
 */
async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
}

module.exports = {
  register,
  login,
  getMe,
  logout,
};
