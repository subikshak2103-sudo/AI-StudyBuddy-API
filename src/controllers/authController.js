const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { generateTokens } = require("../utils/tokens");
const { refreshSecret } = require("../utils/config");

const httpError = (status, message) => Object.assign(new Error(message), { status });

// POST /api/auth/register
const register = async (req, res) => {
  const { name, email, password, role, adminKey } = req.body;

  if (!name || !email || !password) throw httpError(400, "name, email and password are required");
  if (typeof password !== "string" || password.length < 6) {
    throw httpError(400, "Password must be at least 6 characters");
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) throw httpError(400, "Email already in use");

  // Never trust a client-supplied role: admin requires the secret key from .env
  const isAdmin =
    role === "admin" && process.env.ADMIN_REGISTRATION_KEY && adminKey === process.env.ADMIN_REGISTRATION_KEY;

  const user = await User.create({ name, email, password, role: isAdmin ? "admin" : "student" });
  const { accessToken, refreshToken } = generateTokens(user._id, user.role);

  res.status(201).json({
    message: "Registered successfully",
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, role: user.role },
  });
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw httpError(400, "email and password are required");

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await user.matchPassword(password))) {
    throw httpError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = generateTokens(user._id, user.role);

  res.json({
    message: "Logged in",
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, role: user.role },
  });
};

// POST /api/auth/refresh
// Client must send the refresh token in the x-refresh-token header
const refresh = async (req, res) => {
  const token = req.headers["x-refresh-token"];
  if (!token) throw httpError(401, "No refresh token");

  let decoded;
  try {
    decoded = jwt.verify(token, refreshSecret());
  } catch {
    throw httpError(401, "Invalid refresh token");
  }

  // Make sure the user still exists and use their current role
  const user = await User.findById(decoded.userId);
  if (!user) throw httpError(401, "Invalid refresh token");

  const tokens = generateTokens(user._id, user.role);
  res.json({ message: "Tokens refreshed", ...tokens });
};

// POST /api/auth/logout
// Stateless — client just discards the tokens
const logout = (req, res) => {
  res.json({ message: "Logged out" });
};

module.exports = { register, login, refresh, logout };
