const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const caPath = path.join(__dirname, "..", "ca.pem");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: {
    ca: fs.readFileSync(caPath),
    rejectUnauthorized: true,
  },

  // Keep-alive: prevents Aiven from silently closing idle connections
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 s

  // Discard connections that have been idle too long
  // (Aiven default timeout is ~3600 s; we recycle at 1800 s)
  idleTimeout: 1800000, // 30 min

  // Connection attempt timeout
  connectTimeout: 20000, // 20 s

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;