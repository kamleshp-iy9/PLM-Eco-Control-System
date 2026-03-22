import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  Zap,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getActiveNavModule,
  getVisibleNavModules,
  isPathActive,
  type AppNavModule,
} from './navigation';

function ModuleItem({ module }: { module: AppNavModule }) {
  const location = useLocation();
  const activeModule = getActiveNavModule(location.pathname);
  const hasMultipleItems = module.items.length > 1;
  const isModuleActive = activeModule?.id === module.id;
  const [isExpanded, setIsExpanded] = useState(isModuleActive);

  useEffect(() => {
    if (isModuleActive) {
      setIsExpanded(true);
    }
  }, [isModuleActive]);

  if (hasMultipleItems) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger
          className={cn(
            'flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-3 text-sm font-medium transition-[background-color,border-color,color] duration-150',
            'text-sidebar-foreground/80 hover:border-white/10 hover:bg-white/5 hover:text-sidebar-accent-foreground',
            isModuleActive && 'border-white/10 bg-white/6 text-sidebar-accent-foreground'
          )}
        >
          <span className="flex items-center gap-3">
            <module.icon className="h-4 w-4 shrink-0 opacity-70" />
            {module.label}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 opacity-50 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-0.5 space-y-0.5">
          {module.items.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-transparent py-2.5 pl-10 pr-3 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150',
                'text-sidebar-foreground/72 hover:border-white/8 hover:bg-white/4 hover:text-sidebar-accent-foreground',
                isPathActive(location.pathname, item.path) &&
                  'border-sidebar-primary/25 bg-sidebar-primary/16 text-white shadow-[0_14px_28px_rgba(99,102,241,0.18)]'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-70" />
              {item.label}
            </Link>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const item = module.items[0];
  return (
    <Link
      to={item.path}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150',
        'text-sidebar-foreground/82 hover:border-white/10 hover:bg-white/5 hover:text-sidebar-accent-foreground',
        isPathActive(location.pathname, item.path) &&
          'border-sidebar-primary/30 bg-sidebar-primary/18 text-white shadow-[0_14px_28px_rgba(99,102,241,0.18)]'
      )}
    >
      <module.icon
        className={cn(
          'h-4 w-4 shrink-0',
          isPathActive(location.pathname, item.path) ? 'opacity-100 text-sidebar-primary-foreground' : 'opacity-65'
        )}
      />
      {module.label}
    </Link>
  );
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const modules = useMemo(() => getVisibleNavModules(user?.role), [user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar plm-sidebar">
      {/* Brand Header */}
      <div className="border-b border-sidebar-border/80 px-4 py-5">
        <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 shadow-[0_14px_30px_rgba(99,102,241,0.32)] shrink-0">
          <Zap className="h-5 w-5 text-white" />
        </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-wide text-white">PLM System</p>
            <p className="truncate text-xs text-sidebar-foreground/55">Engineering change control</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-5">
          <div className="space-y-0.5">
            <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/35">
              Modules
            </p>
            {modules.map((module) => (
              <ModuleItem key={module.id} module={module} />
            ))}
          </div>
        </nav>
      </ScrollArea>

      {/* User Section */}
      <div className="border-t border-sidebar-border/80 px-3 py-3">
        <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white shadow-[0_10px_24px_rgba(99,102,241,0.28)]">
            {user?.name ? getInitials(user.name) : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/55">
              {ROLE_LABELS[user?.role || ''] || user?.role}
            </p>
          </div>
          <Button
            onClick={handleLogout}
            title="Sign out"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 border border-transparent text-sidebar-foreground/45 shadow-none hover:border-white/10 hover:bg-white/5 hover:text-sidebar-foreground/90"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-72 p-0 border-0 lg:hidden" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      variant="toolbar"
      size="icon-sm"
      className="text-muted-foreground hover:text-foreground"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" x2="20" y1="12" y2="12" />
        <line x1="4" x2="20" y1="6" y2="6" />
        <line x1="4" x2="20" y1="18" y2="18" />
      </svg>
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
}
