const jwt = require("jsonwebtoken");
const { accessSecret, refreshSecret } = require("./config");

const generateTokens = (userId, role) => {
  const payload = { userId: String(userId), role };
  const accessToken = jwt.sign(payload, accessSecret(), { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload, refreshSecret(), { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

module.exports = { generateTokens };
