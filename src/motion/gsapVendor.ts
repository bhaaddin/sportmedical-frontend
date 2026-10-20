/* GSAP + ScrollTrigger, registered once. Imported with import() by ScrollScene only: it is a chunk of its own
   ('gsap', vite.config.ts) that exists in the public site's home route and nowhere else. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bridgeScrollTrigger } from './scrollBridge';

gsap.registerPlugin(ScrollTrigger);
bridgeScrollTrigger(ScrollTrigger);

export { gsap, ScrollTrigger };
