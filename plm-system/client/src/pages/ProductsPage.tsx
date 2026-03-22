import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProductStore } from '@/stores/productStore';
import { useAuthStore } from '@/stores/authStore';
import { STATUS_LABELS, STATUS_COLORS, canCreateProtectedRecords } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Search, Plus, Package } from 'lucide-react';

function EmptyState({ onNew }: { onNew?: () => void }) {
  return (
    <div className="plm-empty-state">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <Package className="h-8 w-8 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">No products yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {onNew
          ? 'Add your first product to get started with lifecycle management.'
          : 'No products are available for your role yet.'}
      </p>
      {onNew ? (
        <Button onClick={onNew}>
          <Plus className="h-4 w-4" />
          New Product
        </Button>
      ) : null}
    </div>
  );
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { products, isLoading, fetchProducts } = useProductStore();
  const [searchQuery, setSearchQuery] = useState('');
  const canCreate = canCreateProtectedRecords(user?.role);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts({ search: searchQuery });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="plm-page-header">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="plm-page-heading">Products</h2>
            <p className="plm-page-subtitle">Manage active and archived product versions with clearer lifecycle visibility.</p>
          </div>
          <Badge variant="secondary" className="rounded-full px-2.5">{products.length}</Badge>
        </div>
        {canCreate ? (
          <Button onClick={() => navigate('/master-data/products/new')}>
            <Plus className="h-4 w-4" />
            New Product
          </Button>
        ) : null}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by product name..."
            className="pl-9 h-9 rounded-lg text-sm focus-visible:ring-1 focus-visible:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </form>

      {/* Table */}
      <Card variant="panel">
        <CardContent className="p-0">
          {products.length === 0 ? (
            <EmptyState onNew={canCreate ? () => navigate('/master-data/products/new') : undefined} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Product Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Version</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Sales Price</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Cost Price</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Attachments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product, idx) => (
                  <motion.tr
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30, delay: idx * 0.05 }}
                    className="cursor-pointer hover:bg-primary/5 transition-colors border-b last:border-0"
                    onClick={() => navigate(`/master-data/products/${product.id}`)}
                  >
                    <TableCell className="font-medium text-sm">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal text-primary border-primary/30">
                        v{product.version}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      ₹{product.salesPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      ₹{product.costPrice.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLORS[product.status]} text-xs`}>
                        {STATUS_LABELS[product.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {product.attachments?.length || 0} files
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
