export const ROLES = {
  ADMIN: 'ADMIN',
  ENGINEERING_USER: 'ENGINEERING_USER',
  APPROVER: 'APPROVER',
  OPERATIONS_USER: 'OPERATIONS_USER',
} as const;

export const REQUESTABLE_ROLES = {
  ENGINEERING_USER: ROLES.ENGINEERING_USER,
  APPROVER: ROLES.APPROVER,
  OPERATIONS_USER: ROLES.OPERATIONS_USER,
} as const;

export const ACCOUNT_STATUSES = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;

export const ECO_TYPES = {
  PRODUCT: 'PRODUCT',
  BOM: 'BOM',
} as const;

export const ECO_STATES = {
  IN_PROGRESS: 'IN_PROGRESS',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
} as const;

export const STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const DEFAULT_BOM_UNIT = 'Units';

export const STATIC_UNIT_OPTIONS = [
  'Units',
  'Kg',
  'g',
  'L',
  'ml',
  'm',
  'cm',
  'mm',
] as const;

export const APPROVAL_CATEGORIES = {
  REQUIRED: 'REQUIRED',
  OPTIONAL: 'OPTIONAL',
  COMMENT_ONLY: 'COMMENT_ONLY',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.ENGINEERING_USER]: 'Engineering User',
  [ROLES.APPROVER]: 'Approver',
  [ROLES.OPERATIONS_USER]: 'Operations User',
};

export function canCreateProtectedRecords(role?: string | null) {
  return role === ROLES.ADMIN || role === ROLES.ENGINEERING_USER;
}

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  [ACCOUNT_STATUSES.PENDING_APPROVAL]: 'Pending Approval',
  [ACCOUNT_STATUSES.ACTIVE]: 'Active',
  [ACCOUNT_STATUSES.REJECTED]: 'Rejected',
  [ACCOUNT_STATUSES.SUSPENDED]: 'Suspended',
};

export const ACCOUNT_STATUS_COLORS: Record<string, string> = {
  [ACCOUNT_STATUSES.PENDING_APPROVAL]: 'bg-amber-100 text-amber-800',
  [ACCOUNT_STATUSES.ACTIVE]: 'bg-green-100 text-green-800',
  [ACCOUNT_STATUSES.REJECTED]: 'bg-red-100 text-red-800',
  [ACCOUNT_STATUSES.SUSPENDED]: 'bg-gray-100 text-gray-800',
};

export const ECO_TYPE_LABELS: Record<string, string> = {
  [ECO_TYPES.PRODUCT]: 'Product',
  [ECO_TYPES.BOM]: 'Bill of Materials',
};

export const ECO_STATE_LABELS: Record<string, string> = {
  [ECO_STATES.IN_PROGRESS]: 'In Progress',
  [ECO_STATES.APPROVED]: 'Approved',
  [ECO_STATES.CANCELLED]: 'Cancelled',
};

export const STATUS_LABELS: Record<string, string> = {
  [STATUS.ACTIVE]: 'Active',
  [STATUS.ARCHIVED]: 'Archived',
};

export const STATUS_COLORS: Record<string, string> = {
  [STATUS.ACTIVE]: 'bg-green-100 text-green-800',
  [STATUS.ARCHIVED]: 'bg-gray-100 text-gray-800',
};

export const ECO_STATE_COLORS: Record<string, string> = {
  [ECO_STATES.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
  [ECO_STATES.APPROVED]: 'bg-green-100 text-green-800',
  [ECO_STATES.CANCELLED]: 'bg-red-100 text-red-800',
};
