const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Extracts plain text from a stored PDF or DOCX file on the server filesystem.
 *
 * Requirements:
 * - Backend extraction only, safe buffers, graceful handling of empty/corrupted files.
 * - Does not execute files.
 * - Preserves line breaks and structure for downstream section analysis.
 *
 * @param {string} absoluteFilePath
 * @param {string} fileType - 'PDF' or 'DOCX'
 * @returns {Promise<{ success: boolean, text: string, charCount: number, error?: string }>}
 */
async function extractDocumentText(absoluteFilePath, fileType) {
  if (!fs.existsSync(absoluteFilePath)) {
    return {
      success: false,
      text: "",
      charCount: 0,
      error: "Document file not found on disk.",
    };
  }

  let stats;
  try {
    stats = fs.statSync(absoluteFilePath);
  } catch (err) {
    return {
      success: false,
      text: "",
      charCount: 0,
      error: `Unable to read file status: ${err.message}`,
    };
  }

  if (stats.size === 0) {
    return {
      success: false,
      text: "",
      charCount: 0,
      error: "File is empty (0 bytes).",
    };
  }

  const normalizedType = (fileType || "").toUpperCase();

  try {
    if (normalizedType === "PDF") {
      const dataBuffer = fs.readFileSync(absoluteFilePath);
      // Validate PDF signature
      if (dataBuffer.length < 5 || dataBuffer.toString("ascii", 0, 4) !== "%PDF") {
        return {
          success: false,
          text: "",
          charCount: 0,
          error: "Corrupted or invalid PDF header structure.",
        };
      }

      let rawText = "";
      if (typeof pdfParse === "function") {
        const pdfData = await pdfParse(dataBuffer);
        rawText = pdfData?.text || "";
      } else if (pdfParse && typeof pdfParse.PDFParse === "function") {
        const parser = new pdfParse.PDFParse({ data: dataBuffer });
        try {
          const result = await parser.getText({ pageJoiner: "" });
          rawText = result?.text || "";
        } finally {
          try {
            await parser.destroy();
          } catch (_) {}
        }
      } else {
        throw new Error("PDF parser library could not be initialized.");
      }

      const cleaned = cleanExtractedText(rawText);

      if (!cleaned || cleaned.trim().length === 0) {
        return {
          success: false,
          text: "",
          charCount: 0,
          error: "PDF contains no extractable text (it may be an image-only scan or encrypted).",
        };
      }

      return {
        success: true,
        text: cleaned,
        charCount: cleaned.length,
      };
    } else if (normalizedType === "DOCX") {
      const result = await mammoth.extractRawText({ path: absoluteFilePath });
      const rawText = result?.value || "";
      const cleaned = cleanExtractedText(rawText);

      if (!cleaned || cleaned.trim().length === 0) {
        return {
          success: false,
          text: "",
          charCount: 0,
          error: "DOCX contains no extractable text.",
        };
      }

      return {
        success: true,
        text: cleaned,
        charCount: cleaned.length,
      };
    } else {
      return {
        success: false,
        text: "",
        charCount: 0,
        error: `Unsupported document type: ${fileType}. Only PDF and DOCX are supported.`,
      };
    }
  } catch (error) {
    // Gracefully catch parser errors (e.g. encrypted PDFs, malformed ZIP entries)
    return {
      success: false,
      text: "",
      charCount: 0,
      error: `Failed to extract text from document: ${error.message}`,
    };
  }
}

/**
 * Normalizes document text while preserving paragraph and line boundaries.
 *
 * @param {string} text
 * @returns {string}
 */
function cleanExtractedText(text) {
  if (!text) return "";

  return text
    // Normalize Windows/Mac line endings to \n
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Replace non-breaking spaces and unusual whitespace with standard space
    .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
    // Remove null bytes and non-printable control chars except \n and \t
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Collapse multiple horizontal spaces/tabs into a single space
    .replace(/[ \t]+/g, " ")
    // Collapse 3 or more blank lines into 2 blank lines (preserving paragraph structure)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = {
  extractDocumentText,
  cleanExtractedText,
};
