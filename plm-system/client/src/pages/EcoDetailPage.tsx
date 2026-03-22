// ─── EcoDetailPage — view + act on a single ECO ──────────────────────────────
// Shows full details for one ECO: title, stage pipeline, approval rules, history,
// and action buttons (Approve / Validate / Reject).
//
// This page is the richest use of React hooks in the app:
//
//   useState  — stores whether the approve/reject dialogs are open, and the
//               comment text inside those dialogs.
//   useEffect — fetches the specific ECO from the API when the page loads,
//               and again if the URL id param ever changes (e.g. navigating
//               from one ECO detail directly to another).
//   useMemo   — computes derived display values (button labels, pipeline stages)
//               only when their dependencies change, avoiding redundant recalculation.

// useState  — stores values that React should track and re-render for.
//             Each call returns [currentValue, setterFunction].
// useEffect — side-effect runner. Fetches data, subscriptions, etc.
//             Runs after paint. Dependencies control when it re-fires.
// useMemo   — memoizes an expensive calculation. Only recomputes when
//             the listed dependencies change. Returns the cached result otherwise.
import { useEffect, useMemo, useState } from 'react';

// useParams — React Router hook. Reads dynamic URL segments.
// On the route /ecos/:id, useParams() returns { id: 'abc-123' }.
// useNavigate — returns a navigate() function for programmatic routing.
import { useNavigate, useParams } from 'react-router-dom';

import { toast } from 'sonner';

// Global state stores (Zustand)
// useEcoStore  — holds the fetched ECO data and action functions
// useAuthStore — holds the logged-in user (needed for role-based button visibility)
import { useEcoStore } from '@/stores/ecoStore';
import { useAuthStore } from '@/stores/authStore';

import { ECO_STATE_COLORS, ECO_STATE_LABELS, ECO_TYPE_LABELS, ROLES, ROLE_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  CheckCircle2,
  FileText,
  GitCompare,
  Package,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── StagePipeline component ──────────────────────────────────────────────────
// Visual stepper that shows where the ECO is in its workflow.
// Completed stages are filled, the current stage has a ring, future stages are grey.
function StagePipeline({ stages, currentStageId }: { stages: any[]; currentStageId: string }) {
  // Find where we are in the pipeline by matching the current stage ID
  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);

  return (
    <div className="flex w-full items-center overflow-x-auto">
      {stages.map((stage, index) => {
        const isCurrent = index === currentIndex;
        // A stage is "complete" if it's before the current one, or if it's the
        // current final/apply stage (meaning the ECO is done)
        const isFinalCurrentStage = isCurrent && (stage.isFinal || stage.allowApplyChanges || stage.name === 'Done');
        const isComplete = index < currentIndex || isFinalCurrentStage;

        return (
          <div key={stage.id} className="flex min-w-0 flex-1 items-center">
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              {/* Circle indicator — colour depends on completion state */}
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2',
                  isComplete && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && !isComplete && 'border-primary bg-background text-primary ring-4 ring-primary/20',
                  !isComplete && !isCurrent && 'border-muted-foreground/20 bg-muted text-muted-foreground'
                )}
              >
                {/* Show a checkmark for completed stages, step number for others */}
                {isComplete ? <CheckCheck className="h-4 w-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
              </div>
              <span className={cn('whitespace-nowrap text-xs font-medium', isCurrent || isComplete ? 'text-primary' : 'text-muted-foreground')}>
                {stage.name}
              </span>
            </div>
            {/* Connector line between stages — filled if the stage is complete */}
            {index < stages.length - 1 ? (
              <div className={cn('mx-2 mb-5 h-0.5 flex-1 rounded', index < currentIndex ? 'bg-primary' : 'bg-border')} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// getInitials — turns a full name like "Alice Brown" into "AB" for avatar display
function getInitials(name?: string) {
  return name?.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// getLifecycleBadge — maps the ECO's state + stage into a human-friendly label
function getLifecycleBadge(eco: any) {
  if (!eco?.isStarted && eco?.stage?.name === 'New') {
    return { label: 'New', className: 'bg-muted text-muted-foreground' };
  }
  if (eco?.state === 'IN_PROGRESS' && eco?.stage?.name === 'Approval') {
    return { label: 'Pending Approval', className: 'bg-amber-100 text-amber-800' };
  }
  return {
    label: ECO_STATE_LABELS[eco.state],
    className: ECO_STATE_COLORS[eco.state],
  };
}

// ─── EcoDetailPage ────────────────────────────────────────────────────────────
export function EcoDetailPage() {
  // useParams — reads the :id segment from the URL /ecos/:id
  // If the URL is /ecos/abc-123, then id = 'abc-123'
  const { id } = useParams<{ id: string }>();

  const navigate = useNavigate();

  // Pull the logged-in user from global state
  const { user } = useAuthStore();

  // Pull ECO-related state and actions from the global ECO store
  // currentEco   — the ECO object fetched by fetchEco(id)
  // stages       — all ECO workflow stages (for the pipeline component)
  // isLoading    — true while the API call is in-flight
  // fetchEco     — fetches one ECO by ID and stores it in currentEco
  // approveEco   — calls POST /api/ecos/:id/approve
  // validateEco  — calls POST /api/ecos/:id/validate (no approval rules needed)
  // rejectEco    — calls POST /api/ecos/:id/reject
  const { currentEco, stages, isLoading, fetchEco, approveEco, validateEco, rejectEco } = useEcoStore();

  // ─── useState: dialog open/close flags ────────────────────────────────────
  // These track whether the Approve or Reject confirmation dialogs are open.
  // false = closed. Calling setIsApproveDialogOpen(true) opens the dialog.
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  // ─── useState: comment text ────────────────────────────────────────────────
  // Stores whatever the user types in the textarea inside the approve/reject dialogs.
  // The Textarea is a controlled input: it always shows this value and updates it onChange.
  const [comments, setComments] = useState('');

  // ─── useEffect: fetch the ECO when the page loads ─────────────────────────
  // Dependencies: [id, fetchEco]
  //   • Runs immediately when the component mounts (page first loads)
  //   • Runs again if `id` changes — handles navigating from /ecos/1 to /ecos/2
  //     without a full page refresh (React Router keeps the component mounted)
  // Without this, currentEco would stay null and nothing would render.
  useEffect(() => {
    if (id) fetchEco(id); // GET /api/ecos/:id — populates currentEco in the store
  }, [id, fetchEco]);

  const eco = currentEco;
  const lifecycleBadge = eco ? getLifecycleBadge(eco) : null;

  // Check if the logged-in user has write access (admin or engineer)
  const isEngineering = user?.role === ROLES.ADMIN || user?.role === ROLES.ENGINEERING_USER;

  // Destructure approval data from the ECO object
  const stageRules = eco?.stageApprovalRules || [];
  const stageApprovals = eco?.stageApprovals || [];

  // Build a Set of user IDs who still need to approve — O(1) lookup in the render loop
  const pendingApproverIds = new Set((eco?.pendingApprovers || []).map((rule: any) => rule.userId));

  // Find where the current stage sits in the full stage list
  const currentStageIndex = stages.findIndex((stage) => stage.id === eco?.stageId);
  const nextStage = currentStageIndex >= 0 ? stages[currentStageIndex + 1] : null;

  // ─── useMemo: visibleStages ────────────────────────────────────────────────
  // useMemo caches the result of the filtering function.
  // Without useMemo, this filter would run on every render (including when
  // the dialogs open/close). With useMemo it only runs when `stages` changes.
  // Here we hide "In Progress" from the visual pipeline to keep it clean.
  const visibleStages = useMemo(
    () => stages.filter((stage) => stage.name !== 'In Progress'),
    [stages] // only recompute if the stages list itself changes
  );

  // ─── useMemo: pipelineCurrentStageId ──────────────────────────────────────
  // The pipeline component needs a stage ID to highlight as "current".
  // When an ECO is in "In Progress" stage, we display it as if it's at
  // "Approval" in the visual pipeline (since we hide "In Progress" above).
  // useMemo ensures this calculation only runs when eco or visibleStages changes.
  const pipelineCurrentStageId = useMemo(() => {
    if (!eco) return '';
    if (eco.stage?.name !== 'In Progress') return eco.stageId; // use actual stage ID
    // Map "In Progress" → "Approval" in the visual pipeline
    return visibleStages.find((stage) => stage.name === 'Approval')?.id || eco.stageId;
  }, [eco, visibleStages]);

  // ─── useMemo: stageActionLabel ────────────────────────────────────────────
  // The approve button label changes based on what the current user can do:
  //   "Approve & Apply" — last approval needed AND changes will be auto-applied
  //   "Approve"         — recording an approval
  //   "Comment"         — user is COMMENT_ONLY so they can't vote, just comment
  // useMemo recalculates only when `eco` changes, not on every render.
  const stageActionLabel = useMemo(() => {
    if (!eco) return 'Approve';
    if (eco.canApprove && eco.canApplyChanges) return 'Approve & Apply';
    if (eco.canApprove) return 'Approve';
    if (eco.canComment) return 'Comment';
    return 'Approve';
  }, [eco]);

  // ─── useMemo: validateActionLabel ─────────────────────────────────────────
  // Similar to stageActionLabel but for the validate path (stages without approval rules).
  // Shows contextual text: "Send to Approver" when the next stage needs approvals.
  const validateActionLabel = useMemo(() => {
    if (!eco) return 'Validate & Advance';
    if (eco.canApplyChanges) return 'Validate & Apply';
    if (nextStage?.requiresApproval || nextStage?.name === 'Approval') return 'Send to Approver';
    return 'Validate & Advance';
  }, [eco, nextStage]);

  // refresh — re-fetches the ECO after an action so the UI reflects the latest state
  const refresh = () => {
    if (id) fetchEco(id);
  };

  // ─── Action handlers ───────────────────────────────────────────────────────

  // handleApprove — submits the approval (or comment) to the API.
  // On success: shows a toast, closes the dialog, clears the comments, refreshes.
  // On failure: shows the server error message in a toast.
  const handleApprove = async () => {
    try {
      await approveEco(id!, comments);
      toast.success(`${stageActionLabel} recorded`);
      setIsApproveDialogOpen(false); // close dialog
      setComments('');               // clear the textarea for next time
      refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to record approval');
    }
  };

  // handleValidate — advances the ECO to the next stage (no approval needed).
  // The success message changes based on whether the next stage requires approvals.
  const handleValidate = async () => {
    try {
      await validateEco(id!);
      toast.success(
        nextStage?.requiresApproval || nextStage?.name === 'Approval'
          ? 'ECO sent to approver'
          : 'ECO advanced to the next stage'
      );
      refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to validate ECO');
    }
  };

  // handleReject — sends the ECO back to the previous stage (or cancels it).
  const handleReject = async () => {
    try {
      await rejectEco(id!, comments);
      toast.success('ECO rejected');
      setIsRejectDialogOpen(false);
      setComments('');
      refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to reject ECO');
    }
  };

  // Show skeleton placeholders while the ECO is being fetched from the API
  if (isLoading || !eco) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back navigation */}
      <Button onClick={() => navigate('/ecos')} variant="ghost">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to ECOs
      </Button>

      {/* ─── Hero card: ECO title, reference, badges, quick-nav buttons ─── */}
      <Card variant="hero">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {lifecycleBadge ? (
                  <Badge className={`${lifecycleBadge.className} text-xs`}>{lifecycleBadge.label}</Badge>
                ) : null}
                {eco.isApplied ? (
                  <Badge variant="outline" className="border-green-500 text-xs text-green-600">
                    ECO Applied
                  </Badge>
                ) : null}
                <Badge variant="outline" className="text-xs font-normal">
                  {ECO_TYPE_LABELS[eco.ecoType]}
                </Badge>
                <Badge variant="outline" className="text-xs font-normal">
                  {eco.stage?.name}
                </Badge>
              </div>
              <h1 className="text-xl font-bold text-foreground">{eco.title}</h1>
              <p className="font-mono text-sm font-medium text-primary">{eco.reference}</p>
              {eco.description ? <p className="max-w-3xl text-sm text-muted-foreground">{eco.description}</p> : null}
            </div>

            {/* Quick navigation buttons — open the linked BOM or Product detail page */}
            <div className="flex flex-wrap gap-2">
              {eco.ecoType === 'BOM' && eco.bomId ? (
                <Button onClick={() => navigate(`/master-data/boms/${eco.bomId}`)} variant="outline">
                  <FileText className="h-3.5 w-3.5" />
                  Open BoM
                </Button>
              ) : null}
              {eco.ecoType === 'PRODUCT' ? (
                <Button onClick={() => navigate(`/master-data/products/${eco.productId}`)} variant="outline">
                  <Package className="h-3.5 w-3.5" />
                  Open Product
                </Button>
              ) : null}
              {/* Only show Edit while the ECO hasn't been started yet */}
              {!eco.isStarted && (isEngineering || user?.id === eco.userId) ? (
                <Button onClick={() => navigate(`/ecos/${eco.id}/edit`)} variant="outline">
                  Edit ECO
                </Button>
              ) : null}
              <Button onClick={() => navigate(`/ecos/${id}/changes`)} variant="outline">
                <GitCompare className="h-3.5 w-3.5" />
                View Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Stage pipeline visual ──────────────────────────────────────────── */}
      {/* visibleStages and pipelineCurrentStageId both come from useMemo above */}
      {visibleStages.length > 0 ? (
        <Card variant="panel">
          <CardContent className="p-6">
            <StagePipeline stages={visibleStages} currentStageId={pipelineCurrentStageId} />
          </CardContent>
        </Card>
      ) : null}

      {/* ─── Action bar ─────────────────────────────────────────────────────── */}
      {/* Only show if the ECO is started, not cancelled, and not yet applied */}
      {eco.isStarted && eco.state !== 'CANCELLED' && !eco.isApplied ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[1.375rem] border border-border/70 bg-[var(--plm-surface-2)] p-4 shadow-[var(--plm-shadow-surface)]">
          <span className="mr-1 text-sm font-medium text-muted-foreground">Actions:</span>

          {/* Approve button — only visible if this stage has approval rules
              and the current user has an APPROVED or OPTIONAL rule */}
          {stageRules.length > 0 && (eco.canApprove || eco.canComment) ? (
            <Button onClick={() => setIsApproveDialogOpen(true)}>
              <CheckCircle2 className="h-4 w-4" />
              {stageActionLabel} {/* useMemo-derived label */}
            </Button>
          ) : null}

          {/* Validate button — only visible on stages without approval rules */}
          {eco.canValidate ? (
            <Button onClick={handleValidate} variant="outline">
              <ArrowRight className="h-4 w-4" />
              {validateActionLabel} {/* useMemo-derived label */}
            </Button>
          ) : null}

          {/* Reject button — only visible if the current stage supports rejection */}
          {eco.canReject ? (
            <Button onClick={() => setIsRejectDialogOpen(true)} variant="destructive">
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* ─── Details + Approvals grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ECO metadata */}
        <Card variant="panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ECO Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              {[
                { label: 'ECO Type', value: ECO_TYPE_LABELS[eco.ecoType] },
                { label: 'Product', value: eco.product?.name || '—' },
                { label: 'Assigned To', value: eco.user?.name || '—' },
                { label: 'Current Stage', value: eco.stage?.name || '—' },
                { label: 'Version Update', value: eco.versionUpdate ? 'Yes' : 'No' },
                { label: 'Effective Date', value: eco.effectiveDate ? new Date(eco.effectiveDate).toLocaleDateString() : 'Not set' },
                { label: 'Applied At', value: eco.appliedAt ? new Date(eco.appliedAt).toLocaleString() : 'Not applied' },
                { label: 'Approval Mode', value: stageRules.length > 0 ? 'Approval Required' : 'Validation Only' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="mb-0.5 text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Current stage approval rules — who needs to approve and whether they have */}
        <Card variant="panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Stage Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stageRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">This stage uses validation instead of approval.</p>
            ) : (
              stageRules.map((rule: any) => {
                // Find this approver's actual approval record (if they've acted)
                const matchedApproval = stageApprovals.find((approval: any) => approval.userId === rule.userId);
                const isPending = pendingApproverIds.has(rule.userId); // from the Set built above
                return (
                  <div key={rule.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar initials — computed inline using getInitials() */}
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {getInitials(rule.user?.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{rule.user?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {rule.name} · {ROLE_LABELS[rule.user?.role] || rule.user?.role}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[11px]">
                        {rule.approvalCategory.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {matchedApproval ? `Recorded ${new Date(matchedApproval.createdAt).toLocaleString()}` : isPending ? 'Pending approval' : 'Waiting'}
                      </span>
                      <Badge className={matchedApproval ? 'bg-green-100 text-green-800' : isPending ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}>
                        {matchedApproval ? matchedApproval.action : isPending ? 'Pending' : 'Open'}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Full approval history ───────────────────────────────────────────── */}
      <Card variant="panel">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Approval History</CardTitle>
        </CardHeader>
        <CardContent>
          {!eco.approvals?.length ? (
            <p className="text-sm text-muted-foreground">No approval activity has been recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {eco.approvals.map((approval: any) => (
                <div key={approval.id} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {getInitials(approval.user?.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{approval.user?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {approval.stage?.name} · {new Date(approval.createdAt).toLocaleString()}
                      </p>
                      {approval.comments ? <p className="mt-1 text-xs text-muted-foreground">{approval.comments}</p> : null}
                    </div>
                  </div>
                  <Badge className={approval.action === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {approval.action}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Approve dialog ──────────────────────────────────────────────────── */}
      {/* open={isApproveDialogOpen} — controlled by useState above.
          onOpenChange syncs the state when the user presses Escape or clicks outside. */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{stageActionLabel}</DialogTitle>
            <DialogDescription>
              {eco.canApplyChanges
                ? 'This action may complete the approval path and apply the controlled changes.'
                : 'Add an optional note for this stage decision.'}
            </DialogDescription>
          </DialogHeader>
          {/* Controlled textarea — value is the comments state, onChange updates it */}
          <Textarea
            placeholder="Add comments..."
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove}>
              <CheckCircle2 className="h-4 w-4" />
              {stageActionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject dialog ───────────────────────────────────────────────────── */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject ECO</DialogTitle>
            <DialogDescription>Provide a reason so the ECO can move back with context.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
