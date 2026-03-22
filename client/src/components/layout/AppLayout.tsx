import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PageTransition } from '@/components/motion/PageTransition';

interface AppLayoutProps {
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

export function AppLayout({ onSearch, searchPlaceholder }: AppLayoutProps) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div>
        <Header
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          onSearch={onSearch}
          searchPlaceholder={searchPlaceholder}
        />

        <main className="mx-auto w-full max-w-[1600px] px-3 pb-6 pt-3 sm:px-5 sm:pb-8 sm:pt-4 lg:px-8 lg:pb-10 lg:pt-6">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
