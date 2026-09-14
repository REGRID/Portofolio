'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Inisialisasi Lenis dengan kurva easing exponential sesuai panduan remyshoots
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    // Sinkronisasi Lenis scroll ke GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    // Sinkronisasi RAF Lenis dengan GSAP Ticker
    const updateTicker = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(updateTicker);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Pause Lenis on full-screen infinite canvas page (/work/[category])
  useEffect(() => {
    if (!lenisRef.current) return;
    if (pathname.startsWith('/work/')) {
      lenisRef.current.stop();
    } else {
      lenisRef.current.start();
    }
  }, [pathname]);

  return <>{children}</>;
}
