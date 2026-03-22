// ─── Auth controller ──────────────────────────────────────────────────────────
// Handles user registration, login, token refresh, profile fetch, and
// self-service password reset.
//
// All new users start as PENDING_APPROVAL — an admin must activate them before
// they can log in. This prevents strangers from just signing up and getting in.

const bcrypt = require('bcryptjs');
const { PrismaClient, AccountStatus, Role } = require('@prisma/client');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { ValidationError, UnauthorizedError, NotFoundError } = require('../utils/errors');

const prisma = new PrismaClient();

// ─── signup ───────────────────────────────────────────────────────────────────
// Creates a new user account. The account sits in PENDING_APPROVAL until an
// admin reviews it — no tokens are issued here.
const signup = async (req, res, next) => {
  try {
    const {
      loginId,
      name,
      email,
      password,
      requestedRole = Role.ENGINEERING_USER, // default role if none requested
    } = req.body;

    // Admin role can never be self-assigned — only an existing admin can grant it
    if (requestedRole === Role.ADMIN) {
      throw new ValidationError('Admin role cannot be requested during signup');
    }

    // Ensure loginId is unique — this is what the user types on the login screen
    const existingLoginId = await prisma.user.findUnique({
      where: { loginId },
    });
    if (existingLoginId) {
      throw new ValidationError('Login ID already exists');
    }

    // Ensure email is unique — used for password reset and audit trail
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ValidationError('Email already exists');
    }

    // Hash the password with bcrypt (10 salt rounds is the industry-standard balance
    // between security and performance)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user — account is PENDING_APPROVAL until an admin activates it
    const user = await prisma.user.create({
      data: {
        loginId,
        name,
        email,
        password: hashedPassword,
        role: requestedRole,
        requestedRole, // stored so admin can see what role was requested
        accountStatus: AccountStatus.PENDING_APPROVAL,
      },
      select: {
        id: true,
        loginId: true,
        name: true,
        email: true,
        role: true,
        requestedRole: true,
        accountStatus: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully and is waiting for admin approval',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ─── login ────────────────────────────────────────────────────────────────────
// Validates credentials and issues a short-lived access token + long-lived
// refresh token. We intentionally use the same error message for "user not found"
// and "wrong password" to avoid leaking whether a loginId exists.
const login = async (req, res, next) => {
  try {
    const { loginId, password } = req.body;

    // Look up the user by their loginId (not email — loginId is the primary identifier)
    const user = await prisma.user.findUnique({
      where: { loginId },
    });

    // Return the same vague error whether the loginId doesn't exist or the password is wrong
    if (!user) {
      throw new UnauthorizedError('Invalid Login Id or Password');
    }

    // Block access based on account status — each case has a specific message
    if (user.accountStatus === AccountStatus.PENDING_APPROVAL) {
      throw new UnauthorizedError('Your account is pending admin approval');
    }

    if (user.accountStatus === AccountStatus.REJECTED) {
      throw new UnauthorizedError(
        user.rejectionReason
          ? `Your account request was rejected: ${user.rejectionReason}`
          : 'Your account request was rejected. Please contact an administrator.'
      );
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new UnauthorizedError('Your account is suspended. Please contact an administrator.');
    }

    // Compare the submitted password against the stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid Login Id or Password');
    }

    // Both tokens are signed with separate secrets — if one leaks it doesn't compromise the other
    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          loginId: user.loginId,
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── refresh ──────────────────────────────────────────────────────────────────
// Exchanges a valid refresh token for a new access + refresh token pair.
// The frontend calls this silently before the access token expires.
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }

    // Verify the refresh token — throws if expired or tampered
    const decoded = verifyRefreshToken(refreshToken);

    // Re-fetch the user to ensure they haven't been suspended since the token was issued
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedError('User account is not active');
    }

    // Issue a fresh token pair — old refresh token becomes invalid on the client
    const tokens = generateTokens(user);

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── getMe ────────────────────────────────────────────────────────────────────
// Returns the current user's profile. Used by the frontend to hydrate the
// auth store on page load or after a token refresh.
const getMe = async (req, res, next) => {
  try {
    // req.user.id is set by the authenticate middleware
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        loginId: true,
        name: true,
        email: true,
        role: true,
        requestedRole: true,   // what role they asked for at signup
        approvedRole: true,    // what role the admin actually gave them
        accountStatus: true,
        approvedAt: true,
        rejectionReason: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ─── forgotPassword ───────────────────────────────────────────────────────────
// Self-service password reset — no email link, just supply a new password directly.
// Accepts either loginId or email so the user isn't locked out if they forget one.
const forgotPassword = async (req, res, next) => {
  try {
    const { loginIdOrEmail, newPassword } = req.body;

    // Look up by either loginId or email using Prisma's OR filter
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { loginId: loginIdOrEmail },
          { email: loginIdOrEmail },
        ],
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Hash the new password before storing it
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  refresh,
  getMe,
  forgotPassword,
};
