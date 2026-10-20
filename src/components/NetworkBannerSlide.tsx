/*
 * The slide-in / slide-out of the "offline" and "server not answering" strip. It is a file of its own because it is the
 * only user of the animation library (~120 kB of script): NetworkBanner loads it the first time the strip is needed,
 * so a session that never loses its connection never downloads it.
 */
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function NetworkBannerSlide({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
