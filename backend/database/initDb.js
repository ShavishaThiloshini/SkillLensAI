const db = require("../config/db");

/**
 * Initializes required database tables if they do not exist.
 * Includes users, resumes, resume_sections, skills, resume_skills, and jobs
 * adhering to docs/DATABASE_SCHEMA.md.
 *
 * Day 15: Added `jobs` table for job description input.
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

  const createResumesTableQuery = `
    CREATE TABLE IF NOT EXISTS resumes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      stored_filename VARCHAR(255) NOT NULL,
      file_type VARCHAR(20) NOT NULL,
      file_size BIGINT NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      extracted_text LONGTEXT NULL,
      processing_status ENUM('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'UPLOADED',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_resumes_user_id (user_id),
      CONSTRAINT fk_resumes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const createResumeSectionsTableQuery = `
    CREATE TABLE IF NOT EXISTS resume_sections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      resume_id INT NOT NULL,
      section_type VARCHAR(50) NOT NULL,
      section_content LONGTEXT NOT NULL,
      display_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sections_resume_id (resume_id),
      CONSTRAINT fk_sections_resume FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const createSkillsTableQuery = `
    CREATE TABLE IF NOT EXISTS skills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      category VARCHAR(50) NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const createResumeSkillsTableQuery = `
    CREATE TABLE IF NOT EXISTS resume_skills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      resume_id INT NOT NULL,
      skill_id INT NOT NULL,
      proficiency ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'UNKNOWN') DEFAULT 'UNKNOWN',
      evidence TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rs_resume_id (resume_id),
      INDEX idx_rs_skill_id (skill_id),
      UNIQUE KEY uq_resume_skill (resume_id, skill_id),
      CONSTRAINT fk_rs_resume FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,
      CONSTRAINT fk_rs_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const createJobsTableQuery = `
    CREATE TABLE IF NOT EXISTS jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      company VARCHAR(200) NULL,
      description LONGTEXT NOT NULL,
      source_type ENUM('PASTED_TEXT', 'UPLOADED_FILE') NOT NULL,
      processing_status ENUM('COMPLETED', 'FAILED') NOT NULL DEFAULT 'COMPLETED',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_jobs_user_id (user_id),
      CONSTRAINT fk_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await db.query(createUsersTableQuery);
    console.log("[DB] `users` table verified/created successfully.");

    await db.query(createResumesTableQuery);
    console.log("[DB] `resumes` table verified/created successfully.");

    await db.query(createResumeSectionsTableQuery);
    console.log("[DB] `resume_sections` table verified/created successfully.");

    await db.query(createSkillsTableQuery);
    console.log("[DB] `skills` table verified/created successfully.");

    await db.query(createResumeSkillsTableQuery);
    console.log("[DB] `resume_skills` table verified/created successfully.");

    await db.query(createJobsTableQuery);
    console.log("[DB] `jobs` table verified/created successfully.");

    return true;
  } catch (error) {
    console.error("[DB] Failed to initialize database tables:", error.message);
    return false;
  }
}

module.exports = { initDb };
