import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Fade In animation
interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
}

export function FadeIn({ children, delay = 0, duration = 0.3 }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay }}
    >
      {children}
    </motion.div>
  );
}

// Slide Up animation
interface SlideUpProps {
  children: ReactNode;
  delay?: number;
  distance?: number;
}

export function SlideUp({ children, delay = 0, distance = 20 }: SlideUpProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Scale animation
interface ScaleProps {
  children: ReactNode;
  delay?: number;
}

export function Scale({ children, delay = 0 }: ScaleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Stagger children animation
interface StaggerProps {
  children: ReactNode[];
  staggerDelay?: number;
}

export function Stagger({ children, staggerDelay = 0.1 }: StaggerProps) {
  return (
    <>
      {children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: index * staggerDelay,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </>
  );
}

// Page transition wrapper
interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Hover scale effect
interface HoverScaleProps {
  children: ReactNode;
  scale?: number;
}

export function HoverScale({ children, scale = 1.02 }: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Pulse animation for notifications
interface PulseProps {
  children: ReactNode;
}

export function Pulse({ children }: PulseProps) {
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

// Animated counter
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({
  value,
  duration = 1,
  decimals = 0,
  prefix = '',
  suffix = '',
}: AnimatedCounterProps) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {prefix}{value.toFixed(decimals)}{suffix}
    </motion.span>
  );
}
