const crypto = require('crypto');

/**
 * Generate a cryptographically secure verification token.
 * Returns { token, expiresAt } where expiresAt is 24 hours from now.
 */
function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return { token, expiresAt };
}

/**
 * Generate a session token valid for 30 days.
 */
function generateSessionToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { token, expiresAt };
}

/**
 * Check if a token expiry date is still valid.
 */
function isTokenValid(expiresAt) {
  return new Date(expiresAt) > new Date();
}

module.exports = { generateToken, generateSessionToken, isTokenValid };
