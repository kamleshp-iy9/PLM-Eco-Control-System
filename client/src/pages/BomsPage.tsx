import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBomStore } from '@/stores/bomStore';
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
import { Search, Plus, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function BomsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { boms, isLoading, fetchBoms } = useBomStore();
  const { products, fetchProducts } = useProductStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const canCreate = canCreateProtectedRecords(user?.role);

  useEffect(() => {
    fetchBoms();
    fetchProducts();
  }, [fetchBoms, fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBoms({ search: searchQuery, productId: productFilter });
  };

  const clearFilter = () => {
    setProductFilter('');
    fetchBoms({ search: searchQuery });
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
    <div className="space-y-5">
      <div className="plm-page-header">
        <div>
          <h2 className="plm-page-heading">Bill of Materials</h2>
          <p className="plm-page-subtitle">Review structures, filter by finished product, and open controlled versions quickly.</p>
        </div>
        {canCreate ? (
          <Button onClick={() => navigate('/master-data/boms/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New BoM
          </Button>
        ) : null}
      </div>

      <div className="plm-toolbar">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by reference or product..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {productFilter && (
            <Button variant="ghost" onClick={clearFilter}>
              Clear
            </Button>
          )}
        </form>
      </div>

      <Card variant="panel">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Finished Product</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Components</TableHead>
                <TableHead>Operations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {canCreate ? 'No BoMs found. Create your first one!' : 'No BoMs found.'}
                  </TableCell>
                </TableRow>
              ) : (
                boms.map((bom) => (
                  <TableRow
                    key={bom.id}
                    data-interactive="true"
                    onClick={() => navigate(`/master-data/boms/${bom.id}`)}
                  >
                    <TableCell className="font-mono">{bom.reference}</TableCell>
                    <TableCell>{bom.product?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">v{bom.version}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[bom.status]}>
                        {STATUS_LABELS[bom.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{bom._count?.components || 0}</TableCell>
                    <TableCell>{bom._count?.operations || 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
