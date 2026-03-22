import {
  BarChart3,
  ClipboardList,
  FileText,
  Layers,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { ROLES } from '@/lib/constants';

export interface AppNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export interface AppNavModule {
  id: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  items: AppNavItem[];
}

export const APP_NAV_MODULES: AppNavModule[] = [
  {
    id: 'master-data',
    label: 'Master Data',
    icon: Layers,
    items: [
      { label: 'Products', path: '/master-data/products', icon: Package },
      { label: 'Bill of Materials', path: '/master-data/boms', icon: FileText },
    ],
  },
  {
    id: 'ecos',
    label: 'ECOs',
    icon: ClipboardList,
    items: [
      { label: 'Engineering Change Orders', path: '/ecos', icon: ClipboardList },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    icon: BarChart3,
    items: [
      { label: 'Reports', path: '/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    roles: [ROLES.ADMIN],
    items: [
      { label: 'ECO Stages', path: '/settings/stages', icon: Layers },
      { label: 'Approvals', path: '/settings/approvals', icon: ClipboardList },
      { label: 'Users', path: '/settings/users', icon: Users },
    ],
  },
];

export function isPathActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function getVisibleNavModules(role?: string | null) {
  return APP_NAV_MODULES.filter((module) => !module.roles || module.roles.includes(role || ''));
}

export function getModuleTargetPath(module: AppNavModule) {
  return module.items[0]?.path || '/';
}

export function getActiveNavModule(pathname: string, role?: string | null) {
  const visibleModules = getVisibleNavModules(role);
  return (
    visibleModules.find((module) => module.items.some((item) => isPathActive(pathname, item.path))) ||
    visibleModules[0] ||
    null
  );
}
