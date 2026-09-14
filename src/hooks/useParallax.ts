'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export interface ParallaxOptions {
  yPercent?: number;
  xPercent?: number;
  scale?: number;
  rotate?: number;
  start?: string;
  end?: string;
  scrub?: boolean | number;
}

/**
 * useParallax Hook (Poin 3 Panduan RemyShoots)
 * Mengikat elemen visual ke posisi scroll secara proporsional dengan scrub: true
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(
  options?: ParallaxOptions
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;
    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: options?.yPercent ?? -20,
        xPercent: options?.xPercent ?? 0,
        scale: options?.scale,
        rotate: options?.rotate,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: options?.start ?? 'top bottom',
          end: options?.end ?? 'bottom top',
          scrub: options?.scrub ?? true,
        },
      });
    }, ref);

    return () => ctx.revert();
  }, [
    options?.yPercent,
    options?.xPercent,
    options?.scale,
    options?.rotate,
    options?.start,
    options?.end,
    options?.scrub,
  ]);

  return ref;
}
