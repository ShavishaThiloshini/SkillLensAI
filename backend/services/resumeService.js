const path = require("path");
const fs = require("fs");
const db = require("../config/db");
const { extractDocumentText } = require("../utils/documentParser");
const { parseResumeText } = require("../utils/resumeParser");

/**
 * Service orchestrating resume retrieval, parsing, structured extraction,
 * and database persistence.
 */
class ResumeService {
  /**
   * Processes an uploaded resume:
   * 1. Verifies ownership and existence.
   * 2. Sets processing_status to 'PROCESSING'.
   * 3. Extracts text using pdf-parse or mammoth.
   * 4. Parses structured sections, candidate info, skills, education, experience, projects, certifications.
   * 5. Saves raw extracted text and structured data in MySQL using a transaction.
   * 6. Updates processing_status to 'COMPLETED' or 'FAILED'.
   *
   * @param {number} resumeId
   * @param {number} userId
   * @returns {Promise<{ success: boolean, resumeId: number, status: string, structuredData?: Object, message?: string }>}
   */
  static async extractResume(resumeId, userId) {
    if (!resumeId || !userId) {
      throw new Error("Resume ID and User ID are required.");
    }

    // 1. Fetch resume record
    const [resumes] = await db.query(
      `SELECT id, user_id, original_filename, stored_filename, file_type, file_size, file_path, processing_status, extracted_text
       FROM resumes
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [resumeId, userId]
    );

    if (!resumes || resumes.length === 0) {
      const err = new Error("Resume not found or access denied.");
      err.status = 404;
      throw err;
    }

    const resume = resumes[0];

    // Determine absolute storage path safely on the server
    const absolutePath = path.resolve(__dirname, "..", resume.file_path);

    if (!fs.existsSync(absolutePath)) {
      await db.query(
        `UPDATE resumes SET processing_status = 'FAILED' WHERE id = ?`,
        [resumeId]
      );
      const err = new Error("Stored resume document could not be found on the server filesystem.");
      err.status = 404;
      throw err;
    }

    // 2. Transition state to 'PROCESSING'
    await db.query(
      `UPDATE resumes SET processing_status = 'PROCESSING' WHERE id = ?`,
      [resumeId]
    );

    // 3. Extract text from document
    const extractionResult = await extractDocumentText(absolutePath, resume.file_type);

    if (!extractionResult.success) {
      await db.query(
        `UPDATE resumes SET processing_status = 'FAILED' WHERE id = ?`,
        [resumeId]
      );
      return {
        success: false,
        resumeId,
        status: "FAILED",
        message: extractionResult.error || "Text extraction failed.",
      };
    }

    const rawText = extractionResult.text;

    // 4. Parse text into structured resume sections and fields
    const parsedData = parseResumeText(rawText);

    // 5. Atomic database transaction to persist structured results
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Update resume with extracted text and COMPLETED status
      await connection.query(
        `UPDATE resumes
         SET extracted_text = ?, processing_status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [rawText, resumeId]
      );

      // Clean up any previously extracted sections for this resume (supporting safe idempotency / retry)
      await connection.query(
        `DELETE FROM resume_sections WHERE resume_id = ?`,
        [resumeId]
      );

      // Insert extracted sections
      if (parsedData.sections && parsedData.sections.length > 0) {
        const sectionValues = parsedData.sections.map((sec) => [
          resumeId,
          sec.section_type,
          sec.section_content,
          sec.display_order,
        ]);

        await connection.query(
          `INSERT INTO resume_sections (resume_id, section_type, section_content, display_order) VALUES ?`,
          [sectionValues]
        );
      }

      // Clean up previous resume_skills for idempotent re-runs
      await connection.query(
        `DELETE FROM resume_skills WHERE resume_id = ?`,
        [resumeId]
      );

      // Upsert skills in skills catalog and link to resume_skills
      if (parsedData.skills && parsedData.skills.length > 0) {
        for (const skill of parsedData.skills) {
          // Insert skill into skills catalogue if not exists
          await connection.query(
            `INSERT INTO skills (name, category)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE category = VALUES(category)`,
            [skill.name, skill.category]
          );

          // Retrieve skill id
          const [skillRow] = await connection.query(
            `SELECT id FROM skills WHERE name = ? LIMIT 1`,
            [skill.name]
          );

          if (skillRow && skillRow.length > 0) {
            const skillId = skillRow[0].id;
            await connection.query(
              `INSERT INTO resume_skills (resume_id, skill_id, proficiency, evidence)
               VALUES (?, ?, 'UNKNOWN', ?)
               ON DUPLICATE KEY UPDATE evidence = VALUES(evidence)`,
              [resumeId, skillId, skill.evidence || null]
            );
          }
        }
      }

      await connection.commit();

      return {
        success: true,
        resumeId,
        status: "COMPLETED",
        message: "Resume extracted and structured information parsed successfully.",
        structuredData: parsedData,
      };
    } catch (dbError) {
      await connection.rollback();
      // Record failure state
      await db.query(
        `UPDATE resumes SET processing_status = 'FAILED' WHERE id = ?`,
        [resumeId]
      );
      throw dbError;
    } finally {
      connection.release();
    }
  }

  /**
   * Retrieves full details and extracted structured information for a resume.
   *
   * @param {number} resumeId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async getResumeWithExtraction(resumeId, userId) {
    const [resumes] = await db.query(
      `SELECT id, user_id, original_filename, file_type, file_size, processing_status, extracted_text, created_at, updated_at
       FROM resumes
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [resumeId, userId]
    );

    if (!resumes || resumes.length === 0) {
      return null;
    }

    const resume = resumes[0];

    // If extracted_text is present, parse it to deliver the structured views
    let structured = null;
    if (resume.extracted_text) {
      structured = parseResumeText(resume.extracted_text);
    }

    // Retrieve database stored sections
    const [sections] = await db.query(
      `SELECT section_type, section_content, display_order
       FROM resume_sections
       WHERE resume_id = ?
       ORDER BY display_order ASC`,
      [resumeId]
    );

    // Retrieve database stored skills
    const [skills] = await db.query(
      `SELECT s.id, s.name, s.category, rs.proficiency, rs.evidence
       FROM resume_skills rs
       JOIN skills s ON rs.skill_id = s.id
       WHERE rs.resume_id = ?
       ORDER BY s.category ASC, s.name ASC`,
      [resumeId]
    );

    return {
      ...resume,
      sections: sections || [],
      skills: skills || (structured?.skills || []),
      structuredData: structured,
    };
  }
}

module.exports = ResumeService;
