// ─── Admin controller ──────────────────────────────────────────────────────────
// Only admins can reach these endpoints (enforced by requireAdmin middleware in
// admin.routes.js). Handles user listing, approval, rejection, and role changes.
//
// Key design decision: when a new APPROVER is activated, we automatically create
// an ApprovalRule for them in the Approval stage so they're ready to review ECOs
// without the admin having to configure it separately.

const { PrismaClient, AccountStatus, Role, ApprovalCategory } = require('@prisma/client');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { createAuditLog } = require('../services/audit.service');

const prisma = new PrismaClient();

// ─── Helper: find the Approval stage ──────────────────────────────────────────
// Used when auto-creating approval rules for new APPROVER users.
// Looks for a stage named "Approval" or "Validated" — picks the earliest one.
const getApprovalStage = async (tx = prisma) =>
  tx.ecoStage.findFirst({
    where: {
      name: {
        in: ['Approval', 'Validated'],
      },
    },
    orderBy: { sequence: 'asc' },
  });

// Fields returned for every user in admin responses — password is never included
const userSelect = {
  id: true,
  loginId: true,
  name: true,
  email: true,
  role: true,
  requestedRole: true,
  approvedRole: true,
  accountStatus: true,
  approvedBy: true,
  approvedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
};

// ─── getUsers ─────────────────────────────────────────────────────────────────
// Lists all users with optional filters: status, role, and a text search across
// loginId, name, and email. Results are sorted with pending users first (so
// the admin sees the approval queue at the top).
const getUsers = async (req, res, next) => {
  try {
    const { status, role, search } = req.query;

    const where = {};

    if (status) where.accountStatus = status;
    if (role) where.role = role;
    if (search) {
      // Case-insensitive partial match on any of the three identifier fields
      where.OR = [
        { loginId: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        ...userSelect,
        // Also include who approved/rejected this user (for display in the admin panel)
        approvedByUser: {
          select: {
            id: true,
            name: true,
            loginId: true,
          },
        },
      },
      orderBy: [
        { accountStatus: 'asc' },  // PENDING_APPROVAL sorts before ACTIVE alphabetically
        { createdAt: 'desc' },     // newest users first within each status group
      ],
    });

    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

// ─── getUserById ──────────────────────────────────────────────────────────────
// Fetches a single user by their UUID. Used when the admin clicks into a user
// detail view.
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        approvedByUser: {
          select: {
            id: true,
            name: true,
            loginId: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ─── updateRequestedRole ──────────────────────────────────────────────────────
// Lets the admin change what role a PENDING user is requesting before approving them.
// Only works on PENDING users — once approved the role is set via approveUser.
const updateRequestedRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { requestedRole } = req.body;

    if (!requestedRole) {
      throw new ValidationError('Requested role is required');
    }

    // Admin role can never be assigned through the approval queue
    if (!Object.values(Role).includes(requestedRole) || requestedRole === Role.ADMIN) {
      throw new ValidationError('Requested role must be Engineering User, Approver, or Operations User');
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Only makes sense to change the requested role while the account is still pending
    if (user.accountStatus !== AccountStatus.PENDING_APPROVAL) {
      throw new ValidationError('Requested role can only be changed for pending users');
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        requestedRole,
        role: requestedRole, // keep role field in sync with requestedRole for pending users
      },
      select: {
        ...userSelect,
        approvedByUser: {
          select: {
            id: true,
            name: true,
            loginId: true,
          },
        },
      },
    });

    // Log the change so it shows up in the audit trail
    await createAuditLog({
      action: 'USER_REQUEST_ROLE_UPDATED',
      entityType: 'User',
      entityId: updatedUser.id,
      oldValue: {
        requestedRole: user.requestedRole,
        role: user.role,
      },
      newValue: {
        requestedRole: updatedUser.requestedRole,
        role: updatedUser.role,
      },
      userId: req.user.id,
    });

    res.json({
      success: true,
      message: 'Requested role updated successfully',
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

// ─── approveUser ──────────────────────────────────────────────────────────────
// Activates a PENDING user and grants them the requested (or overridden) role.
// If the role is APPROVER, we auto-create an ApprovalRule in the Approval stage
// so the new approver appears in the ECO approval queue without extra setup.
// The whole thing runs in a transaction so either both writes succeed or neither does.
const approveUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body; // admin can override the requested role at approval time

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.accountStatus !== AccountStatus.PENDING_APPROVAL) {
      throw new ValidationError('Only pending users can be approved');
    }

    // Determine the final role: use the body override if provided, else the requested role,
    // else default to ENGINEERING_USER
    const finalRole = role || user.requestedRole || Role.ENGINEERING_USER;
    if (finalRole === Role.ADMIN) {
      throw new ValidationError('Admin role cannot be assigned through the approval queue');
    }

    const approvedUser = await prisma.$transaction(async (tx) => {
      // Activate the user and record who approved them and when
      const nextUser = await tx.user.update({
        where: { id },
        data: {
          role: finalRole,
          approvedRole: finalRole,              // permanent record of what was approved
          accountStatus: AccountStatus.ACTIVE,
          approvedBy: req.user.id,              // the admin's user ID
          approvedAt: new Date(),
          rejectionReason: null,                // clear any previous rejection reason
        },
        select: {
          ...userSelect,
          approvedByUser: {
            select: {
              id: true,
              name: true,
              loginId: true,
            },
          },
        },
      });

      // If the approved role is APPROVER, wire them into the Approval stage automatically
      if (finalRole === Role.APPROVER) {
        const approvalStage = await getApprovalStage(tx);
        if (approvalStage) {
          // Only create the rule if one doesn't already exist for this user + stage combo
          const existingRule = await tx.approvalRule.findFirst({
            where: {
              stageId: approvalStage.id,
              userId: nextUser.id,
            },
          });

          if (!existingRule) {
            await tx.approvalRule.create({
              data: {
                stageId: approvalStage.id,
                userId: nextUser.id,
                name: 'Approver Review',
                approvalCategory: ApprovalCategory.OPTIONAL, // optional by default — admin can change it
              },
            });
          }
        }
      }

      return nextUser;
    });

    // Audit log so we have a record of who approved whom
    await createAuditLog({
      action: 'USER_APPROVED',
      entityType: 'User',
      entityId: approvedUser.id,
      oldValue: {
        accountStatus: user.accountStatus,
        requestedRole: user.requestedRole,
      },
      newValue: {
        accountStatus: approvedUser.accountStatus,
        role: approvedUser.role,
        approvedRole: approvedUser.approvedRole,
      },
      userId: req.user.id,
    });

    res.json({
      success: true,
      message: 'User approved successfully',
      data: { user: approvedUser },
    });
  } catch (error) {
    next(error);
  }
};

// ─── rejectUser ───────────────────────────────────────────────────────────────
// Marks a PENDING user as REJECTED with an optional reason.
// Rejected users see the reason when they try to log in so they know what happened.
const rejectUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.accountStatus !== AccountStatus.PENDING_APPROVAL) {
      throw new ValidationError('Only pending users can be rejected');
    }

    const rejectedUser = await prisma.user.update({
      where: { id },
      data: {
        accountStatus: AccountStatus.REJECTED,
        approvedBy: req.user.id, // record who rejected them
        rejectionReason: reason || 'Rejected by administrator',
      },
      select: {
        ...userSelect,
        approvedByUser: {
          select: {
            id: true,
            name: true,
            loginId: true,
          },
        },
      },
    });

    await createAuditLog({
      action: 'USER_REJECTED',
      entityType: 'User',
      entityId: rejectedUser.id,
      oldValue: {
        accountStatus: user.accountStatus,
      },
      newValue: {
        accountStatus: rejectedUser.accountStatus,
        rejectionReason: rejectedUser.rejectionReason,
      },
      userId: req.user.id,
    });

    res.json({
      success: true,
      message: 'User rejected successfully',
      data: { user: rejectedUser },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateRequestedRole,
  approveUser,
  rejectUser,
};
