/* PressScale - the element dips on press and springs back. Pure CSS (class `sm-press`, src/motion/motion.css), by
   design: feedback to a press must never wait for a download. The depth comes from the --sm-press variable, which
   is 0.97 in 'plné'/'omezené' and 1 (no transform) in 'vypnuto'. */
import { createElement } from 'react';
import type { ElementType, HTMLAttributes, ReactNode } from 'react';

export interface PressScaleProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
  [key: string]: unknown;
}

export function PressScale({ as = 'button', className, children, ...rest }: PressScaleProps) {
  return createElement(as, { className: className ? `sm-press ${className}` : 'sm-press', ...rest }, children);
}
