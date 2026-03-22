UPDATE "User"
SET
  "approvedRole" = COALESCE("approvedRole", "role"),
  "requestedRole" = COALESCE("requestedRole", "role")
WHERE "accountStatus" = 'ACTIVE';

UPDATE "EcoStage"
SET
  "allowApplyChanges" = false,
  "folded" = false,
  "description" = 'Newly created ECO waiting to be started.'
WHERE "name" = 'New';

UPDATE "EcoStage"
SET "sequence" = 202
WHERE "name" = 'In Review';

UPDATE "EcoStage"
SET "sequence" = 203
WHERE "name" = 'Approved';

UPDATE "EcoStage"
SET
  "name" = 'In Progress',
  "sequence" = 2,
  "requiresApproval" = false,
  "allowApplyChanges" = false,
  "folded" = false,
  "description" = 'Engineering work is in progress and draft changes are being prepared.'
WHERE "name" = 'Approved';

UPDATE "EcoStage"
SET
  "name" = 'Validated',
  "sequence" = 3,
  "requiresApproval" = true,
  "allowApplyChanges" = false,
  "folded" = false,
  "description" = 'Approvers review the ECO before the controlled release.'
WHERE "name" = 'In Review';

UPDATE "EcoStage"
SET
  "allowApplyChanges" = true,
  "folded" = false,
  "description" = 'Changes are effective and have been applied to the live master data.'
WHERE "name" = 'Done';
