import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useBomStore } from '@/stores/bomStore';
import { useProductStore } from '@/stores/productStore';
import { DEFAULT_BOM_UNIT, STATIC_UNIT_OPTIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  CheckCircle2,
  Factory,
  Layers,
  Loader2,
  Package,
  Plus,
  Save,
  Trash2,
  Wrench,
} from 'lucide-react';

interface ComponentRow {
  componentName: string;
  quantity: number;
  units: string;
}

interface OperationRow {
  operationName: string;
  expectedDuration: number;
  workCenter: string;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-primary">*</span>}
    </Label>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

export function NewBomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createBom } = useBomStore();
  const { products, fetchProducts } = useProductStore();

  const [isLoading, setIsLoading] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [operations, setOperations] = useState<OperationRow[]>([]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const queryProductId = searchParams.get('productId') || '';
    if (queryProductId) {
      setProductId(queryProductId);
    }
  }, [searchParams]);

  const activeProducts = products.filter((product) => product.status === 'ACTIVE');

  const addComponent = () =>
    setComponents([...components, { componentName: '', quantity: 1, units: DEFAULT_BOM_UNIT }]);

  const updateComponent = (index: number, field: keyof ComponentRow, value: string | number) => {
    const next = [...components];
    next[index] = { ...next[index], [field]: value };
    setComponents(next);
  };

  const removeComponent = (index: number) =>
    setComponents(components.filter((_, itemIndex) => itemIndex !== index));

  const addOperation = () =>
    setOperations([...operations, { operationName: '', expectedDuration: 0, workCenter: '' }]);

  const updateOperation = (index: number, field: keyof OperationRow, value: string | number) => {
    const next = [...operations];
    next[index] = { ...next[index], [field]: value };
    setOperations(next);
  };

  const removeOperation = (index: number) =>
    setOperations(operations.filter((_, itemIndex) => itemIndex !== index));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!productId) {
      toast.error('Product is required');
      return;
    }

    const parsedQuantity = parseFloat(quantity || '0');
    if (!parsedQuantity || parsedQuantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    const cleanedComponents = components.filter((component) => component.componentName.trim());
    const cleanedOperations = operations.filter((operation) => operation.operationName.trim());

    setIsLoading(true);
    try {
      const bom = await createBom({
        productId,
        quantity: parsedQuantity,
        units: DEFAULT_BOM_UNIT,
        components: cleanedComponents.map((component) => ({
          componentName: component.componentName.trim(),
          quantity: Number(component.quantity) || 0,
          units: component.units || DEFAULT_BOM_UNIT,
        })),
        operations: cleanedOperations.map((operation) => ({
          operationName: operation.operationName.trim(),
          expectedDuration: Number(operation.expectedDuration) || 0,
          workCenter: operation.workCenter.trim(),
        })),
      });

      toast.success(`BoM ${bom.reference} created successfully`);
      navigate(`/master-data/boms/${bom.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to create BoM');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl space-y-5">
      <Button
        type="button"
        variant="ghost"
        onClick={() => navigate('/master-data/boms')}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to BoMs
      </Button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">New Bill of Materials</h1>
            <p className="text-xs text-muted-foreground">
              Create the active manufacturing structure for a product.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/master-data/boms')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Create BoM
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card variant="panel">
            <CardContent className="p-6">
              <SectionHeader
                icon={Package}
                title="BoM Information"
                description="Select the active product and define the base quantity."
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <FieldLabel required>Finished Product</FieldLabel>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select an active product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel required>Quantity</FieldLabel>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

            </CardContent>
          </Card>

          <Card variant="panel">
            <CardContent className="p-6">
              <SectionHeader
                icon={Factory}
                title="Components"
                description="List the materials or sub-assemblies required to build this product."
              />

              <div className="space-y-3">
                {components.map((component, index) => (
                  <div
                    key={`component-${index}`}
                    className="grid grid-cols-[1fr_120px_140px_36px] gap-2 rounded-lg border border-border/50 bg-muted/20 p-2"
                  >
                    <Input
                      placeholder="Component name"
                      value={component.componentName}
                      onChange={(event) => updateComponent(index, 'componentName', event.target.value)}
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="none"
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={component.quantity}
                      onChange={(event) =>
                        updateComponent(index, 'quantity', parseFloat(event.target.value || '0'))
                      }
                      className="h-8 text-sm"
                    />
                    <Select
                      value={component.units || DEFAULT_BOM_UNIT}
                      onValueChange={(value) => updateComponent(index, 'units', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATIC_UNIT_OPTIONS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeComponent(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addComponent}
                  className="w-full border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  Add Component
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card variant="panel">
            <CardContent className="p-6">
              <SectionHeader
                icon={Wrench}
                title="Operations"
                description="Add the production operations needed for this BoM."
              />

              <div className="space-y-3">
                {operations.map((operation, index) => (
                  <div
                    key={`operation-${index}`}
                    className="grid grid-cols-[1fr_130px_130px_36px] gap-2 rounded-lg border border-border/50 bg-muted/20 p-2"
                  >
                    <Input
                      placeholder="Operation name"
                      value={operation.operationName}
                      onChange={(event) => updateOperation(index, 'operationName', event.target.value)}
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="none"
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={operation.expectedDuration}
                      onChange={(event) =>
                        updateOperation(index, 'expectedDuration', parseInt(event.target.value || '0', 10))
                      }
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Work center"
                      value={operation.workCenter}
                      onChange={(event) => updateOperation(index, 'workCenter', event.target.value)}
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="none"
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOperation(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addOperation}
                  className="w-full border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  Add Operation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card variant="panel">
            <CardContent className="p-5">
              <SectionHeader icon={CheckCircle2} title="Summary" />
              <dl className="space-y-3">
                {[
                  {
                    label: 'Product',
                    value: activeProducts.find((product) => product.id === productId)?.name || '—',
                    icon: Package,
                  },
                  { label: 'Quantity', value: quantity || '—', icon: Layers },
                  { label: 'Components', value: String(components.filter((item) => item.componentName.trim()).length), icon: Factory },
                  { label: 'Operations', value: String(operations.filter((item) => item.operationName.trim()).length), icon: Wrench },
                  { label: 'Initial Version', value: 'v1', icon: CheckCircle2 },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3 w-3" />
                      {label}
                    </div>
                    <span className="max-w-[140px] truncate text-xs font-medium text-foreground">
                      {value}
                    </span>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
