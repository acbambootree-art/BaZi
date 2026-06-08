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

/**
 * Validation rules for the Focused Decision Reading order endpoint.
 */
const decisionReadingRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be under 100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^\+?[\d\s-]{6,20}$/).withMessage('Please enter a valid phone number'),

  body('question')
    .trim()
    .notEmpty().withMessage('Please describe your question')
    .isLength({ min: 5, max: 2000 }).withMessage('Question must be 5–2000 characters'),

  body('language')
    .optional()
    .isIn(['en', 'zh', 'both']).withMessage('Invalid language选项'),

  body('paymentMethod')
    .isIn(['stripe', 'paynow']).withMessage('Invalid payment method'),

  body('birthYear').optional({ values: 'falsy' }).isInt({ min: 1900, max: 2100 }),
  body('birthMonth').optional({ values: 'falsy' }).isInt({ min: 1, max: 12 }),
  body('birthDay').optional({ values: 'falsy' }).isInt({ min: 1, max: 31 }),
  body('birthHour').optional({ values: 'falsy' }).isInt({ min: -1, max: 11 }),
  body('gender').optional({ values: 'falsy' }).isIn(['male', 'female']),
  body('chartSummary').optional({ values: 'falsy' }).isLength({ max: 2000 }),
];

module.exports = { registerRules, resendRules, loginRules, decisionReadingRules, validate };
