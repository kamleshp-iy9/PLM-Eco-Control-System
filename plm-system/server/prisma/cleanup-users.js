const { PrismaClient, Role } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting user cleanup...');

  // Find all non-admin user IDs
  const nonAdminUsers = await prisma.user.findMany({
    where: { role: { not: Role.ADMIN } },
    select: { id: true, loginId: true, name: true, role: true },
  });

  if (nonAdminUsers.length === 0) {
    console.log('No non-admin users found. Nothing to do.');
    return;
  }

  console.log(`Found ${nonAdminUsers.length} non-admin user(s) to remove:`);
  nonAdminUsers.forEach(u => console.log(`  - ${u.loginId} (${u.name}, ${u.role})`));

  const nonAdminIds = nonAdminUsers.map(u => u.id);

  // Delete in dependency order to satisfy FK constraints
  // Products, BOMs, BomComponents, BomOperations, EcoStages are NOT touched

  const auditDeleted = await prisma.auditLog.deleteMany({
    where: { userId: { in: nonAdminIds } },
  });
  console.log(`Deleted ${auditDeleted.count} audit log(s)`);

  const approvalDeleted = await prisma.ecoApproval.deleteMany({
    where: { userId: { in: nonAdminIds } },
  });
  console.log(`Deleted ${approvalDeleted.count} ECO approval(s)`);

  const attachmentDeleted = await prisma.attachment.deleteMany({
    where: { uploadedBy: { in: nonAdminIds } },
  });
  console.log(`Deleted ${attachmentDeleted.count} attachment(s)`);

  const ecoDeleted = await prisma.eco.deleteMany({
    where: { userId: { in: nonAdminIds } },
  });
  console.log(`Deleted ${ecoDeleted.count} ECO(s) created by non-admin users`);

  const ruleDeleted = await prisma.approvalRule.deleteMany({
    where: { userId: { in: nonAdminIds } },
  });
  console.log(`Deleted ${ruleDeleted.count} approval rule(s)`);

  // Clear self-referential approvedBy on admin if it points to non-admin
  await prisma.user.updateMany({
    where: { approvedBy: { in: nonAdminIds } },
    data: { approvedBy: null },
  });

  const userDeleted = await prisma.user.deleteMany({
    where: { id: { in: nonAdminIds } },
  });
  console.log(`Deleted ${userDeleted.count} non-admin user(s)`);

  // Verify admins still exist
  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { loginId: true, name: true, email: true },
  });

  console.log('\n✅ Cleanup complete!');
  console.log('Admin accounts preserved:');
  admins.forEach(a => console.log(`  - ${a.loginId} (${a.name}) — ${a.email}`));
  console.log('\nProducts, BOMs, and ECO stages were NOT touched.');
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
