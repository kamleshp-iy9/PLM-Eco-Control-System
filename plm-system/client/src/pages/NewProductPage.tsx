import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '@/stores/productStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Package,
  IndianRupee,
  Loader2,
  Save,
  CheckCircle2,
  Tag,
  TrendingDown,
  TrendingUp,
  Info,
} from 'lucide-react';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
      {required && <span className="text-primary ml-0.5">*</span>}
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
    <div className="flex items-center gap-3 mb-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

export function NewProductPage() {
  const navigate = useNavigate();
  const { createProduct } = useProductStore();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [salesPrice, setSalesPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');

  const salesPriceNum = parseFloat(salesPrice) || 0;
  const costPriceNum = parseFloat(costPrice) || 0;
  const margin =
    salesPriceNum > 0
      ? (((salesPriceNum - costPriceNum) / salesPriceNum) * 100).toFixed(1)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!salesPrice || salesPriceNum <= 0) {
      toast.error('Sales price must be greater than 0');
      return;
    }
    if (!costPrice || costPriceNum < 0) {
      toast.error('Cost price must be 0 or greater');
      return;
    }

    setIsLoading(true);
    try {
      const product = await createProduct({
        name: name.trim(),
        salesPrice: salesPriceNum,
        costPrice: costPriceNum,
        attachments: [],
      });
      toast.success(`Product "${product.name}" created successfully`);
      navigate(`/master-data/products/${product.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to create product');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-5xl">
      {/* Back */}
      <Button
        type="button"
        variant="ghost"
        onClick={() => navigate('/master-data/products')}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Products
      </Button>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">New Product</h1>
            <p className="text-xs text-muted-foreground">
              Add a new product to the master data catalogue
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/master-data/products')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Create Product
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Main Form ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Product Information */}
          <Card variant="panel">
            <CardContent className="p-6">
              <SectionHeader
                icon={Package}
                title="Product Information"
                description="Basic details for the new product"
              />
              <div className="space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <FieldLabel required>Product Name</FieldLabel>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. iPhone 17 Display Assembly"
                    className="h-10"
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use a clear, descriptive name — version 1 will be assigned automatically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card variant="panel">
            <CardContent className="p-6">
              <SectionHeader
                icon={IndianRupee}
                title="Pricing"
                description="Set the initial sales and cost price"
              />
              <div className="grid grid-cols-2 gap-4">
                {/* Sales Price */}
                <div className="space-y-1.5">
                  <FieldLabel required>Sales Price</FieldLabel>
                  <div className="relative">
                    <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={salesPrice}
                      onChange={(e) => setSalesPrice(e.target.value)}
                      placeholder="0.00"
                      className="h-10 pl-9"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Price charged to the customer</p>
                </div>

                {/* Cost Price */}
                <div className="space-y-1.5">
                  <FieldLabel required>Cost Price</FieldLabel>
                  <div className="relative">
                    <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="0.00"
                      className="h-10 pl-9"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Internal manufacturing / procurement cost</p>
                </div>
              </div>

              {/* Margin preview */}
              {salesPriceNum > 0 && costPriceNum >= 0 && (
                <div className={`mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
                  salesPriceNum > costPriceNum
                    ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10'
                    : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10'
                }`}>
                  <IndianRupee className={`h-4 w-4 shrink-0 ${salesPriceNum > costPriceNum ? 'text-green-600' : 'text-red-500'}`} />
                  <span className="text-muted-foreground text-xs">
                    Gross margin:{' '}
                    <span className={`font-semibold ${salesPriceNum > costPriceNum ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {margin}%
                    </span>
                    {' '}(₹{(salesPriceNum - costPriceNum).toFixed(2)} per unit)
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="space-y-4">
          {/* Summary */}
          <Card variant="panel">
            <CardContent className="p-5">
              <SectionHeader icon={CheckCircle2} title="Summary" />
              <dl className="space-y-3">
                {[
                  { label: 'Name', value: name.trim() || '—', icon: Tag },
                  {
                    label: 'Sales Price',
                    value: salesPriceNum > 0 ? `₹${salesPriceNum.toFixed(2)}` : '—',
                    icon: TrendingUp,
                  },
                  {
                    label: 'Cost Price',
                    value: costPriceNum > 0 ? `₹${costPriceNum.toFixed(2)}` : '—',
                    icon: TrendingDown,
                  },
                  { label: 'Initial Version', value: 'v1', icon: Package },
                  { label: 'Status', value: 'Active', icon: CheckCircle2 },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3 w-3" />
                      {label}
                    </div>
                    <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                      {value}
                    </span>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {/* Tips */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-semibold text-primary">What happens next?</p>
            </div>
            <ol className="space-y-1.5 text-xs text-muted-foreground list-none">
              {[
                'Product is created at version 1, status Active',
                'Add a Bill of Materials to define components',
                'Raise an ECO to propose and track any changes',
                'ECO approval will auto-increment the version',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </form>
  );
}
