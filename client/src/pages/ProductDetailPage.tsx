import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useProductStore } from '@/stores/productStore';
import { useAuthStore } from '@/stores/authStore';
import { STATUS_COLORS, STATUS_LABELS, canCreateProtectedRecords } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FilePlus, History } from 'lucide-react';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentProduct,
    versions,
    isLoading,
    fetchProduct,
    fetchProductVersions,
    restoreProductVersion,
  } = useProductStore();
  const canCreate = canCreateProtectedRecords(user?.role);

  useEffect(() => {
    if (!id) return;
    fetchProduct(id);
    fetchProductVersions(id);
  }, [id, fetchProduct, fetchProductVersions]);

  const handleRestore = async (versionId: string, version: number) => {
    if (!id) return;
    try {
      const eco = await restoreProductVersion(id, versionId);
      toast.success(`Restore ECO created for product version ${version}`);
      navigate(`/ecos/${eco.id}/edit`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to create restore ECO');
    }
  };

  if (isLoading || !currentProduct) {
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
            <Button variant="toolbar" size="icon" onClick={() => navigate('/master-data/products')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_COLORS[currentProduct.status]}>{STATUS_LABELS[currentProduct.status]}</Badge>
                <Badge variant="outline">v{currentProduct.version}</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-bold">{currentProduct.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Current controlled product version and linked BoMs.</p>
            </div>
          </div>
          {canCreate ? (
            <Button variant="outline" onClick={() => navigate(`/ecos/new?productId=${currentProduct.id}`)}>
              <FilePlus className="mr-2 h-4 w-4" />
              Raise ECO
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card variant="panel">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Sales Price</p>
              <p className="font-medium">₹{currentProduct.salesPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost Price</p>
              <p className="font-medium">₹{currentProduct.costPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Version</p>
              <p className="font-medium">{currentProduct.version}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={STATUS_COLORS[currentProduct.status]}>
                {STATUS_LABELS[currentProduct.status]}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card variant="panel">
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!currentProduct.attachments?.length ? (
              <p className="text-sm text-muted-foreground">No active attachments</p>
            ) : (
              currentProduct.attachments.map((attachment: any, index: number) => (
                <div key={`${attachment.fileName}-${index}`} className="rounded-lg border border-border p-3">
                  <p className="font-medium">{attachment.fileName}</p>
                  <p className="text-xs text-muted-foreground">{attachment.mimeType || 'Unknown type'}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card variant="panel">
        <CardHeader>
          <CardTitle>Bill of Materials</CardTitle>
        </CardHeader>
        <CardContent>
          {!currentProduct.boms?.length ? (
            <p className="text-muted-foreground">No BoMs linked to this product</p>
          ) : (
            <div className="space-y-2">
              {currentProduct.boms.map((bom) => (
                <div
                  key={bom.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  onClick={() => navigate(`/master-data/boms/${bom.id}`)}
                >
                  <div>
                    <p className="font-medium">{bom.reference}</p>
                    <p className="text-sm text-muted-foreground">v{bom.version}</p>
                  </div>
                  <Badge className={STATUS_COLORS[bom.status]}>{STATUS_LABELS[bom.status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!versions.length ? (
            <p className="text-sm text-muted-foreground">No previous product versions found.</p>
          ) : (
            versions.map((version) => (
              <div key={version.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">v{version.version}</p>
                    <Badge className={STATUS_COLORS[version.status]}>{STATUS_LABELS[version.status]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ₹{version.salesPrice.toFixed(2)} sale · ₹{version.costPrice.toFixed(2)} cost
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(version.createdAt).toLocaleString()}
                  </p>
                </div>
                {version.id !== currentProduct.id && canCreate ? (
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
