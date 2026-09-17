'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import gsap from 'gsap';
import { CATEGORY_DATA, CategoryProject } from '@/data/categoryData';
import { EASE, DURATION } from '@/lib/motion-tokens';

export interface GridTransitionData {
  slug: string;
  title: string;
  projects: CategoryProject[];
  rect?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  direction?: 'forward' | 'reverse';
}

interface GridTransitionContextType {
  startGridTransition: (data: GridTransitionData) => void;
  startReverseTransition: (slug: string) => void;
  isTransitionActive: boolean;
}

const GridTransitionContext = createContext<GridTransitionContextType>({
  startGridTransition: () => {},
  startReverseTransition: () => {},
  isTransitionActive: false,
});

export function useGridTransition() {
  return useContext(GridTransitionContext);
}

export function GridTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [activeTransition, setActiveTransition] = useState<GridTransitionData | null>(null);
  const portalWrapperRef = useRef<HTMLDivElement>(null);
  const portalOverlayRef = useRef<HTMLDivElement>(null);
  const isReadyToMixRef = useRef(false);
  const hasMixedRef = useRef(false);
  const activeSlugRef = useRef<string | null>(null);

  // Track pathname transitions to safely clean up overlay only when returning to homepage
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    // Clean up if returning from a /work/ route back to homepage WITHOUT reverse transition
    if (
      prevPathnameRef.current.startsWith('/work/') &&
      pathname === '/' &&
      (!activeTransition || activeTransition.direction !== 'reverse')
    ) {
      setActiveTransition(null);
      isReadyToMixRef.current = false;
      hasMixedRef.current = false;
      activeSlugRef.current = null;
    }
    prevPathnameRef.current = pathname;
  }, [pathname, activeTransition]);

  // If user hits browser Back / Forward buttons during transition, safely dismiss
  useEffect(() => {
    const handlePopState = () => {
      setActiveTransition(null);
      isReadyToMixRef.current = false;
      hasMixedRef.current = false;
      activeSlugRef.current = null;
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const startGridTransition = useCallback(
    (data: GridTransitionData) => {
      // Clear any stored drag positions for fresh Card #1 alignment
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(`portfolio_state_${data.slug}`);
          localStorage.removeItem(`portfolio_state_${data.slug}`);
        } catch {}

        // If user prefers reduced motion, navigate immediately without animation
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
          router.push(`/work/${data.slug}`);
          return;
        }
      }

      // Prefetch destination route immediately
      router.prefetch(`/work/${data.slug}`);

      isReadyToMixRef.current = false;
      hasMixedRef.current = false;
      activeSlugRef.current = data.slug;
      setActiveTransition({ ...data, direction: 'forward' });
    },
    [router]
  );

  const startReverseTransition = useCallback(
    (slug: string) => {
      if (typeof window !== 'undefined') {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
          router.push('/?section=work', { scroll: false });
          return;
        }
      }

      const categoryData = CATEGORY_DATA[slug];
      const categoryProjects = categoryData?.projects || [];

      // Prefetch homepage immediately
      router.prefetch('/?section=work');

      isReadyToMixRef.current = false;
      hasMixedRef.current = false;
      activeSlugRef.current = slug;

      setActiveTransition({
        slug,
        title: categoryData?.title || slug,
        projects: categoryProjects,
        direction: 'reverse',
      });
    },
    [router]
  );

  // GSAP 1:1 Timeline (Forward & Reverse)
  useEffect(() => {
    if (!activeTransition) return;
    const wrapper = portalWrapperRef.current;
    const overlay = portalOverlayRef.current;
    if (!wrapper || !overlay) return;

    if (activeTransition.direction === 'reverse') {
      // ── REVERSE TRANSITION ("Keluar Mundur ke Jendela") ──
      gsap.set(overlay, { opacity: 1 });
      gsap.set(wrapper, {
        left: '50%',
        top: '50%',
        width: '100vw',
        height: '100dvh',
        borderRadius: 0,
        xPercent: -50,
        yPercent: -50,
        position: 'fixed',
      });
      // Accents start hidden while full-screen, reappear as frame contracts
      gsap.set('.portal-accent-line, .portal-center-border', { opacity: 0 });

      // Navigate to homepage section=work immediately under the overlay
      router.push('/?section=work', { scroll: false });

      const tl = gsap.timeline({
        onComplete: () => {
          setActiveTransition(null);
          isReadyToMixRef.current = false;
          hasMixedRef.current = false;
          activeSlugRef.current = null;
        },
      });

      // 1. Fase Kontraksi: Layar penuh menyusut mundur ke dalam jendela kartu tengah (345x475)
      tl.to(wrapper, {
        height: 475,
        duration: 0.82,
        ease: EASE.expoInOut.gsap,
      })
      .to(wrapper, {
        width: 345,
        borderRadius: 24,
        duration: 0.78,
        ease: EASE.expoInOut.gsap,
      }, '<0.08')
      // Fade back in the cyan accents and border as it shrinks into card shape
      .to('.portal-accent-line, .portal-center-border', {
        opacity: 1,
        duration: DURATION.medium,
        ease: EASE.smoothOut.gsap,
      }, '-=0.35')
      // 2. Fase Meluncur ke Slot Kartu di Homepage
      .call(() => {
        const targetCardEl = document.getElementById(`work-card-${activeTransition.slug}`);
        let targetLeft = window.innerWidth / 2;
        let targetTop = window.innerHeight / 2;
        let targetWidth = 345;
        let targetHeight = 475;
        let targetRadius = 16;

        if (targetCardEl) {
          const r = targetCardEl.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            targetLeft = r.left + r.width / 2;
            targetTop = r.top + r.height / 2;
            targetWidth = r.width;
            targetHeight = r.height;
          }
        }

        gsap.to(wrapper, {
          left: targetLeft,
          top: targetTop,
          width: targetWidth,
          height: targetHeight,
          borderRadius: targetRadius,
          duration: 0.46,
          ease: EASE.smoothOut.gsap,
        });
      })
      .to({}, { duration: 0.46 })
      // 3. Settle & Dissolve: fade out overlay smoothly into homepage card
      .to(overlay, {
        opacity: 0,
        duration: 0.38,
        ease: EASE.inOut.gsap,
      });

      return () => {
        tl.kill();
      };
    }

    // ── FORWARD TRANSITION (Glide -> Hold -> Expand to 100vw x 100dvh) ──
    if (!activeTransition.rect) return;

    gsap.set(overlay, { opacity: 1 });
    gsap.set(wrapper, {
      left: activeTransition.rect.left + activeTransition.rect.width / 2,
      top: activeTransition.rect.top + activeTransition.rect.height / 2,
      width: activeTransition.rect.width,
      height: activeTransition.rect.height,
      borderRadius: 16,
      xPercent: -50,
      yPercent: -50,
      position: 'fixed',
    });

    const tl = gsap.timeline({
      onComplete: () => {
        isReadyToMixRef.current = true;
        // Navigate to the category page while overlay remains 100% opaque on top
        router.push(`/work/${activeTransition.slug}`);

        // Safety fallback: if pathname change doesn't trigger within 2.5s, force mix
        setTimeout(() => {
          if (!hasMixedRef.current && portalOverlayRef.current) {
            hasMixedRef.current = true;
            gsap.to(portalOverlayRef.current, {
              opacity: 0,
              duration: DURATION.mix,
              ease: EASE.inOut.gsap,
              onComplete: () => {
                setActiveTransition(null);
                isReadyToMixRef.current = false;
                activeSlugRef.current = null;
              },
            });
          }
        }, 2500);
      },
    });

    // 1. Smoothly glide to center using signature smoothOut curve
    tl.to(wrapper, {
      left: '50%',
      top: '50%',
      width: 345,
      height: 475,
      borderRadius: 24,
      duration: 0.42,
      ease: EASE.smoothOut.gsap,
    })
    // 2. Fase A: Idle hold in center
    .to({}, { duration: DURATION.hold })
    // 3. Fase B: Expand width using expoInOut
    .to(wrapper, {
      width: '100vw',
      borderRadius: 0,
      duration: DURATION.revealWidth,
      ease: EASE.expoInOut.gsap,
    }, '>')
    // 4. Fase B: Expand height (starts 0.1s after width)
    .to(wrapper, {
      height: '100dvh',
      borderRadius: 0,
      duration: DURATION.revealHeight,
      ease: EASE.expoInOut.gsap,
    }, '<0.1')
    // Smoothly dissolve portal accents (red outline and cyan bottom line)
    .to('.portal-accent-line, .portal-center-border', {
      opacity: 0,
      duration: DURATION.medium,
      ease: EASE.smoothOut.gsap,
    }, `-=${DURATION.medium}`);

    return () => {
      tl.kill();
    };
  }, [activeTransition, router]);

  // EFFECT MIX: Trigger cross-dissolve ONLY once destination route (/work/[category]) is active
  useEffect(() => {
    if (!activeTransition || activeTransition.direction === 'reverse') return;
    if (!isReadyToMixRef.current || hasMixedRef.current) return;

    const targetPath = `/work/${activeTransition.slug}`;
    if (pathname === targetPath || (activeSlugRef.current && pathname.includes(activeSlugRef.current))) {
      hasMixedRef.current = true;

      // Small 60ms paint buffer so destination canvas finishes layout before dissolve
      const timer = setTimeout(() => {
        if (portalOverlayRef.current) {
          gsap.to(portalOverlayRef.current, {
            opacity: 0,
            duration: DURATION.mix,
            ease: EASE.inOut.gsap,
            onComplete: () => {
              setActiveTransition(null);
              isReadyToMixRef.current = false;
              activeSlugRef.current = null;
            },
          });
        } else {
          setActiveTransition(null);
          isReadyToMixRef.current = false;
          activeSlugRef.current = null;
        }
      }, 60);

      return () => clearTimeout(timer);
    }
  }, [pathname, activeTransition]);

  return (
    <GridTransitionContext.Provider
      value={{
        startGridTransition,
        startReverseTransition,
        isTransitionActive: !!activeTransition,
      }}
    >
      {children}

      {/* PERSISTENT FULL-VIEWPORT GRID PORTAL (Keeps overlay alive across route unmount) */}
      {activeTransition && (
        <div
          ref={portalOverlayRef}
          className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden flex items-center justify-center select-none bg-black/95 will-change-opacity"
        >
          {/* Ambient Blue Radial Glow behind the centered card */}
          <div className="absolute w-[520px] h-[520px] rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

          {/* Animated Mask / Wrapper Container driven by GSAP */}
          <div
            ref={portalWrapperRef}
            className="overflow-hidden will-change-transform flex items-center justify-center relative"
            style={{
              boxShadow: '0 0 70px rgba(0,0,0,0.95), 0 0 40px rgba(56,189,248,0.4)',
              border: '1.5px solid rgba(56,189,248,0.7)',
            }}
          >
            {/* Real Mosaic Grid replicating exact TILE_WIDTH=345, TILE_HEIGHT=475 layout */}
            <div className="absolute inset-0 pointer-events-none select-none">
              {[-3, -2, -1, 0, 1, 2, 3].map((dx) =>
                [-2, -1, 0, 1, 2].map((dy) => {
                  const isCenter = dx === 0 && dy === 0;
                  const dist = Math.hypot(dx, dy);
                  const N = activeTransition.projects.length || 1;
                  const projIdx = (((dx + dy) % N) + N) % N;
                  const project = activeTransition.projects[projIdx] || activeTransition.projects[0];
                  const thumbnail = project?.thumbnail || '/reference_assets/card_studio74_art.jpg';

                  // Fish-eye barrel scale compression towards outer periphery
                  const tileScale = isCenter ? 1.22 : Math.max(1.15, 1.22 - dist * 0.018);
                  // Progressive optical blur: 0px at center, up to 2.8px at extreme edges
                  const tileBlur = isCenter ? 0 : Math.min(dist * 0.85, 2.8).toFixed(1);

                  return (
                    <div
                      key={`portal_tile_${dx}_${dy}`}
                      className="absolute overflow-hidden bg-black select-none pointer-events-none"
                      style={{
                        left: `calc(50% - 172.5px + ${dx * 345}px)`,
                        top: `calc(50% - 237.5px + ${dy * 475}px)`,
                        width: '345px',
                        height: '475px',
                      }}
                    >
                      <div
                        className="w-full h-full relative will-change-transform"
                        style={{ transform: `scale(${tileScale})` }}
                      >
                        <img
                          src={thumbnail}
                          alt=""
                          className={`w-full h-full object-cover pointer-events-none ${
                            isCenter ? 'opacity-100' : 'opacity-70'
                          }`}
                          style={{
                            filter: isCenter
                              ? 'none'
                              : `grayscale(100%) brightness(0.65) contrast(1.15) blur(${tileBlur}px)`,
                          }}
                        />
                        {isCenter && (
                          <div className="portal-center-border absolute inset-0 border-2 border-red-500/80 pointer-events-none" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Optical Fish-Eye Periphery Lens Blur (Center pin-sharp; outer sides softly blur) */}
            <div
              className="absolute inset-0 pointer-events-none z-15 select-none"
              style={{
                backdropFilter: 'blur(3.5px)',
                WebkitBackdropFilter: 'blur(3.5px)',
                maskImage:
                  'radial-gradient(ellipse 65% 60% at 50% 50%, transparent 45%, black 88%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse 65% 60% at 50% 50%, transparent 45%, black 88%)',
              }}
            />

            {/* Deep Cinematic Fish-Eye Vignette with Cyan Corner Atmosphere */}
            <div
              className="absolute inset-0 pointer-events-none z-20 select-none"
              style={{
                background:
                  'radial-gradient(ellipse 86% 80% at 50% 50%, transparent 40%, rgba(2,6,18,0.32) 65%, rgba(2,6,18,0.86) 88%, #020512 100%)',
                boxShadow: 'inset 0 0 130px 50px rgba(2,6,18,0.94)',
              }}
            />

            {/* Glowing cyan line at the bottom during hold */}
            <div className="portal-accent-line absolute bottom-0 left-0 right-0 h-[2.5px] bg-cyan-400 shadow-[0_0_12px_rgba(56,189,248,1)] pointer-events-none z-25" />
          </div>
        </div>
      )}
    </GridTransitionContext.Provider>
  );
}
