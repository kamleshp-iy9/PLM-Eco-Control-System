import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * AnimatedCard — a spring-entrance container with whileHover lift effect.
 *
 * Use `delay` for staggered sequences (0, 0.05, 0.1, …).
 * Wraps any child content — cards, panels, stats, etc.
 */

interface AnimatedCardProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function AnimatedCard({ children, delay = 0, className }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 24,
        delay,
      }}
      whileHover={{
        y: -2,
        transition: { duration: 0.2 },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
