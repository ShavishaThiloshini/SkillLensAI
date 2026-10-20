const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Job description uploads are temporary — extracted text is saved; original file is deleted
const JOB_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "job_descriptions");

// Ensure upload directory exists synchronously
if (!fs.existsSync(JOB_UPLOAD_DIR)) {
  fs.mkdirSync(JOB_UPLOAD_DIR, { recursive: true });
}

// Multer disk storage with UUID-based safe server filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, JOB_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname || "").toLowerCase();
    const safeExt = rawExt === ".pdf" || rawExt === ".docx" ? rawExt : ".bin";
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const generatedFilename = `job-${uniqueSuffix}${safeExt}`;
    cb(null, generatedFilename);
  },
});

// Preliminary filter for incoming multipart stream
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowed = [".pdf", ".docx"];

  if (!allowed.includes(ext)) {
    return cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "Only PDF (.pdf) and Microsoft Word (.docx) files are supported for job descriptions."
      ),
      false
    );
  }

  cb(null, true);
};

// 5 MB limit, consistent with resume uploads
const jobUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});

const jobUploadMiddleware = jobUpload.single("jobDescription");

/**
 * Express error-handling middleware for job description Multer errors
 */
function handleJobUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size exceeds the 5 MB limit. Please upload a smaller document.",
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: err.message || "Invalid upload. Please use field name 'jobDescription' with a PDF or DOCX file.",
      });
    }

    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed.",
    });
  }

  next();
}

module.exports = {
  jobUploadMiddleware,
  handleJobUploadError,
  JOB_UPLOAD_DIR,
};
