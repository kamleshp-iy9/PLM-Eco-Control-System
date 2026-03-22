// ─── EcoPage — ECO list view ──────────────────────────────────────────────────
// This is the main landing page after login. It shows all Engineering Change
// Orders in either a list table or a kanban board grouped by stage.
//
// Hooks used on this page:
//   useState  — local UI state (search text, current view mode)
//   useEffect — fetch ECOs from the API when the page first loads
//   Zustand   — global app state (ECO list, auth user) shared across pages

// useState  — React hook that stores a value in the component and re-renders
//             the UI whenever that value changes.
// useEffect — React hook that runs a side-effect (API call, subscription, etc.)
//             after the component renders. The dependency array controls WHEN
//             it runs: [] = once on mount, [dep] = whenever dep changes.
import { useEffect, useState } from 'react';

// useNavigate — React Router hook. Gives us a navigate() function to
// programmatically change the URL (e.g. go to /ecos/new without a link click).
import { useNavigate } from 'react-router-dom';

import { motion } from 'framer-motion';

// Zustand stores — our global state manager (like Redux but much simpler).
// useEcoStore holds the ECO list and API call functions.
// useAuthStore holds the logged-in user so we know their role.
import { useEcoStore } from '@/stores/ecoStore';
import { useAuthStore } from '@/stores/authStore';

import { ECO_TYPE_LABELS, ECO_STATE_LABELS, ECO_STATE_COLORS, canCreateProtectedRecords } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, List, LayoutGrid, Plus, ClipboardList, TrendingUp, CheckCircle2, Clock, XCircle } from 'lucide-react';

// ─── EmptyState component ─────────────────────────────────────────────────────
// Shown when there are no ECOs to display. If the user can create ECOs,
// we show a "New ECO" button — otherwise just a message.
function EmptyState({ onNew }: { onNew?: () => void }) {
  return (
    <div className="plm-empty-state">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <ClipboardList className="h-8 w-8 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">No ECOs yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {onNew
          ? 'Create your first Engineering Change Order to get started.'
          : 'No Engineering Change Orders are available for your role yet.'}
      </p>
      {onNew ? (
        <Button onClick={onNew}>
          <Plus className="h-4 w-4" />
          New ECO
        </Button>
      ) : null}
    </div>
  );
}

// Maps ECO state to a left-border colour in the kanban cards
const STATE_BORDER: Record<string, string> = {
  IN_PROGRESS: 'border-l-blue-500',
  APPROVED: 'border-l-green-500',
  CANCELLED: 'border-l-red-500',
};

// getLifecycleBadge — derives a human-readable label + colour class from the ECO's
// current state and stage. This is display logic only — no side effects.
function getLifecycleBadge(eco: any) {
  if (!eco?.isStarted && eco?.stage?.name === 'New') {
    return {
      label: 'New',
      className: 'bg-muted text-muted-foreground',
    };
  }

  if (eco?.state === 'IN_PROGRESS' && eco?.stage?.name === 'Approval') {
    return {
      label: 'Pending Approval',
      className: 'bg-amber-100 text-amber-800',
    };
  }

  return {
    label: ECO_STATE_LABELS[eco.state],
    className: ECO_STATE_COLORS[eco.state],
  };
}

// KpiCard — reusable stat tile shown in the summary row at the top of the page
interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}

function KpiCard({ label, value, icon: Icon, colorClass, bgClass }: KpiCardProps) {
  return (
    <Card variant="metric">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgClass}`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── EcoPage ─────────────────────────────────────────────────────────────────
export function EcoPage() {
  // useNavigate — lets us programmatically go to another page (e.g. /ecos/new)
  // when the user clicks "New ECO" rather than using an <a> tag.
  const navigate = useNavigate();

  // useAuthStore — pull the logged-in user out of global state.
  // We need their role to decide whether to show the "New ECO" button.
  const { user } = useAuthStore();

  // useEcoStore — pull the ECO list and the fetchEcos action from global state.
  // ecos       — the array of ECO objects returned by the last API call
  // isLoading  — true while the API call is in-flight (used to show skeletons)
  // fetchEcos  — function that calls GET /api/ecos and updates the store
  const { ecos, isLoading, fetchEcos } = useEcoStore();

  // useState('list') — tracks which view mode the user has selected.
  // 'list'   → renders a data table
  // 'kanban' → renders a column board grouped by ECO stage
  // Initial value is 'list'. Calling setView('kanban') re-renders the UI.
  const [view, setView] = useState<'list' | 'kanban'>('list');

  // useState('') — tracks what the user has typed in the search box.
  // The value is controlled — Input reads from searchQuery so it stays in sync.
  const [searchQuery, setSearchQuery] = useState('');

  // Derive whether the user can create ECOs from their role.
  // Only ADMIN and ENGINEERING_USER can create ECOs.
  const canCreate = canCreateProtectedRecords(user?.role);

  // ─── useEffect: fetch ECOs on mount ────────────────────────────────────────
  // useEffect runs AFTER the component renders.
  // The dependency array [fetchEcos] means: run this effect once when the
  // component mounts (and again only if fetchEcos changes — it won't).
  // Without this, the ECO list would never be loaded from the server.
  useEffect(() => {
    fetchEcos(); // GET /api/ecos — populates the ecos array in the store
  }, [fetchEcos]);

  // handleSearch — called when the user submits the search form.
  // e.preventDefault() stops the browser from doing a full page reload.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEcos({ search: searchQuery }); // re-fetch with the search filter
  };

  // Group ECOs by their stage name for the kanban view.
  // reduce() builds a dictionary: { 'New': [...], 'Approval': [...], 'Done': [...] }
  // This runs on every render but is cheap since ecos is usually small.
  const ecosByStage = ecos.reduce((acc, eco) => {
    const stageName = eco.stage?.name || 'Unassigned';
    if (!acc[stageName]) acc[stageName] = [];
    acc[stageName].push(eco);
    return acc;
  }, {} as Record<string, typeof ecos>);

  // Show skeleton placeholders while the API call is in-flight.
  // This gives the user immediate visual feedback that something is loading.
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // Derive KPI counts by filtering the already-loaded ecos array.
  // We don't need a separate API call — just compute from what we have.
  const inProgress = ecos.filter(
    (e) => e.state === 'IN_PROGRESS' && (e.isStarted || e.stage?.name !== 'New')
  ).length;
  const approved = ecos.filter((e) => e.state === 'APPROVED').length;
  const cancelled = ecos.filter((e) => e.state === 'CANCELLED').length;

  return (
    <div className="space-y-5">
      {/* ─── KPI summary cards ─────────────────────────────────────────────── */}
      {/* motion.div from Framer Motion — animates children in with a stagger so
          the cards appear one after another instead of all at once. */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.1 } } // 100ms between each child
        }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {[
          { label: "Total ECOs", value: ecos.length, icon: TrendingUp, colorClass: "text-primary", bgClass: "bg-primary/10" },
          { label: "In Progress", value: inProgress, icon: Clock, colorClass: "text-blue-500", bgClass: "bg-blue-500/10" },
          { label: "Approved", value: approved, icon: CheckCircle2, colorClass: "text-green-500", bgClass: "bg-green-500/10" },
          { label: "Cancelled", value: cancelled, icon: XCircle, colorClass: "text-red-500", bgClass: "bg-red-500/10" }
        ].map((kpi, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, y: 15 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
            }}
          >
            <KpiCard {...kpi} />
          </motion.div>
        ))}
      </motion.div>

      {/* ─── Page header ───────────────────────────────────────────────────── */}
      <div className="plm-page-header">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="plm-page-heading">Engineering Change Orders</h2>
            <p className="plm-page-subtitle">Track approval-ready changes, current stage, and ownership without switching context.</p>
          </div>
          {/* Badge shows the total ECO count next to the title */}
          <Badge variant="secondary" className="rounded-full px-2.5">
            {ecos.length}
          </Badge>
        </div>
        {/* Only show "New ECO" button if the user's role allows creating ECOs */}
        {canCreate ? (
          <Button onClick={() => navigate('/ecos/new')}>
            <Plus className="h-4 w-4" />
            New ECO
          </Button>
        ) : null}
      </div>

      {/* ─── Toolbar: search + view toggle ────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Controlled form — searchQuery state drives the input value.
            onSubmit calls fetchEcos with the search string. */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by reference, product, or state..."
              className="pl-9 h-9 rounded-lg bg-background border-border text-sm focus-visible:ring-1 focus-visible:ring-primary"
              value={searchQuery}                              // controlled input — always shows state value
              onChange={(e) => setSearchQuery(e.target.value)} // update state as user types
            />
          </div>
        </form>

        {/* View toggle — switches between 'list' and 'kanban' via the view state */}
        <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'kanban')}>
          <TabsList className="h-9">
            <TabsTrigger value="list" className="gap-1.5 text-xs px-3">
              <List className="h-3.5 w-3.5" />
              List
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-1.5 text-xs px-3">
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ─── Content: list or kanban based on view state ───────────────────── */}
      {view === 'list' ? (
        /* ── List view ── */
        <Card variant="panel">
          <CardContent className="p-0">
            {ecos.length === 0 ? (
              <EmptyState onNew={canCreate ? () => navigate('/ecos/new') : undefined} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground w-36">Reference</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Title</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Type</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Product</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Stage</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Assigned To</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ecos.map((eco) => {
                    const lifecycleBadge = getLifecycleBadge(eco);
                    return (
                    <TableRow
                      key={eco.id}
                      data-interactive="true"
                      onClick={() => navigate(`/ecos/${eco.id}`)} // navigate on row click
                    >
                      <TableCell>
                        <span className="font-mono text-sm font-medium text-primary">{eco.reference}</span>
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-xs truncate">{eco.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {ECO_TYPE_LABELS[eco.ecoType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{eco.product?.name}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{eco.stage?.name}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{eco.user?.name}</TableCell>
                      <TableCell>
                        <Badge className={`${lifecycleBadge.className} text-xs`}>
                          {lifecycleBadge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ── Kanban view ── */
        /* ecosByStage was built with reduce() above — each entry is one stage column */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.entries(ecosByStage).map(([stageName, stageEcos]) => (
            <div key={stageName} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-foreground">{stageName}</h3>
                <Badge variant="secondary" className="rounded-full px-2 text-xs">{stageEcos.length}</Badge>
              </div>
              <div className="space-y-2.5">
                {stageEcos.map((eco) => {
                  const lifecycleBadge = getLifecycleBadge(eco);
                  return (
                  <Card
                    key={eco.id}
                    className={`cursor-pointer shadow-sm hover:shadow-md transition-all duration-150 border-l-4 ${STATE_BORDER[eco.state] || 'border-l-gray-300'} active:scale-[0.98]`}
                    onClick={() => navigate(`/ecos/${eco.id}`)}
                  >
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium text-primary">{eco.reference}</span>
                        <Badge className={`${lifecycleBadge.className} text-xs`}>
                          {lifecycleBadge.label}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm text-foreground line-clamp-2 leading-snug">{eco.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-normal">
                          {ECO_TYPE_LABELS[eco.ecoType]}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">{eco.product?.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                        <span>{eco.user?.name}</span>
                        {eco.effectiveDate && (
                          <span>{new Date(eco.effectiveDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
