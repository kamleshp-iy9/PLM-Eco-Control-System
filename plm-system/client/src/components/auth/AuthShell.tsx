import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Zap } from 'lucide-react';

const features = [
  'Multi-stage ECO approval workflows',
  'Product and BoM versioning with full audit history',
  'Role-based access, approvals, and traceability',
];

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_38%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--background)))]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="relative hidden overflow-hidden border-r border-white/8 bg-[linear-gradient(160deg,rgba(38,36,84,0.98),rgba(25,24,58,0.96))] px-10 py-12 lg:flex lg:flex-col lg:justify-between"
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 18%, rgba(129,140,248,0.22), transparent 28%), radial-gradient(circle at 82% 74%, rgba(168,85,247,0.18), transparent 26%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: '44px 44px',
            }}
          />

          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-[0_20px_50px_rgba(79,70,229,0.28)] backdrop-blur-xl">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-wide text-white">PLM System</p>
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-200/55">
                Engineering Change Control
              </p>
            </div>
          </div>

          <div className="relative max-w-lg space-y-7">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-200/50">
                Product Lifecycle Workspace
              </p>
              <h1 className="text-4xl font-semibold leading-tight text-white">
                {title}
              </h1>
              <p className="max-w-md text-sm leading-7 text-indigo-100/72">
                {description}
              </p>
            </div>

            <div className="grid gap-3">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.045] px-4 py-3 backdrop-blur-md"
                >
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                  <p className="text-sm text-indigo-100/82">{feature}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-xs text-indigo-200/42">
            Structured engineering approvals for products and manufacturing data.
          </p>
        </motion.aside>

        <motion.main
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.08 }}
          className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10"
        >
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12 shadow-[var(--plm-shadow-button)]">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">PLM System</p>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Engineering change control
                </p>
              </div>
            </div>
            {children}
          </div>
        </motion.main>
      </div>
    </div>
  );
}
