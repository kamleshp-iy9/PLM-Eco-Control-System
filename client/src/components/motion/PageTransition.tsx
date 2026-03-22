import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * PageTransition — wraps page content with a smooth fade + slide-up entrance.
 *
 * Used inside AppLayout to animate route transitions via AnimatePresence.
 * The `key` prop (set to location.pathname) triggers re-mount on navigation.
 */

const variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
