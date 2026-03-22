import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABELS } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, LogOut, User, Sun, Moon, Zap } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  getActiveNavModule,
  getModuleTargetPath,
  getVisibleNavModules,
  isPathActive,
} from './navigation';

interface HeaderProps {
  onMenuClick: () => void;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function Header({ onMenuClick, onSearch, searchPlaceholder }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';
  const modules = getVisibleNavModules(user?.role);
  const activeModule = getActiveNavModule(location.pathname, user?.role);
  const activeItem =
    activeModule?.items.find((item) => isPathActive(location.pathname, item.path)) ||
    activeModule?.items[0] ||
    null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="plm-app-header sticky top-0 z-30">
      <div className="mx-auto flex max-w-[1600px] flex-col px-3 sm:px-4 lg:px-6">
        <div className="flex h-14 items-center gap-2.5 sm:h-16 sm:gap-3">
          <Button
            onClick={onMenuClick}
            variant="toolbar"
            size="icon"
            className="h-10 w-10 shrink-0 lg:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </Button>

          <Link
            to="/ecos"
            className="hidden min-w-0 items-center gap-3 pr-2 sm:flex lg:pr-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-[var(--plm-shadow-button-primary)] sm:h-11 sm:w-11">
              <Zap className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">PLM System</p>
              <p className="hidden truncate text-xs uppercase tracking-[0.18em] text-muted-foreground lg:block">
                Engineering change control
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 px-2 lg:flex">
            {modules.map((module) => {
              const targetPath = getModuleTargetPath(module);
              const isActive = activeModule?.id === module.id;

              return (
                <Link
                  key={module.id}
                  to={targetPath}
                  className={[
                    'inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150',
                    isActive
                      ? 'border-primary/22 bg-primary/10 text-foreground shadow-[var(--plm-shadow-button-muted)]'
                      : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/55 hover:text-foreground',
                  ].join(' ')}
                >
                  <module.icon className="h-4 w-4" />
                  {module.label}
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 sm:hidden lg:hidden">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              {activeItem?.label || activeModule?.label || 'PLM System'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {activeModule ? `${activeModule.label} workspace` : 'PLM workspace'}
            </p>
          </div>

          <div className="flex-1" />

          {onSearch && (
            <form onSubmit={handleSearch} className="hidden w-full max-w-xs xl:flex">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder={searchPlaceholder || 'Search...'}
                  className="h-10 rounded-full border-border/60 bg-background/55 pl-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          )}

          <Button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            variant="toolbar"
            size="icon"
            className="h-10 w-10 sm:h-11 sm:w-11"
            aria-label="Toggle theme"
          >
            {mounted ? (
              isDark
                ? <Sun className="h-4 w-4 text-amber-400" />
                : <Moon className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="toolbar"
                size="icon"
                className="h-10 w-10 rounded-full border-primary/15 bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white shadow-[var(--plm-shadow-button-primary)] hover:text-white sm:h-11 sm:w-11"
              >
                {user?.name ? getInitials(user.name) : 'U'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl border-border/70 p-2">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[user?.role || ''] || user?.role}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 rounded-xl text-sm">
                <User className="h-3.5 w-3.5" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 rounded-xl text-sm text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden h-12 items-center gap-4 border-t border-border/65 lg:flex">
          {activeModule && (
            <>
              <div className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <activeModule.icon className="h-3.5 w-3.5" />
                {activeModule.label}
              </div>
              <div className="h-5 w-px bg-border/70" />
            </>
          )}

          <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 pt-1">
            {activeModule?.items.map((item) => {
              const isActive = isPathActive(location.pathname, item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={[
                    'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150',
                    isActive
                      ? 'border-primary/24 bg-primary/12 text-foreground shadow-[var(--plm-shadow-button-muted)]'
                      : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/55 hover:text-foreground',
                  ].join(' ')}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
