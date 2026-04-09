const { body, validationResult } = require('express-validator');

/**
 * Validation rules for the registration endpoint.
 */
const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be under 100 characters')
    .escape(),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?\d{8,15}$/).withMessage('Please enter a valid phone number (8-15 digits)'),

  body('dateOfBirth')
    .trim()
    .notEmpty().withMessage('Date of birth is required')
    .isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom((value) => {
      const dob = new Date(value);
      const now = new Date();
      if (dob >= now) throw new Error('Date of birth must be in the past');
      const minDate = new Date('1900-01-01');
      if (dob < minDate) throw new Error('Date of birth must be after 1900');
      return true;
    }),
];

/**
 * Validation rules for resend-verification endpoint.
 */
const resendRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),
];

/**
 * Middleware that checks validation results and returns 400 if invalid.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

/**
 * Validation rules for login endpoint.
 */
const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),
];

module.exports = { registerRules, resendRules, loginRules, validate };
