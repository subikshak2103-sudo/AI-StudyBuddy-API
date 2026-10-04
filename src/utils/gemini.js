const { GoogleGenerativeAI } = require("@google/generative-ai");

let model;

// Created lazily so the server can start without a Gemini key;
// only the AI endpoints need it.
const getModel = () => {
  if (!model) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.startsWith("<")) {
      throw Object.assign(
        new Error("GEMINI_API_KEY is not set in .env. AI features are unavailable."),
        { status: 503 }
      );
    }
    const genAI = new GoogleGenerativeAI(key);
    model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
  }
  return model;
};

const askGemini = async (prompt) => {
  const result = await getModel().generateContent(prompt);
  return result.response.text();
};

module.exports = { askGemini };
