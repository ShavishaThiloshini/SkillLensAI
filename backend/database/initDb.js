const db = require("../config/db");

/**
 * Initializes required database tables if they do not exist.
 */
async function initDb() {
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await db.query(createUsersTableQuery);
    console.log("[DB] `users` table verified/created successfully.");
    return true;
  } catch (error) {
    console.error("[DB] Failed to initialize `users` table:", error.message);
    return false;
  }
}

module.exports = { initDb };
