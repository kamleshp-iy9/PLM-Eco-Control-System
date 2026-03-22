import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import {
  ACCOUNT_STATUS_COLORS,
  ACCOUNT_STATUS_LABELS,
  REQUESTABLE_ROLES,
  ROLE_LABELS,
} from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [finalRole, setFinalRole] = useState<string>(REQUESTABLE_ROLES.ENGINEERING_USER);
  const [rejectionReason, setRejectionReason] = useState('');

  const pendingUsers = useMemo(
    () => users.filter((user) => user.accountStatus === 'PENDING_APPROVAL'),
    [users]
  );

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.data.users);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openApproveDialog = (user: any) => {
    setSelectedUser(user);
    setFinalRole(user.requestedRole || REQUESTABLE_ROLES.ENGINEERING_USER);
    setIsApproveDialogOpen(true);
  };

  const openRejectDialog = (user: any) => {
    setSelectedUser(user);
    setRejectionReason('');
    setIsRejectDialogOpen(true);
  };

  const approveUser = async () => {
    if (!selectedUser) return;

    try {
      await api.post(`/admin/users/${selectedUser.id}/approve`, {
        role: finalRole,
      });
      toast.success('User approved');
      setIsApproveDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve user');
    }
  };

  const rejectUser = async () => {
    if (!selectedUser) return;

    try {
      await api.post(`/admin/users/${selectedUser.id}/reject`, {
        reason: rejectionReason,
      });
      toast.success('User rejected');
      setIsRejectDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject user');
    }
  };

  const updateRequestedRole = async (userId: string, requestedRole: string) => {
    setUpdatingUserId(userId);
    try {
      await api.patch(`/admin/users/${userId}/requested-role`, {
        requestedRole,
      });
      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId
            ? {
                ...user,
                requestedRole,
                role: requestedRole,
              }
            : user
        )
      );
      if (selectedUser?.id === userId) {
        setSelectedUser((current: any) =>
          current
            ? {
                ...current,
                requestedRole,
                role: requestedRole,
              }
            : current
        );
      }
      toast.success('Requested role updated');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update requested role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="plm-page-heading">User Approval Queue</h1>
        <p className="plm-page-subtitle">
          Review access requests and approve the final role before users can log in.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="metric">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Pending approval</p>
            <p className="text-3xl font-bold">{pendingUsers.length}</p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active users</p>
            <p className="text-3xl font-bold">
              {users.filter((user) => user.accountStatus === 'ACTIVE').length}
            </p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Rejected users</p>
            <p className="text-3xl font-bold">
              {users.filter((user) => user.accountStatus === 'REJECTED').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card variant="panel">
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Login ID</TableHead>
                <TableHead>Requested Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{user.loginId}</TableCell>
                  <TableCell>
                    {user.accountStatus === 'PENDING_APPROVAL' ? (
                      <Select
                        value={user.requestedRole || REQUESTABLE_ROLES.ENGINEERING_USER}
                        onValueChange={(value) => updateRequestedRole(user.id, value)}
                        disabled={updatingUserId === user.id}
                      >
                        <SelectTrigger className="h-9 w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(REQUESTABLE_ROLES).map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      ROLE_LABELS[user.requestedRole] || ROLE_LABELS[user.approvedRole] || ROLE_LABELS[user.role] || user.role
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={ACCOUNT_STATUS_COLORS[user.accountStatus]}>
                      {ACCOUNT_STATUS_LABELS[user.accountStatus] || user.accountStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.accountStatus === 'PENDING_APPROVAL' ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => openApproveDialog(user)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openRejectDialog(user)}>
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {user.approvedRole
                          ? `Approved as ${ROLE_LABELS[user.approvedRole] || user.approvedRole}`
                          : 'No pending action'}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{selectedUser?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Final Role</label>
              <Select value={finalRole} onValueChange={setFinalRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(REQUESTABLE_ROLES).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={approveUser}>Approve User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejecting this access request.
            </p>
            <Textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Optional rejection reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={rejectUser}>
              Reject User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
