import { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { APPROVAL_CATEGORIES, ROLE_LABELS } from '@/lib/constants';

export function SettingsPage() {
  const {
    stages,
    approvalRules,
    isLoading,
    fetchStages,
    fetchApprovalRules,
    createStage,
    updateStage,
    deleteStage,
    createApprovalRule,
    updateApprovalRule,
    deleteApprovalRule,
  } = useSettingsStore();

  const [users, setUsers] = useState<any[]>([]);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<any>(null);
  const [editingApproval, setEditingApproval] = useState<any>(null);

  const [stageName, setStageName] = useState('');
  const [stageSequence, setStageSequence] = useState('');
  const [stageRequiresApproval, setStageRequiresApproval] = useState(false);
  const [stageIsFinal, setStageIsFinal] = useState(false);
  const [stageAllowApplyChanges, setStageAllowApplyChanges] = useState(false);
  const [stageFolded, setStageFolded] = useState(false);
  const [stageDescription, setStageDescription] = useState('');

  const [approvalName, setApprovalName] = useState('');
  const [approvalUserId, setApprovalUserId] = useState('');
  const [approvalCategory, setApprovalCategory] = useState<string>(APPROVAL_CATEGORIES.REQUIRED);
  const [approvalIsActive, setApprovalIsActive] = useState(true);

  useEffect(() => {
    fetchStages();
    fetchUsers();
  }, [fetchStages]);

  useEffect(() => {
    if (!selectedStageId && stages.length > 0) {
      setSelectedStageId(stages[0].id);
    }
  }, [stages, selectedStageId]);

  useEffect(() => {
    if (selectedStageId) {
      fetchApprovalRules(selectedStageId);
    }
  }, [selectedStageId, fetchApprovalRules]);

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === selectedStageId) || null,
    [stages, selectedStageId]
  );

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users', {
        params: {
          status: 'ACTIVE',
        },
      });
      setUsers(response.data.data.users.filter((user: any) => user.role !== 'ADMIN'));
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  const handleSaveStage = async () => {
    try {
      const data = {
        name: stageName,
        sequence: parseInt(stageSequence, 10),
        requiresApproval: stageRequiresApproval,
        isFinal: stageIsFinal,
        allowApplyChanges: stageAllowApplyChanges || stageIsFinal,
        folded: stageFolded,
        description: stageDescription || null,
      };

      if (editingStage) {
        await updateStage(editingStage.id, data);
        toast.success('Stage updated');
      } else {
        await createStage(data);
        toast.success('Stage created');
      }

      setIsStageDialogOpen(false);
      resetStageForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to save stage');
    }
  };

  const handleSaveApproval = async () => {
    if (!selectedStageId) {
      toast.error('Select a stage first');
      return;
    }

    try {
      const data = {
        name: approvalName,
        userId: approvalUserId,
        approvalCategory,
        isActive: approvalIsActive,
      };

      if (editingApproval) {
        await updateApprovalRule(selectedStageId, editingApproval.id, data);
        toast.success('Approval rule updated');
      } else {
        await createApprovalRule(selectedStageId, data);
        toast.success('Approval rule created');
      }

      setIsApprovalDialogOpen(false);
      resetApprovalForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to save approval rule');
    }
  };

  const resetStageForm = () => {
    setStageName('');
    setStageSequence('');
    setStageRequiresApproval(false);
    setStageIsFinal(false);
    setStageAllowApplyChanges(false);
    setStageFolded(false);
    setStageDescription('');
    setEditingStage(null);
  };

  const resetApprovalForm = () => {
    setApprovalName('');
    setApprovalUserId('');
    setApprovalCategory(APPROVAL_CATEGORIES.REQUIRED);
    setApprovalIsActive(true);
    setEditingApproval(null);
  };

  const openEditStage = (stage: any) => {
    setEditingStage(stage);
    setStageName(stage.name);
    setStageSequence(stage.sequence.toString());
    setStageRequiresApproval(stage.requiresApproval);
    setStageIsFinal(stage.isFinal);
    setStageAllowApplyChanges(stage.allowApplyChanges);
    setStageFolded(stage.folded);
    setStageDescription(stage.description || '');
    setIsStageDialogOpen(true);
  };

  const openEditApproval = (rule: any) => {
    setEditingApproval(rule);
    setApprovalName(rule.name);
    setApprovalUserId(rule.userId);
    setApprovalCategory(rule.approvalCategory);
    setApprovalIsActive(rule.isActive);
    setIsApprovalDialogOpen(true);
  };

  if (isLoading && stages.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="plm-page-header">
        <div>
          <h1 className="plm-page-heading">PLM Settings</h1>
          <p className="plm-page-subtitle">
            Configure ECO stages and the approvers assigned to each stage.
          </p>
        </div>
        <Button
          onClick={() => {
            resetStageForm();
            setIsStageDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Stage
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card variant="panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>ECO Stages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Sequence</TableHead>
                  <TableHead>Rules</TableHead>
                  <TableHead>Apply</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((stage) => (
                  <TableRow
                    key={stage.id}
                    data-interactive="true"
                    onClick={() => setSelectedStageId(stage.id)}
                    className={selectedStageId === stage.id ? 'bg-primary/8' : undefined}
                  >
                    <TableCell>
                      <p className="font-medium">{stage.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {stage.requiresApproval && (
                          <Badge variant="outline">Approval</Badge>
                        )}
                        {stage.isFinal && <Badge>Final</Badge>}
                        {stage.folded && <Badge variant="secondary">Folded</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{stage.sequence}</TableCell>
                    <TableCell>{stage._count?.approvalRules || 0}</TableCell>
                    <TableCell>{stage.allowApplyChanges ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditStage(stage);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!['New', 'Done'].includes(stage.name) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteStage(stage.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card variant="panel">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Stage Approvals</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedStage
                  ? `Rules for ${selectedStage.name}`
                  : 'Select a stage to manage approvals'}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={!selectedStageId}
              onClick={() => {
                resetApprovalForm();
                setIsApprovalDialogOpen(true);
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedStage && (
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium">{selectedStage.name}</p>
                <p className="text-muted-foreground mt-1">
                  {selectedStage.description || 'No stage description provided.'}
                </p>
              </div>
            )}

            {!selectedStageId ? (
              <p className="text-sm text-muted-foreground">Select a stage to manage approvals.</p>
            ) : approvalRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approval rules for this stage. Users will see a Validate action instead.
              </p>
            ) : (
              <div className="space-y-3">
                {approvalRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{rule.user?.name || rule.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge>{rule.approvalCategory}</Badge>
                        <Badge variant={rule.isActive ? 'outline' : 'secondary'}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {rule.user?.role && (
                          <Badge variant="secondary">{ROLE_LABELS[rule.user.role] || rule.user.role}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditApproval(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteApprovalRule(selectedStageId, rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? 'Edit Stage' : 'Add Stage'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={stageName} onChange={(event) => setStageName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sequence</Label>
              <Input
                type="number"
                value={stageSequence}
                onChange={(event) => setStageSequence(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={stageDescription}
                onChange={(event) => setStageDescription(event.target.value)}
                placeholder="Explain what this stage means for the ECO."
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={stageRequiresApproval}
                  onCheckedChange={(checked) => setStageRequiresApproval(Boolean(checked))}
                />
                Requires approval
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={stageAllowApplyChanges}
                  onCheckedChange={(checked) => setStageAllowApplyChanges(Boolean(checked))}
                />
                Allow apply changes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={stageFolded}
                  onCheckedChange={(checked) => setStageFolded(Boolean(checked))}
                />
                Folded in pipeline
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={stageIsFinal}
                  onCheckedChange={(checked) => setStageIsFinal(Boolean(checked))}
                />
                Final stage
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingApproval ? 'Edit Approval Rule' : 'Add Approval Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={approvalUserId} onValueChange={setApprovalUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} - {ROLE_LABELS[user.role] || user.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input value={approvalName} onChange={(event) => setApprovalName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Approval Type</Label>
              <Select value={approvalCategory} onValueChange={setApprovalCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={APPROVAL_CATEGORIES.REQUIRED}>Required</SelectItem>
                  <SelectItem value={APPROVAL_CATEGORIES.OPTIONAL}>Optional</SelectItem>
                  <SelectItem value={APPROVAL_CATEGORIES.COMMENT_ONLY}>Comment Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={approvalIsActive}
                onCheckedChange={(checked) => setApprovalIsActive(Boolean(checked))}
              />
              Rule is active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApproval}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
