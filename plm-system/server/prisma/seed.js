const { PrismaClient, Role, Status, EcoType, EcoState, ApprovalCategory, AccountStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.ecoApproval.deleteMany();
  await prisma.eco.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.bomComponent.deleteMany();
  await prisma.bomOperation.deleteMany();
  await prisma.bom.deleteMany();
  await prisma.product.deleteMany();
  await prisma.approvalRule.deleteMany();
  await prisma.ecoStage.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data');

  // Create default ECO Stages
  const stages = await Promise.all([
    prisma.ecoStage.create({
      data: {
        name: 'New',
        sequence: 1,
        requiresApproval: false,
        isFinal: false,
        allowApplyChanges: false,
      },
    }),
    prisma.ecoStage.create({
      data: {
        name: 'In Progress',
        sequence: 2,
        requiresApproval: false,
        isFinal: false,
        allowApplyChanges: false,
      },
    }),
    prisma.ecoStage.create({
      data: {
        name: 'Approval',
        sequence: 3,
        requiresApproval: true,
        isFinal: false,
        allowApplyChanges: false,
      },
    }),
    prisma.ecoStage.create({
      data: {
        name: 'Done',
        sequence: 99,
        requiresApproval: false,
        isFinal: true,
        allowApplyChanges: true,
      },
    }),
  ]);

  console.log('Created ECO stages:', stages.map(s => s.name).join(', '));

  // Create seed users with hashed passwords
  const hashedPasswords = {
    admin: await bcrypt.hash('Admin@123', 10),
    engineer: await bcrypt.hash('Engg@1234', 10),
    approver: await bcrypt.hash('Appr@1234', 10),
    ops: await bcrypt.hash('Opss@1234', 10),
  };

  const users = await Promise.all([
    prisma.user.create({
      data: {
        loginId: 'admin01',
        name: 'Admin User',
        email: 'admin@plm.com',
        password: hashedPasswords.admin,
        role: Role.ADMIN,
        requestedRole: Role.ADMIN,
        approvedRole: Role.ADMIN,
        accountStatus: AccountStatus.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        loginId: 'engineer01',
        name: 'John Engineer',
        email: 'engineer@plm.com',
        password: hashedPasswords.engineer,
        role: Role.ENGINEERING_USER,
        requestedRole: Role.ENGINEERING_USER,
        approvedRole: Role.ENGINEERING_USER,
        accountStatus: AccountStatus.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        loginId: 'approver01',
        name: 'Sarah Approver',
        email: 'approver@plm.com',
        password: hashedPasswords.approver,
        role: Role.APPROVER,
        requestedRole: Role.APPROVER,
        approvedRole: Role.APPROVER,
        accountStatus: AccountStatus.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        loginId: 'ops01',
        name: 'Mike Operations',
        email: 'ops@plm.com',
        password: hashedPasswords.ops,
        role: Role.OPERATIONS_USER,
        requestedRole: Role.OPERATIONS_USER,
        approvedRole: Role.OPERATIONS_USER,
        accountStatus: AccountStatus.ACTIVE,
      },
    }),
  ]);

  console.log('Created users:', users.map(u => u.loginId).join(', '));

  // Create approval rule
  const approvalStage = stages.find(s => s.name === 'Approval');
  const approverUsers = users.filter(u => u.role === Role.APPROVER);
  await prisma.approvalRule.createMany({
    data: approverUsers.map((user) => ({
      name: 'Approver Review',
      userId: user.id,
      stageId: approvalStage.id,
      approvalCategory: ApprovalCategory.OPTIONAL,
    })),
  });

  console.log('Created approval rules for approver users');

  // Create seed products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'iPhone 17',
        salesPrice: 999,
        costPrice: 450,
        version: 1,
        status: Status.ACTIVE,
        attachments: [],
      },
    }),
    prisma.product.create({
      data: {
        name: 'Wooden Table',
        salesPrice: 250,
        costPrice: 120,
        version: 1,
        status: Status.ACTIVE,
        attachments: [],
      },
    }),
    prisma.product.create({
      data: {
        name: 'MacBook Pro',
        salesPrice: 2499,
        costPrice: 1200,
        version: 1,
        status: Status.ACTIVE,
        attachments: [],
      },
    }),
  ]);

  console.log('Created products:', products.map(p => p.name).join(', '));

  // Create BoMs with components and operations
  const woodenTable = products.find(p => p.name === 'Wooden Table');
  const iPhone = products.find(p => p.name === 'iPhone 17');
  const engineerUser = users.find(u => u.loginId === 'engineer01');
  const inProgressStage = stages.find(s => s.name === 'In Progress');
  const inReviewStage = stages.find(s => s.name === 'Approval');

  // BoM for Wooden Table
  const bom1 = await prisma.bom.create({
    data: {
      reference: 'BOM-0001',
      productId: woodenTable.id,
      quantity: 1,
      units: 'Unit',
      version: 1,
      status: Status.ACTIVE,
      components: {
        create: [
          { componentName: 'Wooden Legs', quantity: 4, units: 'Units' },
          { componentName: 'Wooden Top', quantity: 1, units: 'Unit' },
          { componentName: 'Screws', quantity: 12, units: 'Units' },
          { componentName: 'Varnish Bottle', quantity: 1, units: 'Unit' },
        ],
      },
      operations: {
        create: [
          { operationName: 'Assembly', expectedDuration: 60, workCenter: 'Assembly Line' },
          { operationName: 'Painting', expectedDuration: 30, workCenter: 'Paint Floor' },
          { operationName: 'Packing', expectedDuration: 20, workCenter: 'Packaging Line' },
        ],
      },
    },
  });

  console.log('Created BoM:', bom1.reference);

  // BoM for iPhone 17
  const bom2 = await prisma.bom.create({
    data: {
      reference: 'BOM-0002',
      productId: iPhone.id,
      quantity: 1,
      units: 'Unit',
      version: 1,
      status: Status.ACTIVE,
      components: {
        create: [
          { componentName: 'Display Panel', quantity: 1, units: 'Unit' },
          { componentName: 'Battery', quantity: 1, units: 'Unit' },
          { componentName: 'Processor Chip', quantity: 1, units: 'Unit' },
          { componentName: 'Camera Module', quantity: 1, units: 'Unit' },
          { componentName: 'Casing', quantity: 1, units: 'Unit' },
          { componentName: 'Screws', quantity: 8, units: 'Units' },
        ],
      },
      operations: {
        create: [
          { operationName: 'SMT Assembly', expectedDuration: 45, workCenter: 'SMT Line' },
          { operationName: 'Display Fitting', expectedDuration: 20, workCenter: 'Assembly Line' },
          { operationName: 'Testing', expectedDuration: 30, workCenter: 'QC Floor' },
          { operationName: 'Packaging', expectedDuration: 10, workCenter: 'Packaging Line' },
        ],
      },
    },
  });

  console.log('Created BoM:', bom2.reference);

  // Create seed ECOs
  // ECO 1: BoM ECO for iPhone (In Review stage)
  const eco1 = await prisma.eco.create({
    data: {
      reference: 'ECO-0001',
      title: 'Reduce Screw Count for Cost Optimization',
      ecoType: EcoType.BOM,
      productId: iPhone.id,
      bomId: bom2.id,
      userId: engineerUser.id,
      stageId: inReviewStage.id,
      state: EcoState.IN_PROGRESS,
      isStarted: true,
      versionUpdate: true,
      proposedBomChanges: {
        components: [
          { componentName: 'Display Panel', quantity: 1, units: 'Unit' },
          { componentName: 'Battery', quantity: 1, units: 'Unit' },
          { componentName: 'Processor Chip', quantity: 1, units: 'Unit' },
          { componentName: 'Camera Module', quantity: 1, units: 'Unit' },
          { componentName: 'Casing', quantity: 1, units: 'Unit' },
          { componentName: 'Screws', quantity: 6, units: 'Units' }, // Changed from 8 to 6
        ],
        operations: [
          { operationName: 'SMT Assembly', expectedDuration: 45, workCenter: 'SMT Line' },
          { operationName: 'Display Fitting', expectedDuration: 20, workCenter: 'Assembly Line' },
          { operationName: 'Testing', expectedDuration: 30, workCenter: 'QC Floor' },
          { operationName: 'Packaging', expectedDuration: 10, workCenter: 'Packaging Line' },
        ],
      },
    },
  });

  console.log('Created ECO:', eco1.reference);

  // ECO 2: Product ECO for Wooden Table (New stage)
  const eco2 = await prisma.eco.create({
    data: {
      reference: 'ECO-0002',
      title: 'Premium Finish Upgrade',
      ecoType: EcoType.PRODUCT,
      productId: woodenTable.id,
      userId: engineerUser.id,
      stageId: inProgressStage.id,
      state: EcoState.IN_PROGRESS,
      isStarted: true,
      versionUpdate: true,
      proposedProductChanges: {
        salesPrice: 299,
        costPrice: 145,
        attachments: [],
      },
    },
  });

  console.log('Created ECO:', eco2.reference);

  // Create audit logs for seed data
  await prisma.auditLog.createMany({
    data: [
      {
        action: 'ECO_CREATED',
        entityType: 'ECO',
        entityId: eco1.id,
        userId: engineerUser.id,
        ecoId: eco1.id,
      },
      {
        action: 'ECO_STARTED',
        entityType: 'ECO',
        entityId: eco1.id,
        userId: engineerUser.id,
        ecoId: eco1.id,
      },
      {
        action: 'ECO_CREATED',
        entityType: 'ECO',
        entityId: eco2.id,
        userId: engineerUser.id,
        ecoId: eco2.id,
      },
      {
        action: 'ECO_STARTED',
        entityType: 'ECO',
        entityId: eco2.id,
        userId: engineerUser.id,
        ecoId: eco2.id,
      },
    ],
  });

  console.log('Created audit logs');

  console.log('\n✅ Seed completed successfully!');
  console.log('\nDemo Credentials:');
  console.log('  Admin:      admin01 / Admin@123');
  console.log('  Engineer:   engineer01 / Engg@1234');
  console.log('  Approver:   approver01 / Appr@1234');
  console.log('  Operations: ops01 / Opss@1234');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
