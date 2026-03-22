// ─── ECO stage bootstrap service ──────────────────────────────────────────────
// Runs once at server startup to guarantee the default ECO workflow stages exist
// in the database. If any stage is missing (e.g. fresh install or DB reset),
// it creates them automatically so the app is never in a broken state.
//
// Default workflow:  New → In Progress → Approval → Done
//
// Admins can rename/add/reorder stages through the Settings page after this runs.

const {
  PrismaClient,
  Role,
  ApprovalCategory,
  AccountStatus,
} = require('@prisma/client');

const prisma = new PrismaClient();

// The four default stages that every fresh installation starts with.
// sequence determines the order. isFinal=true means the ECO is "done" once it reaches that stage.
const DEFAULT_ECO_STAGES = [
  {
    name: 'New',
    sequence: 1,
    requiresApproval: false,
    isFinal: false,
    allowApplyChanges: false,
    folded: false,
    description: 'Initial ECO draft stage',
  },
  {
    name: 'In Progress',
    sequence: 2,
    requiresApproval: false,
    isFinal: false,
    allowApplyChanges: false,
    folded: false,
    description: 'Legacy working stage kept for compatibility',
  },
  {
    name: 'Approval',
    sequence: 3,
    requiresApproval: true,          // gated — requires approvers to sign off
    isFinal: false,
    allowApplyChanges: false,
    folded: false,
    description: 'Approval gate before final application',
  },
  {
    name: 'Done',
    sequence: 99,                    // high sequence number leaves room to insert stages before it
    requiresApproval: false,
    isFinal: true,                   // reaching this stage marks the ECO as complete
    allowApplyChanges: true,         // product/BOM changes are applied when entering this stage
    folded: false,
    description: 'Final applied stage',
  },
];

// ensureDefaultEcoWorkflow — idempotent setup that only creates stages that don't
// exist yet. Safe to call on every restart — won't duplicate existing data.
// Also auto-wires existing APPROVER users into the Approval stage.
const ensureDefaultEcoWorkflow = async (tx = prisma) => {
  // Load whatever stages are already in the DB
  let stages = await tx.ecoStage.findMany({
    orderBy: { sequence: 'asc' },
  });

  // Find which default stages are missing
  const existingStageNames = new Set(stages.map((stage) => stage.name));
  const missingStages = DEFAULT_ECO_STAGES.filter(
    (stage) => !existingStageNames.has(stage.name)
  );

  // Create any missing stages — wrapped in a try/catch to handle race conditions on
  // concurrent startups (e.g. multiple server instances booting at the same time)
  for (const stage of missingStages) {
    try {
      await tx.ecoStage.create({ data: stage });
    } catch (error) {
      // If creation failed because another instance just created it, that's fine
      const existingStage = await tx.ecoStage.findUnique({
        where: { name: stage.name },
      });

      if (!existingStage) {
        throw error; // something else went wrong — re-throw
      }
    }
  }

  // Reload stages if we just created some
  if (missingStages.length > 0) {
    stages = await tx.ecoStage.findMany({
      orderBy: { sequence: 'asc' },
    });
  }

  // Find the approval gate stage — prefer "Approval" by name, fall back to the first
  // stage that has requiresApproval=true
  const approvalStage =
    stages.find((stage) => stage.name === 'Approval') ||
    stages.find((stage) => stage.requiresApproval);

  // Auto-create ApprovalRules for any active APPROVER users who don't have one yet.
  // This means approvers are ready to review ECOs as soon as they're activated.
  if (approvalStage) {
    const approvers = await tx.user.findMany({
      where: {
        role: Role.APPROVER,
        accountStatus: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (approvers.length > 0) {
      await tx.approvalRule.createMany({
        data: approvers.map((user) => ({
          name: 'Approver Review',
          userId: user.id,
          stageId: approvalStage.id,
          approvalCategory: ApprovalCategory.OPTIONAL, // admin can change to REQUIRED later
        })),
        skipDuplicates: true, // don't error if the rule already exists
      });
    }
  }

  return stages;
};

// getFirstEcoStage — returns the "New" stage (or the first non-final stage as a fallback).
// Used when creating a new ECO to determine its starting stage.
const getFirstEcoStage = async (tx = prisma) => {
  const stages = await ensureDefaultEcoWorkflow(tx);
  return (
    stages.find((stage) => stage.name === 'New') ||
    stages.find((stage) => !stage.isFinal) ||
    stages[0] ||
    null
  );
};

module.exports = {
  DEFAULT_ECO_STAGES,
  ensureDefaultEcoWorkflow,
  getFirstEcoStage,
};
