import { motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeOut',
  duration: 0.35,
};

export default function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}

/* Staggered list children — wrap a parent and each child animates in sequence */
export function StaggerContainer({ children, sx }: { children: React.ReactNode; sx?: React.CSSProperties }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.07 } },
      }}
      style={sx}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { type: 'tween', ease: 'easeOut', duration: 0.3 } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* Lift-on-hover wrapper for cards */
export function HoverLift({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}

/* Scale on click */
export function PressScale({ children }: { children: React.ReactNode }) {
  return (
    <motion.div whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
      {children}
    </motion.div>
  );
}
