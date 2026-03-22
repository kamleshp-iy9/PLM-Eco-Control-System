const { PrismaClient, Role, AccountStatus, ApprovalCategory } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding admin and ECO stages...');

  // Create ECO stages if they don't exist
  const existingStages = await prisma.ecoStage.findMany();
  if (existingStages.length === 0) {
    await Promise.all([
      prisma.ecoStage.create({
        data: { name: 'New', sequence: 1, requiresApproval: false, isFinal: false, allowApplyChanges: false },
      }),
      prisma.ecoStage.create({
        data: { name: 'In Progress', sequence: 2, requiresApproval: false, isFinal: false, allowApplyChanges: false },
      }),
      prisma.ecoStage.create({
        data: { name: 'Approval', sequence: 3, requiresApproval: true, isFinal: false, allowApplyChanges: false },
      }),
      prisma.ecoStage.create({
        data: { name: 'Done', sequence: 99, requiresApproval: false, isFinal: true, allowApplyChanges: true },
      }),
    ]);
    console.log('Created ECO stages');
  } else {
    console.log('ECO stages already exist, skipping');
  }

  // Create or upsert admin user
  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  const admin = await prisma.user.upsert({
    where: { loginId: 'admin01' },
    update: {
      password: hashedPassword,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      loginId: 'admin01',
      name: 'Admin User',
      email: 'admin@plm.com',
      password: hashedPassword,
      role: Role.ADMIN,
      requestedRole: Role.ADMIN,
      approvedRole: Role.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },
  });

  console.log('\n✅ Done!');
  console.log('Admin credentials:');
  console.log('  Login ID: admin01');
  console.log('  Password: Admin@123');
  console.log('  Email:    admin@plm.com');
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
