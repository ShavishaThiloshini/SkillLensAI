const fs = require("fs");
const path = require("path");

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

/**
 * Validates the internal structure of an Office Open XML (.docx) package.
 * A genuine .docx document is a ZIP archive containing:
 * - [Content_Types].xml
 * - word/ directory (e.g. word/document.xml)
 *
 * @param {Buffer} buf
 * @returns {boolean}
 */
function isValidDocxBuffer(buf) {
  if (!buf || buf.length < 30) return false;

  // Must begin with ZIP local file header signature PK\x03\x04
  if (buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) {
    return false;
  }

  let hasContentTypes = false;
  let hasWordDir = false;
  let pos = 0;

  // Scan headers across buffer safely
  while (pos < buf.length - 30) {
    const sig = buf.readUInt32LE(pos);

    // 0x04034b50 -> Local file header (PK\x03\x04)
    if (sig === 0x04034b50) {
      if (pos + 30 > buf.length) break;
      const compSize = buf.readUInt32LE(pos + 18);
      const nameLen = buf.readUInt16LE(pos + 26);
      const extraLen = buf.readUInt16LE(pos + 28);

      if (pos + 30 + nameLen > buf.length) break;
      const filename = buf.toString("utf8", pos + 30, pos + 30 + nameLen);

      if (filename === "[Content_Types].xml") hasContentTypes = true;
      if (filename.startsWith("word/")) hasWordDir = true;

      pos += 30 + nameLen + extraLen + compSize;
    }
    // 0x02014b50 -> Central directory header (PK\x01\x02)
    else if (sig === 0x02014b50) {
      if (pos + 46 > buf.length) break;
      const nameLen = buf.readUInt16LE(pos + 28);
      const extraLen = buf.readUInt16LE(pos + 30);
      const commentLen = buf.readUInt16LE(pos + 32);

      if (pos + 46 + nameLen > buf.length) break;
      const filename = buf.toString("utf8", pos + 46, pos + 46 + nameLen);

      if (filename === "[Content_Types].xml") hasContentTypes = true;
      if (filename.startsWith("word/")) hasWordDir = true;

      pos += 46 + nameLen + extraLen + commentLen;
    } else {
      pos++;
    }

    if (hasContentTypes && hasWordDir) {
      return true;
    }
  }

  return hasContentTypes && hasWordDir;
}

/**
 * Validates the internal structure of a PDF document.
 * Checks for PDF header (%PDF-) within the first 1024 bytes.
 *
 * @param {Buffer} buf
 * @returns {boolean}
 */
function isValidPdfBuffer(buf) {
  if (!buf || buf.length < 5) return false;

  // Standard PDF magic byte signature: %PDF-
  const header = buf.subarray(0, Math.min(buf.length, 1024)).toString("ascii");
  return header.includes("%PDF-");
}

/**
 * Validates an uploaded resume file on disk.
 *
 * @param {string} filePath - Absolute path to uploaded file on server
 * @param {string} originalname - Original client-side filename
 * @returns {{ isValid: boolean, message?: string, fileType?: 'PDF' | 'DOCX', fileSize?: number }}
 */
function validateResumeFile(filePath, originalname) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      isValid: false,
      message: "Uploaded file could not be found on server storage.",
    };
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  // 1. Check for empty files
  if (fileSize === 0) {
    return {
      isValid: false,
      message: "The uploaded file is empty (0 bytes). Please upload a valid document.",
    };
  }

  // 2. Check file size limit (5 MB)
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      message: `File size exceeds the 5 MB limit. (Actual size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB)`,
    };
  }

  // 3. Check extension
  const ext = path.extname(originalname || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      message: "Unsupported file format. Only PDF (.pdf) and Microsoft Word (.docx) documents are accepted.",
    };
  }

  // 4. Inspect file content / magic bytes
  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(filePath);
  } catch (readErr) {
    return {
      isValid: false,
      message: "Unable to read the uploaded document for validation.",
    };
  }

  if (ext === ".pdf") {
    if (!isValidPdfBuffer(fileBuffer)) {
      return {
        isValid: false,
        message: "Invalid PDF document. File content does not match the PDF standard specification.",
      };
    }
    return { isValid: true, fileType: "PDF", fileSize };
  }

  if (ext === ".docx") {
    if (!isValidDocxBuffer(fileBuffer)) {
      return {
        isValid: false,
        message: "Invalid DOCX document. File is corrupted or not a valid Office Open XML Word document.",
      };
    }
    return { isValid: true, fileType: "DOCX", fileSize };
  }

  return {
    isValid: false,
    message: "Document validation failed.",
  };
}

module.exports = {
  validateResumeFile,
  isValidPdfBuffer,
  isValidDocxBuffer,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
};
