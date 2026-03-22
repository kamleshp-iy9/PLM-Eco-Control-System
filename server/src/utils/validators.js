const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('./errors');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map(e => e.msg).join(', ');
    throw new ValidationError(message);
  }
  next();
};

// Auth validators
const signupValidator = [
  body('loginId')
    .trim()
    .isLength({ min: 6, max: 12 })
    .withMessage('Login ID must be between 6-12 characters'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name must not exceed 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email address'),
  body('requestedRole')
    .optional()
    .isIn(['ENGINEERING_USER', 'APPROVER', 'OPERATIONS_USER'])
    .withMessage('Requested role must be Engineering User, Approver, or Operations User'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be more than 8 characters')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  handleValidationErrors,
];

const loginValidator = [
  body('loginId').trim().notEmpty().withMessage('Login ID is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const forgotPasswordValidator = [
  body('loginIdOrEmail').trim().notEmpty().withMessage('Login ID or Email is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be more than 8 characters')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),
  handleValidationErrors,
];

// Product validators
const createProductValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 255 })
    .withMessage('Product name must not exceed 255 characters'),
  body('salesPrice')
    .isFloat({ min: 0 })
    .withMessage('Sales price must be a positive number'),
  body('costPrice')
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a positive number'),
  handleValidationErrors,
];

// BoM validators
const createBomValidator = [
  body('productId').notEmpty().withMessage('Product is required'),
  body('quantity')
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('units').trim().notEmpty().withMessage('Units are required'),
  handleValidationErrors,
];

// ECO validators
const createEcoValidator = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('ecoType').isIn(['PRODUCT', 'BOM']).withMessage('Invalid ECO type'),
  body('productId').notEmpty().withMessage('Product is required'),
  body('userId').notEmpty().withMessage('User is required'),
  handleValidationErrors,
];

const updateEcoValidator = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  handleValidationErrors,
];

// Settings validators
const createStageValidator = [
  body('name').trim().notEmpty().withMessage('Stage name is required'),
  body('sequence').isInt({ min: 1 }).withMessage('Sequence must be a positive integer'),
  handleValidationErrors,
];

const createApprovalRuleValidator = [
  body('name').trim().notEmpty().withMessage('Approval rule name is required'),
  body('userId').notEmpty().withMessage('User is required'),
  body('approvalCategory').isIn(['REQUIRED', 'OPTIONAL', 'COMMENT_ONLY']).withMessage('Invalid approval category'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  signupValidator,
  loginValidator,
  forgotPasswordValidator,
  createProductValidator,
  createBomValidator,
  createEcoValidator,
  updateEcoValidator,
  createStageValidator,
  createApprovalRuleValidator,
};
