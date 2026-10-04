const fs = require("fs");
const path = require("path");
const Material = require("../models/Material");
const { askGemini } = require("../utils/gemini");

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Read text out of an uploaded file (.txt, .md, .pdf)
const readFileText = async (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const buffer = fs.readFileSync(file.path);
  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text;
  }
  return buffer.toString("utf-8");
};

// Load a material and make sure the requester may access it
const getOwnedMaterial = async (req) => {
  const material = await Material.findById(req.params.id);
  if (!material) throw httpError(404, "Not found");
  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    throw httpError(403, "Access denied");
  }
  return material;
};

const clampCount = (value, fallback = 5) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, 1), 20);
};

// Parse a JSON array out of a Gemini reply (handles ```json fences and extra text)
const parseJsonArray = (raw) => {
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  try {
    if (start === -1 || end === -1) throw new Error("no array");
    const parsed = JSON.parse(clean.slice(start, end + 1));
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch {
    throw httpError(502, "AI returned an invalid response. Please try again.");
  }
};

// POST /api/materials/upload
const uploadMaterial = async (req, res) => {
  if (!req.file) throw httpError(400, "No file uploaded");

  try {
    const content = (await readFileText(req.file)).trim();
    if (!content) throw httpError(400, "Could not extract any text from the file");

    const material = await Material.create({
      user: req.user.userId,
      title: req.body.title || req.file.originalname,
      content,
      filename: req.file.originalname,
    });

    res.status(201).json({ message: "Material uploaded", material });
  } finally {
    // Always clean up the temp file, even if parsing or saving failed
    fs.unlink(req.file.path, () => {});
  }
};

// GET /api/materials
const getMaterials = async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { user: req.user.userId };
  const materials = await Material.find(filter)
    .select("-content -flashcards -quiz -studyPlan")
    .sort("-createdAt");
  res.json(materials);
};

// GET /api/materials/:id
const getMaterial = async (req, res) => {
  const material = await getOwnedMaterial(req);
  res.json(material);
};

// DELETE /api/materials/:id
const deleteMaterial = async (req, res) => {
  const material = await getOwnedMaterial(req);
  await material.deleteOne();
  res.json({ message: "Deleted" });
};

// POST /api/materials/:id/summarize
const summarize = async (req, res) => {
  const material = await getOwnedMaterial(req);

  const prompt = `Summarize the following study material clearly and concisely in bullet points:\n\n${material.content}`;
  const summary = await askGemini(prompt);

  material.summary = summary;
  await material.save();

  res.json({ summary });
};

// POST /api/materials/:id/flashcards
const generateFlashcards = async (req, res) => {
  const material = await getOwnedMaterial(req);
  const count = clampCount(req.body.count);

  const prompt = `
Create ${count} flashcards from the study material below.
Return ONLY valid JSON in this format, no extra text:
[{"question": "...", "answer": "..."}]

Study material:
${material.content}
`;

  const flashcards = parseJsonArray(await askGemini(prompt));

  material.flashcards = flashcards;
  await material.save();

  res.json({ flashcards });
};

// POST /api/materials/:id/quiz
const generateQuiz = async (req, res) => {
  const material = await getOwnedMaterial(req);
  const count = clampCount(req.body.count);

  const prompt = `
Create ${count} multiple choice quiz questions from the study material below.
Return ONLY valid JSON in this format, no extra text:
[{"question": "...", "options": ["A", "B", "C", "D"], "answer": "A"}]

Study material:
${material.content}
`;

  const quiz = parseJsonArray(await askGemini(prompt));

  material.quiz = quiz;
  await material.save();

  res.json({ quiz });
};

// POST /api/materials/:id/study-plan
const generateStudyPlan = async (req, res) => {
  const material = await getOwnedMaterial(req);

  const { goal, hoursPerDay, days } = req.body;

  const prompt = `
You are a study planner. Based on the study material below, create a personalized ${days || 7}-day study plan.
Student's goal: ${goal || "Understand and retain the material"}
Available study time: ${hoursPerDay || 2} hours per day.

Return a clear day-by-day schedule with topics and activities.

Study material:
${material.content}
`;

  const studyPlan = await askGemini(prompt);

  material.studyPlan = studyPlan;
  await material.save();

  res.json({ studyPlan });
};

module.exports = {
  uploadMaterial,
  getMaterials,
  getMaterial,
  deleteMaterial,
  summarize,
  generateFlashcards,
  generateQuiz,
  generateStudyPlan,
};
