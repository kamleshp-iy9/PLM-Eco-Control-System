import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEcoStore } from '@/stores/ecoStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, FileText, GitCompare, Minus, Package, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

interface DiffRow {
  name: string;
  change: ChangeType;
  quantity: { old: number; new: number; diff: number };
  duration: { old: number; new: number; diff: number };
  workCenter: { old: string; new: string };
  workCenterChanged?: boolean;
  units: string;
}

const CHANGE_BADGE: Record<ChangeType, string> = {
  added: 'bg-green-100 text-green-800',
  removed: 'bg-red-100 text-red-800',
  modified: 'bg-amber-100 text-amber-800',
  unchanged: 'bg-muted text-muted-foreground',
};

function MetricCard({ label, data }: { label: string; data: { old: number; new: number; diff: number } }) {
  const changed = data.diff !== 0;
  return (
    <div className={cn('rounded-xl border p-5', changed ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30')}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-end gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="text-xl font-bold">₹{data.old.toFixed(2)}</p>
        </div>
        <ArrowRight className="mb-1.5 h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Proposed</p>
          <p className="text-xl font-bold text-primary">₹{data.new.toFixed(2)}</p>
        </div>
        <Badge className={cn('mb-1.5', changed ? (data.diff > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800') : 'bg-muted text-muted-foreground')}>
          {changed ? `${data.diff > 0 ? '+' : ''}₹${data.diff.toFixed(2)}` : 'No change'}
        </Badge>
      </div>
    </div>
  );
}

function BomDiffTable({ title, rows, isOperation }: { title: string; rows: DiffRow[]; isOperation?: boolean }) {
  const sorted = [...rows].sort((a, b) => {
    const order = { added: 0, modified: 1, removed: 2, unchanged: 3 };
    return order[a.change] - order[b.change];
  });

  return (
    <Card variant="panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline">
            {rows.filter((row) => row.change !== 'unchanged').length} changed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {isOperation ? 'Operation' : 'Component'}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {isOperation ? 'Duration' : 'Quantity'}
                  </th>
                  {isOperation ? (
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Work Center
                    </th>
                  ) : null}
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((row) => (
                  <tr key={row.name} className={row.change !== 'unchanged' ? 'bg-muted/20' : ''}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {row.change === 'added' ? <Plus className="h-3.5 w-3.5 text-green-600" /> : null}
                        {row.change === 'removed' ? <Minus className="h-3.5 w-3.5 text-red-600" /> : null}
                        {row.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isOperation ? (
                        <span>
                          {row.duration.old}
                          <ArrowRight className="mx-2 inline h-3 w-3 text-muted-foreground" />
                          {row.duration.new} min
                        </span>
                      ) : (
                        <span>
                          {row.quantity.old}
                          <ArrowRight className="mx-2 inline h-3 w-3 text-muted-foreground" />
                          {row.quantity.new} {row.units}
                        </span>
                      )}
                    </td>
                    {isOperation ? (
                      <td className="px-4 py-3">
                        {row.workCenter.old || '—'}
                        <ArrowRight className="mx-2 inline h-3 w-3 text-muted-foreground" />
                        {row.workCenter.new || '—'}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <Badge className={CHANGE_BADGE[row.change]}>{row.change}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentDiff({ attachments }: { attachments: { old: any[]; new: any[]; changed: boolean } }) {
  const oldNames = attachments.old.map((item) => item.fileName);
  const newNames = attachments.new.map((item) => item.fileName);
  const added = newNames.filter((name) => !oldNames.includes(name));
  const removed = oldNames.filter((name) => !newNames.includes(name));

  return (
    <Card variant="panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Attachments</CardTitle>
          <Badge className={attachments.changed ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}>
            {attachments.changed ? 'Changed' : 'No change'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current</p>
          <div className="space-y-2">
            {attachments.old.length === 0 ? <p className="text-sm text-muted-foreground">No active files</p> : attachments.old.map((item) => (
              <div key={`old-${item.fileName}`} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{item.fileName}</p>
                <p className="text-xs text-muted-foreground">{item.mimeType || 'Unknown type'}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed</p>
          <div className="space-y-2">
            {attachments.new.length === 0 ? <p className="text-sm text-muted-foreground">No proposed files</p> : attachments.new.map((item) => (
              <div key={`new-${item.fileName}`} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{item.fileName}</p>
                  {added.includes(item.fileName) ? <Badge className="bg-green-100 text-green-800">Added</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">{item.mimeType || 'Unknown type'}</p>
              </div>
            ))}
            {removed.map((name) => (
              <div key={`removed-${name}`} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{name}</p>
                  <Badge className="bg-red-100 text-red-800">Removed</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EcoDiffPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEcoDiff } = useEcoStore();
  const [diff, setDiff] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    getEcoDiff(id)
      .then((data) => {
        setDiff(data.diff);
        setMeta({ ecoType: data.ecoType, product: data.product, bom: data.bom });
        setError(null);
      })
      .catch((err) => setError(err.message || 'Failed to load diff'))
      .finally(() => setIsLoading(false));
  }, [id, getEcoDiff]);

  const totalChanges = useMemo(() => {
    if (!diff || !meta) return 0;
    if (meta.ecoType === 'PRODUCT') {
      return Number(diff.salesPrice?.diff !== 0) + Number(diff.costPrice?.diff !== 0) + Number(diff.attachments?.changed);
    }
    return (diff.components?.filter((row: DiffRow) => row.change !== 'unchanged').length || 0) +
      (diff.operations?.filter((row: DiffRow) => row.change !== 'unchanged').length || 0);
  }, [diff, meta]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button
          onClick={() => navigate(`/ecos/${id}`)}
          variant="ghost"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to ECO
        </Button>
        <Card variant="panel" className="border-destructive/30">
          <CardContent className="p-8 text-center">
            <p className="font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isProductEco = meta?.ecoType === 'PRODUCT';

  return (
    <div className="space-y-5">
      <Button
        onClick={() => navigate(`/ecos/${id}`)}
        variant="ghost"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to ECO
      </Button>

      <Card variant="hero">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Change Comparison</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {isProductEco ? 'Product values and files' : 'BoM components and operations'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="gap-1 text-xs">
                  {isProductEco ? <Package className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                  {isProductEco ? 'Product ECO' : 'BoM ECO'}
                </Badge>
                {meta?.product?.name ? <Badge variant="outline" className="text-xs">{meta.product.name}</Badge> : null}
                {meta?.bom?.reference ? <Badge variant="outline" className="text-xs">{meta.bom.reference}</Badge> : null}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{totalChanges}</p>
              <p className="text-xs text-muted-foreground">proposed change(s)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isProductEco ? (
        <div className="space-y-4">
          <Card variant="panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Commercial Changes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <MetricCard label="Sales Price" data={diff.salesPrice} />
              <MetricCard label="Cost Price" data={diff.costPrice} />
            </CardContent>
          </Card>
          <AttachmentDiff attachments={diff.attachments} />
        </div>
      ) : (
        <div className="space-y-4">
          <BomDiffTable title="Components" rows={diff.components || []} />
          <BomDiffTable title="Operations" rows={diff.operations || []} isOperation />
        </div>
      )}
    </div>
  );
}
