// Central place for secrets so .env can use either a single JWT_SECRET
// or separate JWT_ACCESS_SECRET / JWT_REFRESH_SECRET.
const accessSecret = () => process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

// If no separate refresh secret is set, derive one so an access token
// can never be used as a refresh token.
const refreshSecret = () =>
  process.env.JWT_REFRESH_SECRET ||
  (process.env.JWT_SECRET ? `${process.env.JWT_SECRET}:refresh` : undefined);

module.exports = { accessSecret, refreshSecret };
