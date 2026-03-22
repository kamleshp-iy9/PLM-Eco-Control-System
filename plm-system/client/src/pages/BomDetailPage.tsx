import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useBomStore } from '@/stores/bomStore';
import { useAuthStore } from '@/stores/authStore';
import { STATUS_COLORS, STATUS_LABELS, canCreateProtectedRecords } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FilePlus, History } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function BomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentBom,
    versions,
    isLoading,
    fetchBom,
    fetchBomVersions,
    restoreBomVersion,
  } = useBomStore();
  const canCreate = canCreateProtectedRecords(user?.role);

  useEffect(() => {
    if (!id) return;
    fetchBom(id);
    fetchBomVersions(id);
  }, [id, fetchBom, fetchBomVersions]);

  const handleRestore = async (versionId: string, version: number) => {
    if (!id) return;
    try {
      const eco = await restoreBomVersion(id, versionId);
      toast.success(`Restore ECO created for BoM version ${version}`);
      navigate(`/ecos/${eco.id}/edit`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to create restore ECO');
    }
  };

  if (isLoading || !currentBom) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card variant="hero">
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="toolbar" size="icon" onClick={() => navigate('/master-data/boms')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_COLORS[currentBom.status]}>{STATUS_LABELS[currentBom.status]}</Badge>
                <Badge variant="outline">v{currentBom.version}</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-bold">{currentBom.reference}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentBom.product?.name} manufacturing structure with components and operations.
              </p>
            </div>
          </div>
          {canCreate ? (
            <Button
              variant="outline"
              onClick={() => navigate(`/ecos/new?bomId=${currentBom.id}&productId=${currentBom.productId}`)}
            >
              <FilePlus className="mr-2 h-4 w-4" />
              Raise ECO
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card variant="metric">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Quantity</p>
            <p className="text-2xl font-bold">{currentBom.quantity}</p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Units</p>
            <p className="text-2xl font-bold">{currentBom.units}</p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Version</p>
            <p className="text-2xl font-bold">{currentBom.version}</p>
          </CardContent>
        </Card>
        <Card variant="metric">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className={STATUS_COLORS[currentBom.status]}>{STATUS_LABELS[currentBom.status]}</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="components">
        <TabsList>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>
        <TabsContent value="components">
          <Card variant="panel">
            <CardHeader>
              <CardTitle>Components</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!currentBom.components?.length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        No components
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentBom.components.map((component) => (
                      <TableRow key={component.id}>
                        <TableCell>{component.componentName}</TableCell>
                        <TableCell>{component.quantity}</TableCell>
                        <TableCell>{component.units}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="operations">
          <Card variant="panel">
            <CardHeader>
              <CardTitle>Operations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operation</TableHead>
                    <TableHead>Expected Duration</TableHead>
                    <TableHead>Work Center</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!currentBom.operations?.length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        No operations
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentBom.operations.map((operation) => (
                      <TableRow key={operation.id}>
                        <TableCell>{operation.operationName}</TableCell>
                        <TableCell>{operation.expectedDuration} min</TableCell>
                        <TableCell>{operation.workCenter}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card variant="panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!versions.length ? (
            <p className="text-sm text-muted-foreground">No previous BoM versions found.</p>
          ) : (
            versions.map((version) => (
              <div key={version.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">v{version.version}</p>
                    <Badge className={STATUS_COLORS[version.status]}>{STATUS_LABELS[version.status]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {version.components?.length || 0} components · {version.operations?.length || 0} operations
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(version.createdAt).toLocaleString()}
                  </p>
                </div>
                {version.id !== currentBom.id && canCreate ? (
                  <Button variant="outline" onClick={() => handleRestore(version.id, version.version)}>
                    Restore Through ECO
                  </Button>
                ) : (
                  <Badge variant="outline">Current</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
