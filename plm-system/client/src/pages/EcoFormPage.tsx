import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useEcoStore } from '@/stores/ecoStore';
import { useProductStore } from '@/stores/productStore';
import { useBomStore } from '@/stores/bomStore';
import { useAuthStore } from '@/stores/authStore';
import { DEFAULT_BOM_UNIT, STATIC_UNIT_OPTIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Cpu,
  IndianRupee,
  FileText,
  Layers,
  Loader2,
  Package,
  Play,
  Plus,
  Save,
  Trash2,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function EcoFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { createEco, updateEco, startEco, currentEco, fetchEco } = useEcoStore();
  const { products, fetchProducts } = useProductStore();
  const { boms, fetchBoms } = useBomStore();

  const isEditing = Boolean(id);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ecoType, setEcoType] = useState<'PRODUCT' | 'BOM'>('PRODUCT');
  const [productId, setProductId] = useState('');
  const [bomId, setBomId] = useState('');
  const [userId, setUserId] = useState(user?.id || '');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [versionUpdate, setVersionUpdate] = useState(true);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [operations, setOperations] = useState<OperationRow[]>([]);
  const [bomSection, setBomSection] = useState<'components' | 'operations'>('components');
  const [salesPrice, setSalesPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const lastHydratedBomId = useRef<string | null>(null);
  const lastBomProductId = useRef('');

  useEffect(() => {
    fetchProducts();
    fetchBoms();
    if (isEditing && id) fetchEco(id);
  }, [fetchProducts, fetchBoms, fetchEco, id, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    const queryProductId = searchParams.get('productId') || '';
    const queryBomId = searchParams.get('bomId') || '';
    if (queryProductId) setProductId(queryProductId);
    if (queryBomId) {
      setBomId(queryBomId);
      setEcoType('BOM');
    }
  }, [searchParams, isEditing]);

  useEffect(() => {
    if (!isEditing || !currentEco) return;
    setTitle(currentEco.title);
    setDescription(currentEco.description || '');
    setEcoType(currentEco.ecoType as 'PRODUCT' | 'BOM');
    setProductId(currentEco.productId);
    setBomId(currentEco.bomId || '');
    setUserId(currentEco.userId);
    setEffectiveDate(currentEco.effectiveDate?.split('T')[0] || '');
    setVersionUpdate(currentEco.versionUpdate);
    if ((currentEco as any).proposedBomChanges) {
      setComponents((currentEco as any).proposedBomChanges.components || []);
      setOperations((currentEco as any).proposedBomChanges.operations || []);
    }
    if ((currentEco as any).proposedProductChanges) {
      setSalesPrice((currentEco as any).proposedProductChanges.salesPrice?.toString() || '');
      setCostPrice((currentEco as any).proposedProductChanges.costPrice?.toString() || '');
    }
  }, [isEditing, currentEco]);

  useEffect(() => {
    if (ecoType !== 'BOM') {
      setBomId('');
      lastHydratedBomId.current = null;
      setBomSection('components');
    }
  }, [ecoType]);

  useEffect(() => {
    if (isEditing || ecoType !== 'BOM') {
      lastBomProductId.current = productId || '';
      return;
    }

    if (lastBomProductId.current && lastBomProductId.current !== productId) {
      setBomId('');
      setComponents([]);
      setOperations([]);
      setBomSection('components');
      lastHydratedBomId.current = null;
    }

    lastBomProductId.current = productId || '';
  }, [isEditing, ecoType, productId]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.status === 'ACTIVE'),
    [products]
  );
  const selectedProduct = useMemo(
    () => activeProducts.find((product) => product.id === productId),
    [activeProducts, productId]
  );
  const filteredBoms = useMemo(
    () => boms.filter((bom) => bom.productId === productId && bom.status === 'ACTIVE'),
    [boms, productId]
  );
  const isStarted = isEditing && Boolean((currentEco as any)?.isStarted);
  const startedStageLabel = currentEco?.stage?.name || 'Approval';

  useEffect(() => {
    if (isEditing || !selectedProduct) return;

    setSalesPrice(selectedProduct.salesPrice?.toString() || '');
    setCostPrice(selectedProduct.costPrice?.toString() || '');

    if (ecoType === 'PRODUCT') {
      setTitle(`Update ${selectedProduct.name}`);
      setDescription(`Engineering change for ${selectedProduct.name} v${selectedProduct.version}.`);
      return;
    }

    const preferredBom =
      filteredBoms.find((bom) => bom.id === bomId) ||
      filteredBoms[0] ||
      null;

    if (!preferredBom) {
      if (bomId) {
        setBomId('');
      }
      lastHydratedBomId.current = null;
      setTitle(`Update ${selectedProduct.name} BoM`);
      setDescription(`Engineering change for ${selectedProduct.name}.`);
      return;
    }

    if (bomId !== preferredBom.id) {
      setBomId(preferredBom.id);
    }

    setTitle(`Update ${preferredBom.reference}`);
    setDescription(
      `Engineering change for ${selectedProduct.name} using active BoM ${preferredBom.reference}.`
    );
  }, [
    isEditing,
    selectedProduct,
    ecoType,
    bomId,
    filteredBoms,
  ]);

  useEffect(() => {
    if (isEditing || ecoType !== 'BOM' || !bomId) return;
    if (lastHydratedBomId.current === bomId) return;

    let isActive = true;

    const hydrateBom = async () => {
      try {
        const response = await api.get(`/boms/${bomId}`);
        const bom = response.data.data.bom;

        if (!isActive) return;

        setComponents(
          (bom.components || []).map((component: any) => ({
            componentName: component.componentName,
            quantity: component.quantity,
            units: component.units || DEFAULT_BOM_UNIT,
          }))
        );
        setOperations(
          (bom.operations || []).map((operation: any) => ({
            operationName: operation.operationName,
            expectedDuration: operation.expectedDuration,
            workCenter: operation.workCenter,
          }))
        );
        lastHydratedBomId.current = bomId;
      } catch (error: any) {
        if (!isActive) return;
        setComponents([]);
        setOperations([]);
        lastHydratedBomId.current = null;
        toast.error(error.response?.data?.error || 'Failed to load the current BoM details');
      }
    };

    hydrateBom();

    return () => {
      isActive = false;
    };
  }, [isEditing, ecoType, bomId]);

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

  const buildPayload = () => {
    if (!title.trim()) throw new Error('Title is required');
    if (!productId) throw new Error('Product is required');
    if (ecoType === 'BOM' && !bomId) throw new Error('Bill of Materials is required');

    const payload: any = {
      title,
      description: description.trim() || undefined,
      ecoType,
      productId,
      userId,
      effectiveDate: effectiveDate || undefined,
      versionUpdate,
    };

    if (ecoType === 'BOM') {
      payload.bomId = bomId;
      payload.proposedBomChanges = { components, operations };
    } else {
      payload.proposedProductChanges = {
        salesPrice: salesPrice === '' ? undefined : parseFloat(salesPrice),
        costPrice: costPrice === '' ? undefined : parseFloat(costPrice),
        attachments: currentEco?.product?.attachments || selectedProduct?.attachments || [],
      };
    }

    return payload;
  };

  const persistEco = async (redirectOnCreate: boolean) => {
    const payload = buildPayload();
    if (isEditing && id) {
      await updateEco(id, payload);
      return id;
    }
    const eco = await createEco(payload);
    if (redirectOnCreate) navigate(`/ecos/${eco.id}/edit`);
    return eco.id;
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const ecoId = await persistEco(true);
      toast.success(isEditing ? 'ECO updated' : 'New ECO created');
      if (isEditing) navigate(`/ecos/${ecoId}/edit`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to save ECO');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const ecoId = await persistEco(false);
      await startEco(ecoId);
      toast.success('ECO created and sent to approval');
      navigate(`/ecos/${ecoId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to start ECO');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-4 sm:space-y-5">
      <Button
        onClick={() => navigate('/ecos')}
        variant="ghost"
        className="w-full justify-start sm:w-auto"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to ECOs
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground sm:text-xl">
              {isEditing ? 'Edit ECO' : 'Create New ECO'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? `Editing ECO ${currentEco?.reference || ''}`
                : 'Create a controlled engineering change for a product or BoM.'}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
          <Button
            onClick={() => navigate('/ecos')}
            variant="outline"
            className="w-full sm:flex-1 lg:w-auto lg:flex-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || isStarted}
            variant="outline"
            className="w-full sm:flex-1 lg:w-auto lg:flex-none"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save ECO
          </Button>
          <Button
            onClick={handleStart}
            disabled={isLoading || isStarted}
            className="w-full sm:flex-1 lg:w-auto lg:flex-none"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {isEditing ? 'Send To Approval' : 'Create & Send To Approval'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="space-y-5 lg:col-span-2">
          <Card variant="panel">
            <CardContent className="p-4 sm:p-6">
              <SectionHeader
                icon={FileText}
                title="ECO Information"
                description="Only active master data can be selected for a new ECO."
              />

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <FieldLabel required>Title</FieldLabel>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Update control board BoM for Rev B"
                    disabled={isStarted}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Description</FieldLabel>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the reason, scope, and expected result of this change"
                    disabled={isStarted}
                    className="min-h-[110px]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel required>ECO Type</FieldLabel>
                    <Select
                      value={ecoType}
                      onValueChange={(value) => setEcoType(value as 'PRODUCT' | 'BOM')}
                      disabled={isStarted}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRODUCT">Product</SelectItem>
                        <SelectItem value="BOM">Bill of Materials</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel required>Product</FieldLabel>
                    <Select value={productId} onValueChange={setProductId} disabled={isStarted}>
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
                </div>

                {ecoType === 'BOM' ? (
                  <div className="space-y-1.5">
                    <FieldLabel required>Bill of Materials</FieldLabel>
                    <Select value={bomId} onValueChange={setBomId} disabled={isStarted || !productId}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={!productId ? 'Select a product first...' : 'Select an active BoM...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredBoms.length === 0 ? (
                          <SelectItem value="__no-bom__" disabled>
                            No active BoMs are available for this product
                          </SelectItem>
                        ) : (
                          filteredBoms.map((bom) => (
                            <SelectItem key={bom.id} value={bom.id}>
                              {`${bom.reference} • v${bom.version}`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel required>Assigned To</FieldLabel>
                    <Select value={userId} onValueChange={setUserId} disabled={isStarted}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={user?.id || ''}>{user?.name || 'Current User'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel>Effective Date</FieldLabel>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="date"
                        value={effectiveDate}
                        onChange={(event) => setEffectiveDate(event.target.value)}
                        disabled={isStarted}
                        className="h-10 pl-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <Checkbox
                    id="versionUpdate"
                    checked={versionUpdate}
                    onCheckedChange={(checked) => setVersionUpdate(checked as boolean)}
                    disabled={isStarted}
                    className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                  />
                  <div>
                    <Label htmlFor="versionUpdate" className="cursor-pointer text-sm font-medium">
                      Version Update
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Create a new controlled version when this ECO is finally applied.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!isStarted ? (
            <Card variant="panel">
              <CardContent className="p-4 sm:p-6">
                <SectionHeader
                  icon={ecoType === 'BOM' ? Layers : IndianRupee}
                  title="Proposed Changes"
                  description={
                    ecoType === 'BOM'
                      ? 'Define the future structure and operations for the controlled revision.'
                      : 'Define the commercial values that should go live after approval.'
                  }
                />

                {ecoType === 'BOM' ? (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/45 p-1 shadow-[var(--plm-shadow-button-muted)] sm:flex-row sm:flex-wrap sm:items-center">
                      <Button
                        type="button"
                        variant={bomSection === 'components' ? 'secondary' : 'ghost'}
                        className={cn(
                          'h-9 w-full rounded-xl px-3.5 text-xs sm:w-auto',
                          bomSection === 'components' && 'border border-primary/15 bg-background/80 text-foreground shadow-[var(--plm-shadow-button-muted)]'
                        )}
                        onClick={() => setBomSection('components')}
                      >
                        <Cpu className="h-3.5 w-3.5" />
                        Components
                        {components.length > 0 ? (
                          <Badge variant="secondary" className="ml-1 rounded-full px-1.5 py-0 text-[10px]">
                            {components.length}
                          </Badge>
                        ) : null}
                      </Button>
                      <Button
                        type="button"
                        variant={bomSection === 'operations' ? 'secondary' : 'ghost'}
                        className={cn(
                          'h-9 w-full rounded-xl px-3.5 text-xs sm:w-auto',
                          bomSection === 'operations' && 'border border-primary/15 bg-background/80 text-foreground shadow-[var(--plm-shadow-button-muted)]'
                        )}
                        onClick={() => setBomSection('operations')}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        Operations
                        {operations.length > 0 ? (
                          <Badge variant="secondary" className="ml-1 rounded-full px-1.5 py-0 text-[10px]">
                            {operations.length}
                          </Badge>
                        ) : null}
                      </Button>
                    </div>

                    {bomSection === 'components' ? (
                      <div className="space-y-3">
                      {components.map((component, index) => (
                        <div
                          key={`eco-component-${index}`}
                          className="grid grid-cols-1 gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_110px_130px_40px] sm:p-2"
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
                            onClick={() => removeComponent(index)}
                            variant="ghost"
                            size="icon-sm"
                            className="h-9 w-full text-muted-foreground hover:text-destructive sm:h-9 sm:w-9"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        onClick={addComponent}
                        variant="outline"
                        className="w-full border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <Plus className="h-4 w-4" />
                        Add Component
                      </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                      {operations.map((operation, index) => (
                        <div
                          key={`eco-operation-${index}`}
                          className="grid grid-cols-1 gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_40px] sm:p-2"
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
                            onClick={() => removeOperation(index)}
                            variant="ghost"
                            size="icon-sm"
                            className="h-9 w-full text-muted-foreground hover:text-destructive sm:h-9 sm:w-9"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        onClick={addOperation}
                        variant="outline"
                        className="w-full border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <Plus className="h-4 w-4" />
                        Add Operation
                      </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <FieldLabel>New Sales Price</FieldLabel>
                      <div className="relative">
                        <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="number"
                          value={salesPrice}
                          onChange={(event) => setSalesPrice(event.target.value)}
                          placeholder="0.00"
                          className="h-10 pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>New Cost Price</FieldLabel>
                      <div className="relative">
                        <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="number"
                          value={costPrice}
                          onChange={(event) => setCostPrice(event.target.value)}
                          placeholder="0.00"
                          className="h-10 pl-9"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card variant="panel">
            <CardContent className="p-4 sm:p-5">
              <SectionHeader icon={AlertCircle} title="Status" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current State</span>
                  <Badge
                    className={cn('text-xs', isStarted ? 'bg-blue-100 text-blue-800' : 'bg-muted text-muted-foreground')}
                  >
                    {isStarted ? startedStageLabel : 'New'}
                  </Badge>
                </div>
                {currentEco?.stage ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Stage</span>
                    <span className="text-xs font-medium">{currentEco.stage.name}</span>
                  </div>
                ) : !isStarted ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Stage</span>
                    <span className="text-xs font-medium">New</span>
                  </div>
                ) : null}
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  New-stage changes stay isolated until the ECO reaches the final apply-enabled stage.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="panel">
            <CardContent className="p-4 sm:p-5">
              <SectionHeader icon={CheckCircle2} title="Summary" />
              <dl className="space-y-3">
                {[
                  {
                    label: 'Type',
                    value: ecoType === 'BOM' ? 'Bill of Materials' : 'Product',
                    icon: ecoType === 'BOM' ? Layers : Package,
                  },
                  {
                    label: 'Product',
                    value: selectedProduct?.name || '—',
                    icon: Package,
                  },
                  ...(ecoType === 'BOM'
                    ? [{
                        label: 'BoM',
                        value: filteredBoms.find((bom) => bom.id === bomId)?.reference || '—',
                        icon: FileText,
                      }]
                    : []),
                  {
                    label: 'Version Update',
                    value: versionUpdate ? 'Yes' : 'No',
                    icon: CheckCircle2,
                  },
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
    </div>
  );
}
