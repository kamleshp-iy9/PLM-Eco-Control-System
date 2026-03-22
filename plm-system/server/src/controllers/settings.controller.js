const { PrismaClient } = require('@prisma/client');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { ensureDefaultEcoWorkflow } = require('../services/stage-bootstrap.service');

const prisma = new PrismaClient();

// ECO Stages
const getAllStages = async (req, res, next) => {
  try {
    await ensureDefaultEcoWorkflow(prisma);

    const stages = await prisma.ecoStage.findMany({
      include: {
        _count: {
          select: {
            approvalRules: true,
            ecos: true,
          },
        },
      },
      orderBy: { sequence: 'asc' },
    });

    res.json({
      success: true,
      data: { stages },
    });
  } catch (error) {
    next(error);
  }
};

const createStage = async (req, res, next) => {
  try {
    const {
      name,
      sequence,
      requiresApproval = false,
      isFinal = false,
      allowApplyChanges = false,
      folded = false,
      description = null,
    } = req.body;

    const existingName = await prisma.ecoStage.findUnique({ where: { name } });
    if (existingName) {
      throw new ValidationError('Stage name already exists');
    }

    const existingSequence = await prisma.ecoStage.findUnique({ where: { sequence } });
    if (existingSequence) {
      throw new ValidationError('Sequence number already exists');
    }

    if (isFinal) {
      const existingFinal = await prisma.ecoStage.findFirst({
        where: { isFinal: true },
      });
      if (existingFinal) {
        throw new ValidationError('A final stage already exists');
      }
    }

    const stage = await prisma.ecoStage.create({
      data: {
        name,
        sequence,
        requiresApproval,
        isFinal,
        allowApplyChanges: allowApplyChanges || isFinal,
        folded,
        description,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Stage created successfully',
      data: { stage },
    });
  } catch (error) {
    next(error);
  }
};

const updateStage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      sequence,
      requiresApproval,
      isFinal,
      allowApplyChanges,
      folded,
      description,
    } = req.body;

    const stage = await prisma.ecoStage.findUnique({ where: { id } });

    if (!stage) {
      throw new NotFoundError('Stage not found');
    }

    if ((stage.name === 'New' || stage.name === 'Done') && name && name !== stage.name) {
      throw new ValidationError('Cannot rename default stages');
    }

    if (name && name !== stage.name) {
      const existingName = await prisma.ecoStage.findUnique({ where: { name } });
      if (existingName) {
        throw new ValidationError('Stage name already exists');
      }
    }

    if (sequence && sequence !== stage.sequence) {
      const existingSequence = await prisma.ecoStage.findUnique({ where: { sequence } });
      if (existingSequence) {
        throw new ValidationError('Sequence number already exists');
      }
    }

    if (isFinal && !stage.isFinal) {
      const existingFinal = await prisma.ecoStage.findFirst({
        where: { isFinal: true },
      });
      if (existingFinal) {
        throw new ValidationError('A final stage already exists');
      }
    }

    const updatedStage = await prisma.ecoStage.update({
      where: { id },
      data: {
        name: name || stage.name,
        sequence: sequence || stage.sequence,
        requiresApproval: requiresApproval !== undefined ? requiresApproval : stage.requiresApproval,
        isFinal: isFinal !== undefined ? isFinal : stage.isFinal,
        allowApplyChanges:
          allowApplyChanges !== undefined
            ? allowApplyChanges
            : stage.allowApplyChanges || isFinal === true,
        folded: folded !== undefined ? folded : stage.folded,
        description: description !== undefined ? description : stage.description,
      },
    });

    res.json({
      success: true,
      message: 'Stage updated successfully',
      data: { stage: updatedStage },
    });
  } catch (error) {
    next(error);
  }
};

const deleteStage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const stage = await prisma.ecoStage.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ecos: true,
            approvalRules: true,
          },
        },
      },
    });

    if (!stage) {
      throw new NotFoundError('Stage not found');
    }

    if (stage.name === 'New' || stage.name === 'Done') {
      throw new ValidationError('Cannot delete default stages');
    }

    if (stage._count.ecos > 0) {
      throw new ValidationError('Cannot delete stage that is in use by ECOs');
    }

    await prisma.approvalRule.deleteMany({
      where: { stageId: id },
    });

    await prisma.ecoStage.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Stage deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Stage approval rules
const getAllApprovalRules = async (req, res, next) => {
  try {
    const rules = await prisma.approvalRule.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            loginId: true,
            email: true,
            role: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            sequence: true,
          },
        },
      },
      orderBy: [{ stage: { sequence: 'asc' } }, { name: 'asc' }],
    });

    res.json({
      success: true,
      data: { rules },
    });
  } catch (error) {
    next(error);
  }
};

const getStageApprovalRules = async (req, res, next) => {
  try {
    const { stageId } = req.params;

    const stage = await prisma.ecoStage.findUnique({ where: { id: stageId } });
    if (!stage) {
      throw new NotFoundError('Stage not found');
    }

    const rules = await prisma.approvalRule.findMany({
      where: { stageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            loginId: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: { rules },
    });
  } catch (error) {
    next(error);
  }
};

const createStageApprovalRule = async (req, res, next) => {
  try {
    const { stageId } = req.params;
    const { name, userId, approvalCategory } = req.body;

    const [stage, user, existing] = await Promise.all([
      prisma.ecoStage.findUnique({ where: { id: stageId } }),
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.approvalRule.findFirst({
        where: {
          stageId,
          userId,
        },
      }),
    ]);

    if (!stage) {
      throw new NotFoundError('Stage not found');
    }
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (existing) {
      throw new ValidationError('This user already has an approval rule for the selected stage');
    }

    const rule = await prisma.approvalRule.create({
      data: {
        name,
        userId,
        stageId,
        approvalCategory,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            loginId: true,
            email: true,
            role: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            sequence: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Approval rule created successfully',
      data: { rule },
    });
  } catch (error) {
    next(error);
  }
};

const updateStageApprovalRule = async (req, res, next) => {
  try {
    const { stageId, ruleId } = req.params;
    const { name, userId, approvalCategory, isActive } = req.body;

    const rule = await prisma.approvalRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule || rule.stageId !== stageId) {
      throw new NotFoundError('Approval rule not found');
    }

    if (userId && userId !== rule.userId) {
      const [user, existing] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.approvalRule.findFirst({
          where: {
            stageId,
            userId,
            id: { not: ruleId },
          },
        }),
      ]);

      if (!user) {
        throw new NotFoundError('User not found');
      }
      if (existing) {
        throw new ValidationError('This user already has an approval rule for the selected stage');
      }
    }

    const updatedRule = await prisma.approvalRule.update({
      where: { id: ruleId },
      data: {
        name: name || rule.name,
        userId: userId || rule.userId,
        approvalCategory: approvalCategory || rule.approvalCategory,
        isActive: isActive !== undefined ? isActive : rule.isActive,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            loginId: true,
            email: true,
            role: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            sequence: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Approval rule updated successfully',
      data: { rule: updatedRule },
    });
  } catch (error) {
    next(error);
  }
};

const deleteStageApprovalRule = async (req, res, next) => {
  try {
    const { stageId, ruleId } = req.params;

    const rule = await prisma.approvalRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule || rule.stageId !== stageId) {
      throw new NotFoundError('Approval rule not found');
    }

    await prisma.approvalRule.delete({
      where: { id: ruleId },
    });

    res.json({
      success: true,
      message: 'Approval rule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllStages,
  createStage,
  updateStage,
  deleteStage,
  getAllApprovalRules,
  getStageApprovalRules,
  createStageApprovalRule,
  updateStageApprovalRule,
  deleteStageApprovalRule,
};
