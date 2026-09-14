'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export interface ScrollRevealOptions {
  y?: number;
  opacity?: number;
  duration?: number;
  delay?: number;
  start?: string;
  end?: string;
  ease?: string;
  toggleActions?: string;
  scrub?: boolean | number;
}

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: ScrollRevealOptions
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        y: options?.y ?? 60,
        opacity: options?.opacity ?? 0,
        duration: options?.duration ?? 1,
        delay: options?.delay ?? 0,
        ease: options?.ease ?? 'power3.out',
        scrollTrigger: {
          trigger: ref.current,
          start: options?.start ?? 'top 85%',
          end: options?.end,
          scrub: options?.scrub,
          toggleActions: options?.toggleActions ?? 'play none none reverse',
        },
      });
    }, ref);

    return () => ctx.revert();
  }, [
    options?.y,
    options?.opacity,
    options?.duration,
    options?.delay,
    options?.start,
    options?.end,
    options?.ease,
    options?.toggleActions,
    options?.scrub,
  ]);

  return ref;
}
