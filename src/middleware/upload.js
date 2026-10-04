const multer = require("multer");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [".txt", ".md", ".pdf"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    const err = new Error("Only .txt, .md, and .pdf files are allowed");
    err.status = 400;
    cb(err);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

module.exports = upload;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
