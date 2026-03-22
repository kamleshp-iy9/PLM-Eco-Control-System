import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ECO_STATE_COLORS, ECO_STATE_LABELS, ECO_TYPE_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Archive, ClipboardList, Download, GitCompare, Layers, LayoutGrid, Package } from 'lucide-react';

const TABS = [
  { value: 'ecos', label: 'ECOs', icon: ClipboardList, endpoint: '/reports/ecos' },
  { value: 'product-versions', label: 'Product Versions', icon: Package, endpoint: '/reports/product-versions' },
  { value: 'bom-changes', label: 'BoM Changes', icon: Layers, endpoint: '/reports/bom-changes' },
  { value: 'archived-products', label: 'Archived', icon: Archive, endpoint: '/reports/archived-products' },
  { value: 'active-matrix', label: 'Active Matrix', icon: LayoutGrid, endpoint: '/reports/active-matrix' },
];

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function ReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ecos');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({});

  const activeConfig = TABS.find((tab) => tab.value === activeTab) || TABS[0];

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(activeConfig.endpoint);
      setData(response.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch report data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const downloadCsv = async () => {
    try {
      const response = await api.get(activeConfig.endpoint, {
        params: { format: 'csv' },
        responseType: 'blob',
      });

      const disposition = response.headers['content-disposition'] || '';
      const match = disposition.match(/filename=\"?([^"]+)\"?/);
      const filename = match?.[1] || `${activeTab}.csv`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to export CSV');
    }
  };

  const thClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <div className="space-y-5">
      <div className="plm-page-header">
        <div>
          <h2 className="plm-page-heading">Reporting</h2>
          <p className="plm-page-subtitle">Trace ECO activity, version history, and active manufacturing structures from one place.</p>
        </div>
        <Button variant="outline" onClick={downloadCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-10 gap-0.5 bg-muted/60 p-1">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 px-3 text-xs data-[state=active]:bg-background">
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="ecos" className="mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card variant="panel">
              <CardContent className="p-0">
                {isLoading ? <TableSkeleton /> : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className={thClass}>Reference</TableHead>
                        <TableHead className={thClass}>Title</TableHead>
                        <TableHead className={thClass}>Type</TableHead>
                        <TableHead className={thClass}>Product</TableHead>
                        <TableHead className={thClass}>Responsible</TableHead>
                        <TableHead className={thClass}>Effective</TableHead>
                        <TableHead className={thClass}>Applied</TableHead>
                        <TableHead className={thClass}>State</TableHead>
                        <TableHead className={thClass}>Changes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!data.ecos?.length ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">No ECOs found</TableCell>
                        </TableRow>
                      ) : (
                        data.ecos.map((eco: any) => (
                          <TableRow key={eco.id}>
                            <TableCell className="font-mono text-sm text-primary">{eco.reference}</TableCell>
                            <TableCell className="font-medium text-sm">{eco.title}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{ECO_TYPE_LABELS[eco.ecoType]}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{eco.product?.name || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{eco.user?.name || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{eco.effectiveDate ? new Date(eco.effectiveDate).toLocaleDateString() : '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{eco.appliedAt ? new Date(eco.appliedAt).toLocaleDateString() : '—'}</TableCell>
                            <TableCell><Badge className={ECO_STATE_COLORS[eco.state]}>{ECO_STATE_LABELS[eco.state]}</Badge></TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/ecos/${eco.id}/changes`)}
                              >
                                <GitCompare className="h-3 w-3" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="product-versions" className="mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card variant="panel">
              <CardContent className="p-0">
                {isLoading ? <TableSkeleton /> : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className={thClass}>Product</TableHead>
                        <TableHead className={thClass}>Version</TableHead>
                        <TableHead className={thClass}>Sales Price</TableHead>
                        <TableHead className={thClass}>Cost Price</TableHead>
                        <TableHead className={thClass}>Status</TableHead>
                        <TableHead className={thClass}>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!data.versions?.length ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No product versions found</TableCell>
                        </TableRow>
                      ) : (
                        data.versions.map((version: any, index: number) => (
                          <TableRow key={`${version.productId}-${version.version}-${index}`} className="hover:bg-primary/5">
                            <TableCell className="font-medium text-sm">{version.productName}</TableCell>
                            <TableCell><Badge variant="outline">v{version.version}</Badge></TableCell>
                            <TableCell className="font-mono text-sm">₹{version.salesPrice?.toFixed(2)}</TableCell>
                            <TableCell className="font-mono text-sm">₹{version.costPrice?.toFixed(2)}</TableCell>
                            <TableCell><Badge className={STATUS_COLORS[version.status]}>{STATUS_LABELS[version.status]}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(version.createdAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="bom-changes" className="mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card variant="panel">
              <CardContent className="p-0">
                {isLoading ? <TableSkeleton /> : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className={thClass}>BoM Reference</TableHead>
                        <TableHead className={thClass}>Finished Product</TableHead>
                        <TableHead className={thClass}>Version</TableHead>
                        <TableHead className={thClass}>Components</TableHead>
                        <TableHead className={thClass}>Operations</TableHead>
                        <TableHead className={thClass}>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!data.bomChanges?.length ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No BoM changes found</TableCell>
                        </TableRow>
                      ) : (
                        data.bomChanges.map((bom: any) => (
                          <TableRow key={bom.bomId} className="hover:bg-primary/5">
                            <TableCell className="font-mono text-sm text-primary">{bom.reference}</TableCell>
                            <TableCell className="font-medium text-sm">{bom.finishedProduct}</TableCell>
                            <TableCell><Badge variant="outline">v{bom.version}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{bom.componentsCount}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{bom.operationsCount}</TableCell>
                            <TableCell><Badge className={STATUS_COLORS[bom.status]}>{STATUS_LABELS[bom.status]}</Badge></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="archived-products" className="mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card variant="panel">
              <CardContent className="p-0">
                {isLoading ? <TableSkeleton /> : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className={thClass}>Product</TableHead>
                        <TableHead className={thClass}>Version</TableHead>
                        <TableHead className={thClass}>Sales Price</TableHead>
                        <TableHead className={thClass}>Cost Price</TableHead>
                        <TableHead className={thClass}>Archived</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!data.products?.length ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No archived products</TableCell>
                        </TableRow>
                      ) : (
                        data.products.map((product: any) => (
                          <TableRow key={product.id} className="hover:bg-primary/5">
                            <TableCell className="font-medium text-sm">{product.name}</TableCell>
                            <TableCell><Badge variant="outline">v{product.version}</Badge></TableCell>
                            <TableCell className="font-mono text-sm">₹{product.salesPrice?.toFixed(2)}</TableCell>
                            <TableCell className="font-mono text-sm">₹{product.costPrice?.toFixed(2)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(product.updatedAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="active-matrix" className="mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card variant="panel">
              <CardContent className="p-0">
                {isLoading ? <TableSkeleton /> : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className={thClass}>Product</TableHead>
                        <TableHead className={thClass}>Product Version</TableHead>
                        <TableHead className={thClass}>BoM Reference</TableHead>
                        <TableHead className={thClass}>BoM Version</TableHead>
                        <TableHead className={thClass}>Components</TableHead>
                        <TableHead className={thClass}>Operations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!data.matrix?.length ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No active matrix data</TableCell>
                        </TableRow>
                      ) : (
                        data.matrix.map((item: any, index: number) => (
                          <TableRow key={`${item.productId}-${index}`} className="hover:bg-primary/5">
                            <TableCell className="font-medium text-sm">{item.productName}</TableCell>
                            <TableCell><Badge variant="outline">v{item.productVersion}</Badge></TableCell>
                            <TableCell className="font-mono text-sm text-primary">{item.bomReference || '—'}</TableCell>
                            <TableCell>{item.bomVersion ? <Badge variant="outline">v{item.bomVersion}</Badge> : '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.componentsCount}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.operationsCount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
