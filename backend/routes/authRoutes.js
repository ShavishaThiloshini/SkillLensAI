const express = require("express");
const router = express.Router();

const { register, login, getMe, logout } = require("../controllers/authController");
const authenticateToken = require("../middleware/authMiddleware");

// Public endpoints
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// Protected endpoint
router.get("/me", authenticateToken, getMe);

module.exports = router;
