const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting cleanup...');

  // Delete all data except admin user and ECO stages
  await prisma.auditLog.deleteMany();
  console.log('Cleared audit logs');

  await prisma.ecoApproval.deleteMany();
  console.log('Cleared ECO approvals');

  await prisma.eco.deleteMany();
  console.log('Cleared ECOs');

  await prisma.attachment.deleteMany();
  console.log('Cleared attachments');

  await prisma.bomComponent.deleteMany();
  await prisma.bomOperation.deleteMany();
  await prisma.bom.deleteMany();
  console.log('Cleared BOMs');

  await prisma.product.deleteMany();
  console.log('Cleared products');

  await prisma.approvalRule.deleteMany();
  console.log('Cleared approval rules');

  // Delete all users except admin
  await prisma.user.deleteMany({
    where: {
      loginId: { not: 'admin01' },
    },
  });
  console.log('Cleared non-admin users');

  // Verify admin still exists
  const admin = await prisma.user.findUnique({ where: { loginId: 'admin01' } });
  if (admin) {
    console.log('\n✅ Cleanup complete!');
    console.log('Admin user preserved:');
    console.log('  Login ID: admin01');
    console.log('  Password: Admin@123');
    console.log('  Email:    admin@plm.com');
  } else {
    console.log('⚠️  Admin user not found! Run seed.js to recreate.');
  }
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
