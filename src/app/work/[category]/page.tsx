'use client';

import React, { useState, use, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import {
  Play,
  X,
  ArrowLeft,
  MessageCircle,
  Film,
  Maximize2,
  Sliders,
  Sparkles,
  Layers,
  ChevronRight,
  Eye,
  Camera,
} from 'lucide-react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { AnimatePresence, motion } from 'motion/react';
import { CATEGORY_DATA, CategoryProject } from '@/data/categoryData';
import { useGridTransition } from '@/components/GridTransitionProvider';

// Map project aspect ratio to native responsive modal dimensions
function getModalAspectClasses(aspectRatio?: string) {
  switch (aspectRatio) {
    case '9:16 Vertical':
      // Mobile / Reels / TikTok vertical format (e.g. Tanoshii Spray)
      return {
        container: 'max-w-[390px] sm:max-w-[420px] w-full',
        aspect: 'aspect-[9/16] max-h-[85vh]',
      };
    case '4:5 Social':
      return {
        container: 'max-w-[480px] w-full',
        aspect: 'aspect-[4/5] max-h-[85vh]',
      };
    case '2.39:1 Anamorphic':
    case '2.39:1 Scope':
    case '2.39:1 Cinema Scope':
      return {
        container: 'max-w-6xl w-full',
        aspect: 'aspect-[2.39/1] max-h-[85vh]',
      };
    case '21:9 Ultrawide':
      return {
        container: 'max-w-6xl w-full',
        aspect: 'aspect-[21/9] max-h-[85vh]',
      };
    case '16:9 Cinema':
    default:
      return {
        container: 'max-w-5xl w-full',
        aspect: 'aspect-video max-h-[85vh]',
      };
  }
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Flip);
}

// Safely send postMessage command to YouTube iframe player
function postYt(iframe: HTMLIFrameElement | null, func: string, args: (string | number)[] = []) {
  if (!iframe || !iframe.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: 'command',
        func,
        args,
      }),
      '*'
    );
  } catch {}
}

// Infinite Canvas Repeating Unit Dimensions & Responsive Scales
export function getTileSizeForWidth(vw: number) {
  if (vw < 640) return { tile: { w: 115, h: 158 }, slider: { w: 180, h: 248 } }; // Mobile (e.g. iPhone 375-430px) - expansive multi-row mosaic
  if (vw < 840) return { tile: { w: 160, h: 220 }, slider: { w: 230, h: 317 } }; // Large mobile / Phablet
  if (vw < 1024) return { tile: { w: 210, h: 289 }, slider: { w: 290, h: 400 } }; // Tablet
  return { tile: { w: 275, h: 378 }, slider: { w: 380, h: 523 } }; // Desktop standard (original size untouched)
}

const DEFAULT_TILE_WIDTH = 275;
const DEFAULT_TILE_HEIGHT = 378;
const TILE_GAP = 0; // Seamless borderless mosaic (all footage touches edge-to-edge)

const DEFAULT_SLIDER_CARD_WIDTH = 380;
const DEFAULT_SLIDER_CARD_HEIGHT = 523; // Matched aspect ratio (0.726)
const SLIDER_CARD_GAP = 0; // Seamless continuous filmstrip

const BLOCK_X_OFFSETS = [0, 1];
const BLOCK_Y_OFFSETS = [0, 1];
const SLIDER_OFFSETS = [0, 1];

// Mathematical continuous modulo function strictly bounded in [-max, 0]
function wrapRange(val: number, max: number): number {
  if (max <= 0) return 0;
  return (((val % max) + max) % max) - max;
}

// Calculate the exact snap coordinates so the nearest card is centered in the viewport
function getSnapCoordinates(
  rawX: number,
  rawY: number,
  mode: 'grid' | 'slider' | 'list',
  sizes?: { tile: { w: number; h: number }; slider: { w: number; h: number } }
): { x: number; y: number } {
  if (typeof window === 'undefined' || mode === 'list') return { x: rawX, y: rawY };

  const currentSizes = sizes || getTileSizeForWidth(window.innerWidth);
  const scX = window.innerWidth / 2;
  const scY = window.innerHeight / 2;

  const sWidth = currentSizes.slider.w;
  const sStride = sWidth + SLIDER_CARD_GAP;
  const tWidth = currentSizes.tile.w;
  const tHeight = currentSizes.tile.h;
  const sX = tWidth + TILE_GAP;
  const sY = tHeight + TILE_GAP;

  if (mode === 'slider') {
    const baseOffsetX = scX - sWidth / 2;
    const stepCountX = Math.round((rawX - baseOffsetX) / sStride);
    const snapX = baseOffsetX + stepCountX * sStride;
    return { x: snapX, y: 0 };
  }

  // Grid 2D mode: free movement in all directions, snapping to nearest card in both X and Y
  const baseOffsetX = scX - tWidth / 2;
  const baseOffsetY = scY - tHeight / 2;

  const stepCountX = Math.round((rawX - baseOffsetX) / sX);
  const stepCountY = Math.round((rawY - baseOffsetY) / sY);

  const snapX = baseOffsetX + stepCountX * sX;
  const snapY = baseOffsetY + stepCountY * sY;

  return { x: snapX, y: snapY };
}

export default function CategoryShowcasePage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearchParams = searchParams ? use(searchParams) : undefined;
  const categoryKey = resolvedParams.category?.toLowerCase();
  const category = CATEGORY_DATA[categoryKey];

  // Dynamic responsive sizing hook: stable default dimensions across SSR and initial render to eliminate hydration mismatch
  const [tileSizes, setTileSizes] = useState({
    tile: { w: DEFAULT_TILE_WIDTH, h: DEFAULT_TILE_HEIGHT },
    slider: { w: DEFAULT_SLIDER_CARD_WIDTH, h: DEFAULT_SLIDER_CARD_HEIGHT },
  });

  useEffect(() => {
    const onResize = () => {
      const newSizes = getTileSizeForWidth(window.innerWidth);
      setTileSizes(newSizes);
      const snap = getSnapCoordinates(
        targetPanRef.current.x,
        targetPanRef.current.y,
        viewModeRef.current,
        newSizes
      );
      targetPanRef.current = snap;
      wakeLoopRef.current();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const TILE_WIDTH = tileSizes.tile.w;
  const TILE_HEIGHT = tileSizes.tile.h;
  const STEP_X = TILE_WIDTH + TILE_GAP;
  const STEP_Y = TILE_HEIGHT + TILE_GAP;

  const SLIDER_CARD_WIDTH = tileSizes.slider.w;
  const SLIDER_CARD_HEIGHT = tileSizes.slider.h;
  const SLIDER_STRIDE = SLIDER_CARD_WIDTH + SLIDER_CARD_GAP;

  if (!category) {
    notFound();
  }

  // Determine initial viewMode synchronously: URL query param > 'grid' default (consistent across SSR and initial render)
  const initialMode: 'grid' | 'slider' | 'list' = (() => {
    const qv = resolvedSearchParams?.view;
    if (qv === 'slider' || qv === 'list' || qv === 'grid') return qv;
    return 'grid';
  })();

  const router = useRouter();
  const { startReverseTransition } = useGridTransition();
  // View mode: 'grid' (2D canvas), 'slider' (horizontal filmstrip), 'list' (editorial directory)
  const [viewMode, setViewMode] = useState<'grid' | 'slider' | 'list'>(initialMode);
  const [isReady, setIsReady] = useState(false);

  // Filter mode: 'all' | 'stills' | 'motion'
  const [activeFilter, setActiveFilter] = useState<'all' | 'stills' | 'motion'>('all');

  // Active Project Video Modal
  const [activeModalProject, setActiveModalProject] = useState<CategoryProject | null>(null);
  const activeModalProjectRef = useRef<CategoryProject | null>(null);
  activeModalProjectRef.current = activeModalProject;

  // Hovered item for List View Preview
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);

  // DOM Refs for 60-120 FPS Hardware-Accelerated Animation (ZERO React re-renders during drag/scroll)
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const listPreviewRef = useRef<HTMLDivElement>(null);
  const activeCenterCardIdRef = useRef<string | null>(null);
  const wheelSnapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTransitioningRef = useRef(false);
  const transitionDirectionRef = useRef<'slider-to-grid' | null>(null);
  const sliderOffsetRef = useRef(0);
  const lastGridRowRef = useRef<number | null>(null);
  const lastGridColRef = useRef<number | null>(null);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const sliderHasScrolledRef = useRef(false);
  const isFlingingRef = useRef(false);
  const wasFlingingRef = useRef(false);
  const pointerHistoryRef = useRef<Array<{ x: number; y: number; time: number }>>([]);

  // Cached parallax tiles & color overlay elements for zero-lookup 60-120 FPS proximity fade
  interface CachedTile {
    cardEl: HTMLElement;
    wrapperEl: HTMLElement;
    colorOverlayEl: HTMLElement;
    localX: number;
    localY: number;
    width: number;
    height: number;
    dist?: number;
    visible?: boolean;
    wasVisible?: boolean;
    lastPx?: number;
    lastPy?: number;
    lastOpacity?: number;
    videoEl?: HTMLVideoElement | null;
    videoLayerEl?: HTMLElement | null;
    videoBadgeEl?: HTMLElement | null;
  }

  const cachedTilesRef = useRef<CachedTile[]>([]);

  // Active Center Card Video & Audio Fade Controller (Pure Lightweight HTML5 Video)
  const activeVideoTileRef = useRef<{
    video: HTMLVideoElement | null;
    layer: HTMLElement | null;
    badge: HTMLElement | null;
    fadeTimer: NodeJS.Timeout | null;
    currentVolume: number;
    isPlaying: boolean;
  }>({
    video: null,
    layer: null,
    badge: null,
    fadeTimer: null,
    currentVolume: 0,
    isPlaying: false,
  });

  const isLoopRunningRef = useRef(false);
  const wakeLoopRef = useRef<() => void>(() => {});

  const startVideoWithAudioFadeIn = useCallback((
    target: { video?: HTMLVideoElement | null },
    layer: HTMLElement,
    badge: HTMLElement | null
  ) => {
    const state = activeVideoTileRef.current;
    if (target.video && state.video === target.video && state.isPlaying) {
      return;
    }

    // Stop previous video if different and pause all other cached videos
    cachedTilesRef.current.forEach((t) => {
      if (t.videoEl && t.videoEl !== target.video) {
        try {
          if (!t.videoEl.paused) t.videoEl.pause();
          t.videoEl.currentTime = 0;
        } catch {}
      }
      if (t.videoLayerEl && t.videoLayerEl !== layer) {
        t.videoLayerEl.style.opacity = '0';
      }
      if (t.videoBadgeEl && t.videoBadgeEl !== badge) {
        t.videoBadgeEl.style.opacity = '0';
      }
    });

    if (state.fadeTimer) clearInterval(state.fadeTimer);

    state.video = target.video || null;
    state.layer = layer;
    state.badge = badge;
    state.isPlaying = true;
    state.currentVolume = 0;

    layer.style.opacity = '1';
    if (badge) badge.style.opacity = '1';

    if (target.video) {
      const v = target.video;
      // Lazy attach video src if not yet attached so non-centered cards never buffer
      const dataSrc = v.getAttribute('data-src');
      if (dataSrc && (!v.src || v.src === '' || v.src.endsWith(window.location.pathname))) {
        v.src = dataSrc;
      }
      // Play with sound (unmuted) by default
      v.muted = false;
      v.volume = 1;
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            v.muted = false;
            v.volume = 1;
          })
          .catch(() => {
            // Fallback to muted only if browser blocks unmuted audio before user interaction
            v.muted = true;
            v.play().catch(() => {});
          });
      }
    }
  }, []);

  const stopVideoWithAudioFadeOut = useCallback(() => {
    const state = activeVideoTileRef.current;
    if (state.fadeTimer) clearInterval(state.fadeTimer);

    if (state.layer) state.layer.style.opacity = '0';
    if (state.badge) state.badge.style.opacity = '0';

    if (state.video) {
      try {
        state.video.pause();
        state.video.currentTime = 0;
      } catch {}
    }

    // Unconditionally ensure ALL videos across the board are stopped
    cachedTilesRef.current.forEach((t) => {
      if (t.videoEl) {
        try {
          if (!t.videoEl.paused) t.videoEl.pause();
        } catch {}
      }
      if (t.videoLayerEl) {
        t.videoLayerEl.style.opacity = '0';
      }
      if (t.videoBadgeEl) {
        t.videoBadgeEl.style.opacity = '0';
      }
    });

    state.isPlaying = false;
    state.video = null;
    state.layer = null;
    state.badge = null;
  }, []);

  // Filtered project list
  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return category.projects;
    return category.projects.filter((p) => p.type === activeFilter);
  }, [category.projects, activeFilter]);

  // Sequential distinct cards pattern (1..N).
  // If 10 cards, N = 10. If 15 cards, N = 15. Ensures minimum 8 items for gapless infinite wrapping.
  const displayProjects = useMemo(() => {
    const source = filteredProjects.length > 0 ? filteredProjects : category.projects;
    const items: CategoryProject[] = [...source];
    while (items.length < 8) {
      for (const p of source) {
        items.push(p);
      }
    }
    return items;
  }, [filteredProjects, category.projects]);

  const N = displayProjects.length;
  // Optimized high-performance 2D grid dimensions (6 cols x 4 rows = 24 cells per block, 96 total cards)
  // Perfectly covers 4K displays with seamless infinite wrapping while saving 86% DOM nodes & GPU memory
  const GRID_COLS = 6;
  const GRID_ROWS = 4;
  const BLOCK_WIDTH = GRID_COLS * STEP_X;
  const BLOCK_HEIGHT = GRID_ROWS * STEP_Y;
  const sliderBlockWidth = N * SLIDER_STRIDE;

  // Consistent initial pan coordinates between SSR and initial client render to eliminate hydration mismatch
  const initialPan = useMemo(() => ({ x: 0, y: 0 }), []);

  // Physics & Pan Coordinates (Direct mutable refs initialized to exact resting coordinates!)
  const targetPanRef = useRef(initialPan);
  const currentPanRef = useRef({ ...initialPan });
  const isDraggingRef = useRef(false);
  const isWheelingRef = useRef(false);
  const dragIntentActiveRef = useRef(false);
  const dragStartTimeRef = useRef(0);
  const strokeAccumulatorRef = useRef(0);
  const pointerStartRef = useRef({
    x: 0,
    y: 0,
    panX: initialPan.x,
    panY: initialPan.y,
  });
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const dragDistanceRef = useRef(0);

  const stillsCount = useMemo(
    () => category.projects.filter((p) => p.type === 'stills').length,
    [category.projects]
  );
  const motionCount = useMemo(
    () => category.projects.filter((p) => p.type === 'motion').length,
    [category.projects]
  );

  // Cache tile coordinates & image elements for zero-lookup 60-120 FPS parallax & proximity color
  const refreshCachedTiles = useCallback(() => {
    const tiles: CachedTile[] = [];

    if (viewMode === 'grid') {
      BLOCK_Y_OFFSETS.forEach((by) => {
        BLOCK_X_OFFSETS.forEach((bx) => {
          for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
              const id = `grid_card_${bx}_${by}_${row}_${col}`;
              const el = document.getElementById(id);
              const wrapper = el?.querySelector<HTMLElement>('.parallax-wrapper');
              const colorOverlay = el?.querySelector<HTMLElement>('.color-overlay');
              const videoLayer = el?.querySelector<HTMLElement>('.card-video-layer');
              const videoEl = el?.querySelector<HTMLVideoElement>('video[data-card-video]');
              const videoBadge = el?.querySelector<HTMLElement>('.card-audio-indicator');
              if (el && wrapper && colorOverlay) {
                tiles.push({
                  cardEl: el,
                  wrapperEl: wrapper,
                  colorOverlayEl: colorOverlay,
                  localX: bx * BLOCK_WIDTH + col * STEP_X,
                  localY: by * BLOCK_HEIGHT + row * STEP_Y,
                  width: TILE_WIDTH,
                  height: TILE_HEIGHT,
                  visible: false,
                  wasVisible: false,
                  videoEl: videoEl,
                  videoLayerEl: videoLayer,
                  videoBadgeEl: videoBadge,
                });
              }
            }
          }
        });
      });
    } else if (viewMode === 'slider') {
      SLIDER_OFFSETS.forEach((so) => {
        displayProjects.forEach((project, idx) => {
          const id = `slider_card_${so}_${idx}`;
          const el = document.getElementById(id);
          const wrapper = el?.querySelector<HTMLElement>('.parallax-wrapper');
          const colorOverlay = el?.querySelector<HTMLElement>('.color-overlay');
          const videoLayer = el?.querySelector<HTMLElement>('.card-video-layer');
          const videoEl = el?.querySelector<HTMLVideoElement>('video[data-card-video]');
          const videoBadge = el?.querySelector<HTMLElement>('.card-audio-indicator');
          if (el && wrapper && colorOverlay) {
            tiles.push({
              cardEl: el,
              wrapperEl: wrapper,
              colorOverlayEl: colorOverlay,
              localX: so * sliderBlockWidth + idx * SLIDER_STRIDE,
              localY: 0,
              width: SLIDER_CARD_WIDTH,
              height: SLIDER_CARD_HEIGHT,
              visible: false,
              wasVisible: false,
              videoEl: videoEl,
              videoLayerEl: videoLayer,
              videoBadgeEl: videoBadge,
            });
          }
        });
      });
    }

    cachedTilesRef.current = tiles;
  }, [viewMode, displayProjects, sliderBlockWidth, BLOCK_WIDTH, BLOCK_HEIGHT, GRID_ROWS, GRID_COLS]);

  useEffect(() => {
    refreshCachedTiles();
    const timer = setTimeout(refreshCachedTiles, 80);
    return () => clearTimeout(timer);
  }, [refreshCachedTiles]);

  // Save current view mode and coordinates so refreshing keeps user at the exact same location
  const saveStateToStorage = useCallback(
    (mode: 'grid' | 'slider' | 'list', panX: number, panY: number) => {
      if (typeof window === 'undefined') return;
      try {
        const scX = window.innerWidth / 2;
        const scY = window.innerHeight / 2;
        let focalIdx = 0;

        if (mode === 'slider') {
          const wx = wrapRange(panX, sliderBlockWidth);
          const col = Math.round((scX - wx - SLIDER_CARD_WIDTH / 2) / SLIDER_STRIDE);
          focalIdx =
            ((col % displayProjects.length) + displayProjects.length) %
            displayProjects.length;
        } else if (mode === 'grid') {
          const wx = wrapRange(panX, BLOCK_WIDTH);
          const wy = wrapRange(panY, BLOCK_HEIGHT);
          const col = Math.round((scX - wx - TILE_WIDTH / 2) / STEP_X);
          const row = Math.round((scY - wy - TILE_HEIGHT / 2) / STEP_Y);
          const normCol = ((col % GRID_COLS) + GRID_COLS) % GRID_COLS;
          const normRow = ((row % GRID_ROWS) + GRID_ROWS) % GRID_ROWS;
          focalIdx = (normCol + normRow * 2) % displayProjects.length;
        }

        const stateObj = {
          viewMode: mode,
          panX,
          panY,
          focalIdx,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(
          `portfolio_state_${categoryKey}`,
          JSON.stringify(stateObj)
        );
        localStorage.setItem(
          `portfolio_state_${categoryKey}`,
          JSON.stringify(stateObj)
        );

        // Sync query parameter without full page reload
        const url = new URL(window.location.href);
        if (url.searchParams.get('view') !== mode) {
          url.searchParams.set('view', mode);
          window.history.replaceState(null, '', url.toString());
        }
      } catch {}
    },
    [
      categoryKey,
      sliderBlockWidth,
      displayProjects.length,
      BLOCK_WIDTH,
      BLOCK_HEIGHT,
      GRID_COLS,
      GRID_ROWS,
    ]
  );

  // Synchronously compute client resting coordinates on mount BEFORE browser paint so the canvas never jumps on refresh
  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const currentSizes = getTileSizeForWidth(window.innerWidth);
    setTileSizes(currentSizes);

    const scX = window.innerWidth / 2;
    const scY = window.innerHeight / 2;
    const tW = currentSizes.tile.w;
    const tH = currentSizes.tile.h;

    // Strictly center Card #1 (col=0, row=0, bx=0, by=0) in the viewport by default
    let targetX = scX - tW / 2;
    let targetY = scY - tH / 2;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlView = urlParams.get('view');
      const mode = urlView || viewModeRef.current;

      if (mode === 'slider') {
        const focalIdx = 0;
        const sW = currentSizes.slider.w;
        const sStride = sW + SLIDER_CARD_GAP;
        const rawTargetX = scX - sW / 2 - focalIdx * sStride;
        targetX = wrapRange(rawTargetX, N * sStride);
        targetY = 0;
      }
    } catch {}

    const snap = getSnapCoordinates(targetX, targetY, viewModeRef.current, currentSizes);
    targetPanRef.current = snap;
    currentPanRef.current = snap;
    pointerStartRef.current.panX = snap.x;
    pointerStartRef.current.panY = snap.y;

    if (canvasRef.current) {
      const bW = GRID_COLS * (tW + TILE_GAP);
      const bH = GRID_ROWS * (tH + TILE_GAP);
      const wx =
        viewModeRef.current === 'grid'
          ? wrapRange(snap.x, bW)
          : wrapRange(snap.x, sliderBlockWidth);
      const wy =
        viewModeRef.current === 'grid' ? wrapRange(snap.y, bH) : 0;
      canvasRef.current.style.transform = `translate3d(${wx.toFixed(3)}px, ${wy.toFixed(3)}px, 0)`;
    }
    wakeLoopRef.current();
  }, [categoryKey, sliderBlockWidth, BLOCK_WIDTH, BLOCK_HEIGHT, TILE_WIDTH, TILE_HEIGHT, SLIDER_CARD_WIDTH, SLIDER_STRIDE, N]);

  // Smooth entrance readiness on mount and window resize handling
  useEffect(() => {
    setIsReady(true);
    if (typeof window === 'undefined') return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlView = urlParams.get('view') as
        | 'grid'
        | 'slider'
        | 'list'
        | null;

      const savedStr =
        sessionStorage.getItem(`portfolio_state_${categoryKey}`) ||
        localStorage.getItem(`portfolio_state_${categoryKey}`);

      let targetMode: 'grid' | 'slider' | 'list' = viewModeRef.current;
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        if (saved.viewMode) targetMode = saved.viewMode;
      }

      if (
        urlView &&
        (urlView === 'grid' || urlView === 'slider' || urlView === 'list')
      ) {
        targetMode = urlView;
      }

      if (targetMode !== viewModeRef.current) {
        setViewMode(targetMode);
        viewModeRef.current = targetMode;
      }
    } catch {}
  }, [categoryKey]);

  // High-performance 60-120 FPS hardware-accelerated RAF Lerp loop with intelligent idle sleeping
  useEffect(() => {
    let rafId: number;

    const tick = () => {
      // Ultra-responsive, weightless 60-120 FPS Lerp & Inertia physics
      let chaseEase = 0.24;

      if (isTransitioningRef.current) {
        velocityRef.current.vx = 0;
        velocityRef.current.vy = 0;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const dx = targetPanRef.current.x - currentPanRef.current.x;
      const dy = targetPanRef.current.y - currentPanRef.current.y;
      const remDist = Math.hypot(dx, dy);

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

      if (isDraggingRef.current) {
        // Active pointer drag: instantaneous, 1:1 agile tracking with zero perceived lag
        chaseEase = isMobile ? 0.48 : 0.28;
      } else if (isWheelingRef.current) {
        // Active wheel scrolling: light, fluid, highly responsive
        chaseEase = 0.22;
      } else if (isFlingingRef.current) {
        // Ultra-slippery ("sangat licin") momentum coasting on mobile flick/swipe
        // When far away: ease is ~0.065 (long, silky, frictionless ice glide across multiple cards)
        // As it nears destination: ease smoothly increases to ~0.18 for a gentle, magnetic landing
        const activeStride = viewMode === 'slider' ? SLIDER_STRIDE : STEP_X;
        const dockT = Math.max(0, Math.min(1, (remDist - 25) / (activeStride * 2.5)));
        chaseEase = 0.18 - 0.115 * dockT;
        if (remDist < 1.0) {
          isFlingingRef.current = false;
        }
      } else {
        // Snappy, authoritative docking into exact card center
        velocityRef.current.vx *= 0.90;
        velocityRef.current.vy *= 0.90;
        chaseEase = isMobile ? 0.18 : 0.24;
      }

      currentPanRef.current.x += dx * chaseEase;
      currentPanRef.current.y += dy * chaseEase;

      const isSettled =
        !isDraggingRef.current &&
        !isWheelingRef.current &&
        !isFlingingRef.current &&
        Math.abs(dx) < 0.08 &&
        Math.abs(dy) < 0.08;

      // Lock subpixel precision when settled to eliminate micro-jitter
      if (isSettled) {
        currentPanRef.current.x = targetPanRef.current.x;
        currentPanRef.current.y = targetPanRef.current.y;
      }

      if (canvasRef.current && typeof window !== 'undefined') {
        const scX = window.innerWidth / 2;
        const scY = window.innerHeight / 2;

        const wx =
          viewMode === 'grid'
            ? wrapRange(currentPanRef.current.x, BLOCK_WIDTH)
            : wrapRange(currentPanRef.current.x, sliderBlockWidth);
        const wy = viewMode === 'grid' ? wrapRange(currentPanRef.current.y, BLOCK_HEIGHT) : 0;

        // Subpixel 0.001px precision for liquid-smooth minimal movements
        if (viewMode === 'grid') {
          canvasRef.current.style.transform = `translate3d(${wx.toFixed(3)}px, ${wy.toFixed(3)}px, 0)`;
        } else if (viewMode === 'slider') {
          canvasRef.current.style.transform = `translate3d(${wx.toFixed(3)}px, 0, 0)`;
        }

        // --- MULTI-PLANE CINEMA PARALLAX & PROXIMITY COLOR ENGINE ---
        let tiles = cachedTilesRef.current;
        if (tiles.length === 0) {
          refreshCachedTiles();
          tiles = cachedTilesRef.current;
        }
        const tileCount = tiles.length;
        const lagX = Math.max(-8, Math.min(8, -velocityRef.current.vx * 4));
        const lagY = Math.max(-8, Math.min(8, -velocityRef.current.vy * 4));

        const activeCardWidth = viewMode === 'slider' ? SLIDER_CARD_WIDTH : TILE_WIDTH;
        const r0 = Math.min(65, activeCardWidth * 0.38);
        const r1 = Math.min(500, activeCardWidth * 2.2);
        const rDiff = r1 - r0;

        let minDist = 9999;
        let closestIdx = -1;

        const viewW = window.innerWidth;
        const viewH = window.innerHeight;

        for (let i = 0; i < tileCount; i++) {
          const tile = tiles[i];
          const isSlider = viewMode === 'slider';
          const screenX = tile.localX + wx;
          const screenY = isSlider ? scY - tile.height / 2 : tile.localY + wy;

          // Frustum culling: calculate parallax & color only for visible cards
          if (
            screenX > -tile.width &&
            screenX < viewW + tile.width &&
            screenY > -tile.height &&
            screenY < viewH + tile.height
          ) {
            const cardCenterX = screenX + tile.width / 2;
            const cardCenterY = isSlider ? scY : screenY + tile.height / 2;

            const normX = (cardCenterX - scX) / scX;
            const normY = (cardCenterY - scY) / scY;

            // Optical parallax displacement: fully contained within scale(1.32) bounds (Zero black borders)
            const px = Math.max(-20, Math.min(20, -normX * 14 + lagX));
            const py = isSlider ? 0 : Math.max(-20, Math.min(20, -normY * 16 + lagY));

            // Only update transform if changed noticeably (avoids layout/style recalc)
            if (
              tile.lastPx === undefined ||
              Math.abs(px - tile.lastPx) > 0.08 ||
              Math.abs(py - (tile.lastPy || 0)) > 0.08
            ) {
              tile.wrapperEl.style.transform = `scale(1.32) translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
              tile.lastPx = px;
              tile.lastPy = py;
            }

            // Distance from card center to viewport center:
            const dist =
              isSlider
                ? Math.abs(cardCenterX - scX)
                : Math.hypot(cardCenterX - scX, cardCenterY - scY);

            tile.dist = dist;
            tile.visible = true;
            tile.wasVisible = true;

            if (dist < minDist) {
              minDist = dist;
              closestIdx = i;
            }
          } else {
            tile.visible = false;
            // Only set opacity to 0 ONCE when it transitions from visible to off-screen!
            if (tile.wasVisible) {
              tile.wasVisible = false;
              tile.colorOverlayEl.style.opacity = '0';
              tile.lastOpacity = 0;
            }
          }
        }

        // Second pass: apply proximity color ONLY on the single closest card to center
        for (let i = 0; i < tileCount; i++) {
          const tile = tiles[i];
          if (!tile.visible || tile.dist === undefined) continue;

          let finalFactor = 0;
          if (i === closestIdx) {
            const dist = tile.dist;
            if (dist <= r0) {
              finalFactor = 1.0;
            } else if (dist < r1) {
              const t = (dist - r0) / rDiff;
              finalFactor = 0.5 * (1 + Math.cos(t * Math.PI));
            }
          }

          if (
            tile.lastOpacity === undefined ||
            Math.abs(finalFactor - tile.lastOpacity) > 0.005
          ) {
            tile.colorOverlayEl.style.opacity = finalFactor.toFixed(3);
            tile.lastOpacity = finalFactor;
          }
        }

        // Live Video Auto-Play with Audio Fade-In (ONLY when card is in the exact center!)
        const centerTile = closestIdx !== -1 ? tiles[closestIdx] : null;
        const centerTolerance = Math.min(65, (viewMode === 'slider' ? SLIDER_CARD_WIDTH : TILE_WIDTH) * 0.38);
        const isAtColoredPoint = Boolean(centerTile && minDist < centerTolerance);

        if (
          !activeModalProjectRef.current &&
          isAtColoredPoint &&
          centerTile &&
          centerTile.videoEl &&
          centerTile.videoLayerEl
        ) {
          startVideoWithAudioFadeIn(
            { video: centerTile.videoEl },
            centerTile.videoLayerEl,
            centerTile.videoBadgeEl || null
          );
        } else {
          // Immediately stop playback and hide video layer if card is not centered
          if (activeVideoTileRef.current.isPlaying) {
            stopVideoWithAudioFadeOut();
          }
        }
      }

      // If settled and canvas is stationary, sleep the loop to save 100% CPU & GPU!
      if (isSettled) {
        isLoopRunningRef.current = false;
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    const wakeLoop = () => {
      if (!isLoopRunningRef.current) {
        isLoopRunningRef.current = true;
        rafId = requestAnimationFrame(tick);
      }
    };
    wakeLoopRef.current = wakeLoop;

    isLoopRunningRef.current = true;
    rafId = requestAnimationFrame(tick);
    return () => {
      isLoopRunningRef.current = false;
      cancelAnimationFrame(rafId);
      stopVideoWithAudioFadeOut();
    };
  }, [
    viewMode,
    sliderBlockWidth,
    BLOCK_WIDTH,
    BLOCK_HEIGHT,
    refreshCachedTiles,
    startVideoWithAudioFadeIn,
    stopVideoWithAudioFadeOut,
  ]);

  // User interaction listener to satisfy browser autoplay audio policy and unmute sound
  useEffect(() => {
    const unlockAudio = () => {
      const activeVideo = activeVideoTileRef.current.video;
      if (activeVideo && activeVideo.muted) {
        activeVideo.muted = false;
        activeVideo.volume = 1;
      }
      wakeLoopRef.current();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('pointermove', unlockAudio, { passive: true });
    window.addEventListener('wheel', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('pointermove', unlockAudio);
      window.removeEventListener('wheel', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Close modal smoothly
  const closeModal = useCallback(() => {
    setActiveModalProject(null);
    wakeLoopRef.current();
  }, []);

  // Choreographed Grid <-> Slider transition with anchored focal photo, row dispersal & zoom
  useIsomorphicLayoutEffect(() => {
    refreshCachedTiles();

    // Synchronously calibrate initial proximity color & optical parallax before browser paints
    const tiles = cachedTilesRef.current;
    if (tiles.length > 0 && typeof window !== 'undefined' && !isTransitioningRef.current) {
      const scX = window.innerWidth / 2;
      const scY = window.innerHeight / 2;
      const wx =
        viewMode === 'grid'
          ? wrapRange(currentPanRef.current.x, BLOCK_WIDTH)
          : wrapRange(currentPanRef.current.x, sliderBlockWidth);
      const wy = viewMode === 'grid' ? wrapRange(currentPanRef.current.y, BLOCK_HEIGHT) : 0;

      let minDist = 9999;
      let closestIdx = -1;

      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const isSlider = viewMode === 'slider';
        const screenX = tile.localX + wx;
        const screenY = isSlider ? scY - tile.height / 2 : tile.localY + wy;
        const cardCenterX = screenX + tile.width / 2;
        const cardCenterY = isSlider ? scY : screenY + tile.height / 2;
        const dist = isSlider
          ? Math.abs(cardCenterX - scX)
          : Math.hypot(cardCenterX - scX, cardCenterY - scY);
        tile.dist = dist;

        const normX = (cardCenterX - scX) / scX;
        const normY = (cardCenterY - scY) / scY;
        const px = Math.max(-28, Math.min(28, -normX * 18));
        const py = isSlider ? 0 : Math.max(-32, Math.min(32, -normY * 20));
        tile.wrapperEl.style.transform = `scale(1.22) translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;

        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }

      const tAllowance = Math.max(0, Math.min(1, (minDist - 55) / 150));
      const otherCardAllowance = tAllowance * tAllowance * (3 - 2 * tAllowance);

      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        if (tile.dist === undefined) continue;
        const dist = tile.dist;
        const activeCardWidth = viewMode === 'slider' ? SLIDER_CARD_WIDTH : TILE_WIDTH;
        const r0 = Math.min(65, activeCardWidth * 0.38);
        const r1 = Math.min(500, activeCardWidth * 2.2);
        const rDiff = r1 - r0;
        let baseFactor = 0;
        if (dist <= r0) baseFactor = 1.0;
        else if (dist < r1) {
          const t = (dist - r0) / rDiff;
          baseFactor = 0.5 * (1 + Math.cos(t * Math.PI));
        }
        const finalFactor = i === closestIdx ? baseFactor : baseFactor * otherCardAllowance;
        tile.colorOverlayEl.style.opacity = finalFactor.toFixed(3);
      }
    }

    if (viewMode === 'grid' && transitionDirectionRef.current === 'slider-to-grid') {
      isTransitioningRef.current = true;
      transitionDirectionRef.current = null;
      sliderHasScrolledRef.current = false;

      const scX = window.innerWidth / 2;
      const scY = window.innerHeight / 2;

      const scaleX = SLIDER_CARD_WIDTH / TILE_WIDTH; // 450 / 345 = 1.3043
      const scaleY = SLIDER_CARD_HEIGHT / TILE_HEIGHT; // 620 / 475 = 1.3052

      const topRowEls: HTMLElement[] = [];
      const bottomRowEls: HTMLElement[] = [];
      const middleRowTiles: Array<{
        cardEl: HTMLElement;
        initialX: number;
        deltaCol: number;
      }> = [];
      const allCards: Array<{
        el: HTMLElement;
        defaultPx: number;
        defaultPy: number;
      }> = [];

      const curWx = wrapRange(currentPanRef.current.x, BLOCK_WIDTH);
      const curWy = wrapRange(currentPanRef.current.y, BLOCK_HEIGHT);

      BLOCK_Y_OFFSETS.forEach((by) => {
        BLOCK_X_OFFSETS.forEach((bx) => {
          for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
              const el = document.getElementById(`grid_card_${bx}_${by}_${row}_${col}`);
              if (!el) continue;

              const localY = by * BLOCK_HEIGHT + row * STEP_Y;
              const screenY = localY + curWy;
              const centerY = screenY + TILE_HEIGHT / 2;
              const dy = centerY - scY;

              const localX = bx * BLOCK_WIDTH + col * STEP_X;
              const screenX = localX + curWx;
              const centerX = screenX + TILE_WIDTH / 2;
              const normX = (centerX - scX) / scX;
              const normY = (centerY - scY) / scY;
              const defaultPx = Math.max(-28, Math.min(28, -normX * 18));
              const defaultPy = Math.max(-32, Math.min(32, -normY * 20));

              allCards.push({ el, defaultPx, defaultPy });

              if (dy < -TILE_HEIGHT * 0.45) {
                topRowEls.push(el);
              } else if (dy > TILE_HEIGHT * 0.45) {
                bottomRowEls.push(el);
              } else {
                // Exact middle horizontal row (Row 1)
                const deltaCol = Math.round((centerX - scX) / STEP_X);
                if (Math.abs(deltaCol) <= 8) {
                  const initialOffset =
                    deltaCol * (SLIDER_STRIDE - STEP_X) + sliderOffsetRef.current;

                  middleRowTiles.push({
                    cardEl: el,
                    initialX: initialOffset,
                    deltaCol,
                  });
                }
              }
            }
          }
        });
      });

      // Lock image position inside card initially: start strictly anchored to card frame
      document.querySelectorAll<HTMLElement>('.parallax-wrapper').forEach((w) => {
        w.style.transform = 'scale(1.22) translate3d(0px, 0px, 0px)';
      });

      // Synchronously set initial entry positions before browser paint
      if (topRowEls.length > 0) {
        gsap.set(topRowEls, { y: -380, opacity: 0 });
      }
      if (bottomRowEls.length > 0) {
        gsap.set(bottomRowEls, { y: 380, opacity: 0 });
      }
      middleRowTiles.forEach((m) => {
        m.cardEl.style.zIndex = String(30 - Math.min(10, Math.abs(m.deltaCol)));
        gsap.set(m.cardEl, {
          x: m.initialX,
          y: 0,
          scaleX: scaleX,
          scaleY: scaleY,
          transformOrigin: 'center center',
        });
        const overlay = m.cardEl.querySelector<HTMLElement>('.color-overlay');
        if (overlay) {
          overlay.style.opacity = m.deltaCol === 0 ? '1' : '0';
        }
      });

      // Animate seamlessly from slider configuration into rest grid layout (Zoom Out)
      const tl = gsap.timeline({
        onComplete: () => {
          allCards.forEach(({ el }) => {
            gsap.set(el, { clearProps: 'transform,opacity,zIndex' });
          });
          refreshCachedTiles();
          const scX = window.innerWidth / 2;
          const scY = window.innerHeight / 2;
          cachedTilesRef.current.forEach((tile) => {
            const screenX = tile.localX + wrapRange(currentPanRef.current.x, BLOCK_WIDTH);
            const screenY = tile.localY + wrapRange(currentPanRef.current.y, BLOCK_HEIGHT);
            const cardCenterX = screenX + tile.width / 2;
            const cardCenterY = screenY + tile.height / 2;
            const dist = Math.hypot(cardCenterX - scX, cardCenterY - scY);
            const centerDist = Math.min(70, TILE_WIDTH * 0.38);
            tile.colorOverlayEl.style.opacity = dist < centerDist ? '1' : '0';
            const normX = (cardCenterX - scX) / scX;
            const normY = (cardCenterY - scY) / scY;
            const px = Math.max(-28, Math.min(28, -normX * 18));
            const py = Math.max(-32, Math.min(32, -normY * 20));
            tile.wrapperEl.style.transform = `scale(1.22) translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0px)`;
          });
          isTransitioningRef.current = false;
          saveStateToStorage('grid', currentPanRef.current.x, currentPanRef.current.y);
        },
      });

      if (topRowEls.length > 0) {
        tl.to(
          topRowEls,
          {
            y: 0,
            opacity: 1,
            duration: 1.05,
            ease: 'power2.inOut',
          },
          0
        );
      }

      if (bottomRowEls.length > 0) {
        tl.to(
          bottomRowEls,
          {
            y: 0,
            opacity: 1,
            duration: 1.05,
            ease: 'power2.inOut',
          },
          0
        );
      }

      middleRowTiles.forEach((m) => {
        tl.to(
          m.cardEl,
          {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            duration: 1.15,
            ease: 'power2.inOut',
          },
          0
        );
      });

      // Smooth velocity S-curve landing for card contents toward default grid positions
      allCards.forEach(({ el, defaultPx, defaultPy }) => {
        const wrapper = el.querySelector<HTMLElement>('.parallax-wrapper');
        if (wrapper) {
          tl.to(
            wrapper,
            {
              transform: `scale(1.22) translate3d(${defaultPx.toFixed(1)}px, ${defaultPy.toFixed(1)}px, 0px)`,
              duration: 0.8,
              ease: 'power2.inOut',
            },
            0.35
          );
        }
      });
    } else if (viewMode === 'slider') {
      sliderHasScrolledRef.current = false;
      refreshCachedTiles();
      const scX = window.innerWidth / 2;
      const curWx = wrapRange(currentPanRef.current.x, sliderBlockWidth);
      if (canvasRef.current) {
        canvasRef.current.style.transform = `translate3d(${curWx.toFixed(3)}px, 0, 0)`;
      }
      cachedTilesRef.current.forEach((tile) => {
        const screenX = tile.localX + curWx;
        const cardCenterX = screenX + tile.width / 2;
        const dist = Math.abs(cardCenterX - scX);
        const centerDist = Math.min(70, SLIDER_CARD_WIDTH * 0.38);
        const finalOpacity = dist < centerDist ? 1 : 0;
        tile.colorOverlayEl.style.opacity = String(finalOpacity);
        tile.lastOpacity = finalOpacity;
        const normX = (cardCenterX - scX) / scX;
        const px = Math.max(-28, Math.min(28, -normX * 18));
        tile.wrapperEl.style.transform = `scale(1.22) translate3d(${px.toFixed(1)}px, 0px, 0px)`;
        tile.lastPx = px;
        tile.lastPy = 0;
        tile.visible = true;
        tile.wasVisible = true;
        tile.cardEl.style.transform = '';
      });
      isTransitioningRef.current = false;
    }
  }, [viewMode, displayProjects, refreshCachedTiles, sliderBlockWidth]);

  // View switcher with custom anchored row dispersal & zoom choreography
  const switchViewMode = useCallback((newMode: 'grid' | 'slider' | 'list') => {
    if (newMode === viewMode || isTransitioningRef.current) return;

    if (typeof window === 'undefined') {
      setViewMode(newMode);
      return;
    }

    const scX = window.innerWidth / 2;
    const scY = window.innerHeight / 2;

    // Fallback for List view morphing
    if (newMode === 'list' || viewMode === 'list') {
      if (newMode === 'grid' || newMode === 'slider') {
        const snap = getSnapCoordinates(
          currentPanRef.current.x,
          currentPanRef.current.y,
          newMode
        );
        targetPanRef.current = snap;
        currentPanRef.current = snap;
      }
      const state = Flip.getState('.gallery-card-item', {
        props: 'transform,opacity',
      });
      setViewMode(newMode);
      requestAnimationFrame(() => {
        Flip.from(state, {
          duration: 0.55,
          ease: 'power2.inOut',
          stagger: 0.012,
          fade: true,
          scale: true,
          simple: true,
        });
      });
      return;
    }

    // =========================================================================
    // BIDIRECTIONAL CHOREOGRAPHY: GRID <-> SLIDER
    // 1. Center photo remains strictly anchored as the key focal card
    // 2. Left & right neighbors in the middle row stay preserved in exact order
    // 3. Top and bottom rows disperse away with ease-in-out
    // 4. Middle row zooms smoothly to slider default size (and vice versa)
    // =========================================================================

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      dragIntentActiveRef.current = false;
    }
    if (isWheelingRef.current) {
      isWheelingRef.current = false;
    }
    if (wheelSnapTimeoutRef.current) clearTimeout(wheelSnapTimeoutRef.current);
    isTransitioningRef.current = true;
    sliderHasScrolledRef.current = false;
    velocityRef.current = { vx: 0, vy: 0 };

    if (viewMode === 'grid' && newMode === 'slider') {
      // --- MODE 1: GRID -> SLIDER ---
      type GridTileItem = {
        cardEl: HTMLElement;
        idx: number;
        centerX: number;
        centerY: number;
        row: number;
        col: number;
      };

      let minDist = 999999;
      let focalTile: GridTileItem | null = null;
      const allGridTiles: GridTileItem[] = [];

      BLOCK_Y_OFFSETS.forEach((by) => {
        BLOCK_X_OFFSETS.forEach((bx) => {
          for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
              const el = document.getElementById(`grid_card_${bx}_${by}_${row}_${col}`);
              if (!el) continue;
              const rect = el.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const dist = Math.hypot(centerX - scX, centerY - scY);
              const projIdx = (col + row) % displayProjects.length;

              const item: GridTileItem = { cardEl: el, idx: projIdx, centerX, centerY, row, col };
              allGridTiles.push(item);

              if (dist < minDist) {
                minDist = dist;
                focalTile = item;
              }
            }
          }
        });
      });

      const focalItem = focalTile as GridTileItem | null;
      if (!focalItem) {
        isTransitioningRef.current = false;
        setViewMode('slider');
        return;
      }

      // Cache the row and col of this focal tile so Slider -> Grid matches the exact same card:
      lastGridRowRef.current = focalItem.row;
      lastGridColRef.current = focalItem.col;

      const focalCenterY = focalItem.centerY;
      const focalCenterX = focalItem.centerX;
      const focalIdx = focalItem.idx;
      const focalMoveY = scY - focalCenterY;

      const topRowEls: HTMLElement[] = [];
      const bottomRowEls: HTMLElement[] = [];
      const middleRowTiles: Array<{
        cardEl: HTMLElement;
        deltaCol: number;
        currentCenterX: number;
        currentCenterY: number;
        idx?: number;
      }> = [];
      const otherEls: HTMLElement[] = [];

      const scaleX = SLIDER_CARD_WIDTH / TILE_WIDTH;
      const scaleY = SLIDER_CARD_HEIGHT / TILE_HEIGHT;

      allGridTiles.forEach((tile) => {
        const dy = tile.centerY - focalCenterY;
        if (dy < -TILE_HEIGHT * 0.45) {
          topRowEls.push(tile.cardEl);
        } else if (dy > TILE_HEIGHT * 0.45) {
          bottomRowEls.push(tile.cardEl);
        } else {
          const dx = tile.centerX - focalCenterX;
          const deltaCol = Math.round(dx / STEP_X);
          if (Math.abs(deltaCol) <= 8) {
            middleRowTiles.push({
              cardEl: tile.cardEl,
              deltaCol,
              currentCenterX: tile.centerX,
              currentCenterY: tile.centerY,
              idx: tile.idx,
            });
          } else {
            otherEls.push(tile.cardEl);
          }
        }
      });

      // Unified, liquid-smooth Grid -> Slider choreography (Zero glitch, zero collision)
      const tl = gsap.timeline({
        onComplete: () => {
          const rawTargetX = scX - SLIDER_CARD_WIDTH / 2 - focalIdx * SLIDER_STRIDE;
          const targetSliderPanX = wrapRange(rawTargetX, sliderBlockWidth);
          currentPanRef.current = { x: targetSliderPanX, y: 0 };
          targetPanRef.current = { x: targetSliderPanX, y: 0 };

          setViewMode('slider');
          saveStateToStorage('slider', targetSliderPanX, 0);
        },
      });

      // 1. Top row disperses upwards with ease-in-out (guaranteed clean separation away from focal row)
      if (topRowEls.length > 0) {
        tl.to(
          topRowEls,
          {
            y: Math.min(-380, focalMoveY - 320),
            opacity: 0,
            duration: 0.72,
            ease: 'power2.inOut',
          },
          0
        );
      }

      // 2. Bottom row disperses downwards with ease-in-out (guaranteed clean separation away from focal row)
      if (bottomRowEls.length > 0) {
        tl.to(
          bottomRowEls,
          {
            y: Math.max(380, focalMoveY + 320),
            opacity: 0,
            duration: 0.72,
            ease: 'power2.inOut',
          },
          0
        );
      }

      // 3. Flank / outside cards fade out smoothly
      if (otherEls.length > 0) {
        tl.to(
          otherEls,
          {
            opacity: 0,
            duration: 0.45,
            ease: 'power2.out',
          },
          0
        );
      }

      // 4. Middle row cards scale to slider dimensions and slide into center horizontal filmstrip
      middleRowTiles.forEach((m) => {
        m.cardEl.style.zIndex = String(30 - Math.min(10, Math.abs(m.deltaCol)));
        const targetCenterX = scX + m.deltaCol * SLIDER_STRIDE;
        const targetCenterY = scY;
        const moveX = targetCenterX - m.currentCenterX;
        const moveY = targetCenterY - m.currentCenterY;

        tl.to(
          m.cardEl,
          {
            x: moveX,
            y: moveY,
            scaleX: scaleX,
            scaleY: scaleY,
            transformOrigin: 'center center',
            duration: 0.75,
            ease: 'power2.inOut',
          },
          0
        );

        // Smoothly calibrate image wrapper parallax to the slider focal perspective
        const wrapper = m.cardEl.querySelector<HTMLElement>('.parallax-wrapper');
        if (wrapper) {
          const normX = (targetCenterX - scX) / scX;
          const defaultPx = Math.max(-28, Math.min(28, -normX * 18));
          // Compensate for parent card scaleX so on-screen image position exactly matches unscaled slider card
          const compensatedPx = defaultPx / scaleX;
          tl.to(
            wrapper,
            {
              transform: `scale(1.22) translate3d(${compensatedPx.toFixed(1)}px, 0px, 0px)`,
              duration: 0.75,
              ease: 'power2.inOut',
            },
            0
          );
        }

        // Keep focal photo colored (100%), neighbor cards smoothly fade color overlay
        const overlay = m.cardEl.querySelector<HTMLElement>('.color-overlay');
        if (overlay) {
          tl.to(
            overlay,
            {
              opacity: m.deltaCol === 0 ? 1 : 0,
              duration: 0.6,
              ease: 'power2.inOut',
            },
            0
          );
        }
      });

    } else if (viewMode === 'slider' && newMode === 'grid') {
      // --- MODE 2: SLIDER -> GRID ---
      let minDist = 999999;
      let centerIdx = 0;
      let sliderOffsetFromCenter = 0;

      SLIDER_OFFSETS.forEach((so) => {
        displayProjects.forEach((_, idx) => {
          const el = document.getElementById(`slider_card_${so}_${idx}`);
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const dist = Math.abs(centerX - scX);
          if (dist < minDist) {
            minDist = dist;
            centerIdx = idx;
            sliderOffsetFromCenter = centerX - scX;
          }
        });
      });

      sliderOffsetRef.current = sliderOffsetFromCenter;

      const targetRow =
        lastGridRowRef.current !== null ? lastGridRowRef.current : Math.floor(GRID_ROWS / 2);
      const targetCol =
        ((centerIdx - targetRow) % displayProjects.length + displayProjects.length) %
        displayProjects.length;

      const gridSnapX = scX - TILE_WIDTH / 2 - targetCol * STEP_X;
      const gridSnapY = scY - TILE_HEIGHT / 2 - targetRow * STEP_Y;

      // Directly transition without artificial pre-freeze
      currentPanRef.current = { x: gridSnapX, y: gridSnapY };
      targetPanRef.current = { x: gridSnapX, y: gridSnapY };
      transitionDirectionRef.current = 'slider-to-grid';
      setViewMode('grid');
      saveStateToStorage('grid', gridSnapX, gridSnapY);
    }
  }, [viewMode, displayProjects, sliderBlockWidth, saveStateToStorage]);

  // Native Hardware-Accelerated Free Drag & Wheel Engine (Bypasses React SyntheticEvents)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || isTransitioningRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('header, button, nav, a, [role="button"]')) {
        return;
      }
      // If already gliding fast, catch it immediately without jumping
      wasFlingingRef.current = isFlingingRef.current;
      isFlingingRef.current = false;

      isDraggingRef.current = true;
      isWheelingRef.current = false;
      dragIntentActiveRef.current = true;
      dragDistanceRef.current = 0;
      strokeAccumulatorRef.current = 0;
      dragStartTimeRef.current = performance.now();

      // Cancel any pending wheel snap
      if (wheelSnapTimeoutRef.current) clearTimeout(wheelSnapTimeoutRef.current);

      // Lock pointer start to the exact current pan position
      pointerStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: currentPanRef.current.x,
        panY: currentPanRef.current.y,
      };
      targetPanRef.current.x = currentPanRef.current.x;
      targetPanRef.current.y = currentPanRef.current.y;

      const now = performance.now();
      lastPointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: now,
      };
      pointerHistoryRef.current = [{ x: e.clientX, y: e.clientY, time: now }];
      velocityRef.current = { vx: 0, vy: 0 };
      wakeLoopRef.current();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (listPreviewRef.current) {
        listPreviewRef.current.style.transform = `translate3d(${e.clientX + 24}px, ${e.clientY - 140}px, 0)`;
      }

      if (!isDraggingRef.current) return;

      const now = performance.now();
      const dt = Math.max(1, now - lastPointerRef.current.time);
      const stepDx = e.clientX - lastPointerRef.current.x;
      const stepDy = e.clientY - lastPointerRef.current.y;

      // Append to FIFO history for rock-solid flick velocity calculation
      pointerHistoryRef.current.push({ x: e.clientX, y: e.clientY, time: now });
      if (pointerHistoryRef.current.length > 8) {
        pointerHistoryRef.current.shift();
      }
      pointerHistoryRef.current = pointerHistoryRef.current.filter(
        (p) => now - p.time <= 140
      );

      // Smoothed velocity vector for immediate visual feedback
      const rawVx = stepDx / dt;
      const rawVy = stepDy / dt;
      velocityRef.current = {
        vx: velocityRef.current.vx * 0.5 + rawVx * 0.5,
        vy: velocityRef.current.vy * 0.5 + rawVy * 0.5,
      };

      const distFromStart = Math.hypot(
        e.clientX - pointerStartRef.current.x,
        e.clientY - pointerStartRef.current.y
      );
      dragDistanceRef.current = distFromStart;

      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };

      // 1:1 Direct agile pointer tracking
      targetPanRef.current.x += stepDx;
      if (viewMode === 'grid') {
        targetPanRef.current.y += stepDy;
      } else if (viewMode === 'slider') {
        sliderHasScrolledRef.current = true;
      }
      wakeLoopRef.current();
    };

    const onPointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      dragIntentActiveRef.current = false;

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const strideX = viewMode === 'slider' ? SLIDER_STRIDE : STEP_X;
      const strideY = STEP_Y;

      // Compute weighted velocity from pointer history over the last ~100ms
      const history = pointerHistoryRef.current;
      let computedVx = velocityRef.current.vx;
      let computedVy = velocityRef.current.vy;

      if (history.length >= 2) {
        const oldest = history[0];
        const newest = history[history.length - 1];
        const totalDt = Math.max(10, newest.time - oldest.time);
        computedVx = (newest.x - oldest.x) / totalDt;
        computedVy = (newest.y - oldest.y) / totalDt;
      }

      // If finger was held stationary right before lifting, cancel velocity
      const timeSinceLastMove = performance.now() - lastPointerRef.current.time;
      if (timeSinceLastMove > 90) {
        computedVx = 0;
        computedVy = 0;
      }

      const speed = Math.hypot(computedVx, computedVy);

      let projectedX = currentPanRef.current.x;
      let projectedY = currentPanRef.current.y;

      if (speed > 0.18) {
        // High-velocity flick momentum: very slippery ("sangat licin"), glides across multiple cards
        isFlingingRef.current = true;

        // Dynamic multiplier: faster flick = longer effortless glide ("bergulir seiringan")
        const multiplier = isMobile
          ? 340 + Math.min(180, speed * 70)
          : 220 + Math.min(100, speed * 40);

        const maxCards = isMobile ? 12 : 5;
        const maxFlingX = strideX * maxCards;
        const maxFlingY = strideY * maxCards;

        const flingX = Math.max(-maxFlingX, Math.min(maxFlingX, computedVx * multiplier));
        const flingY = Math.max(-maxFlingY, Math.min(maxFlingY, computedVy * multiplier));

        projectedX = currentPanRef.current.x + flingX;
        projectedY = currentPanRef.current.y + flingY;
      } else {
        isFlingingRef.current = false;
      }

      // Always snap crisply and authoritatively to the nearest card
      const snap = getSnapCoordinates(projectedX, projectedY, viewMode);
      targetPanRef.current.x = snap.x;
      if (viewMode === 'grid') {
        targetPanRef.current.y = snap.y;
      }
      saveStateToStorage(viewMode, snap.x, viewMode === 'grid' ? snap.y : 0);
      wakeLoopRef.current();

      // Clear wasFlinging after click event could have fired (100ms)
      setTimeout(() => {
        wasFlingingRef.current = false;
      }, 100);
    };

    const onPointerLeave = () => {};

    // 2D Wheel Scroll navigation directly updating targetPanRef with smooth glide & snap
    const onWheel = (e: WheelEvent) => {
      if (isTransitioningRef.current) return;
      e.preventDefault();

      isWheelingRef.current = true;

      // Snappy, agile wheel physics: 1:1 responsive glide
      const isMouseWheel = Math.abs(e.deltaY) >= 40 || Math.abs(e.deltaX) >= 40;
      const wheelMultiplier = isMouseWheel ? 1.25 : 1.0;

      if (viewMode === 'slider') {
        sliderHasScrolledRef.current = true;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        targetPanRef.current.x -= delta * wheelMultiplier;
      } else {
        targetPanRef.current.x -= e.deltaX * wheelMultiplier;
        targetPanRef.current.y -= e.deltaY * wheelMultiplier;
      }
      wakeLoopRef.current();

      // Smooth snap to nearest card when wheel scrolling settles (90ms debounce for prompt crisp docking)
      if (wheelSnapTimeoutRef.current) clearTimeout(wheelSnapTimeoutRef.current);
      wheelSnapTimeoutRef.current = setTimeout(() => {
        isWheelingRef.current = false;
        const snap = getSnapCoordinates(
          targetPanRef.current.x,
          targetPanRef.current.y,
          viewMode
        );
        targetPanRef.current.x = snap.x;
        if (viewMode === 'grid') {
          targetPanRef.current.y = snap.y;
        }
        saveStateToStorage(viewMode, snap.x, viewMode === 'grid' ? snap.y : 0);
        wakeLoopRef.current();
      }, 90);
    };

    container.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('wheel', onWheel);
      if (wheelSnapTimeoutRef.current) clearTimeout(wheelSnapTimeoutRef.current);
    };
  }, [viewMode, saveStateToStorage]);

  // Handle Project Click:
  // - Open full video modal popup when clicked/pressed
  const handleProjectClick = (
    e: React.MouseEvent<HTMLElement>,
    project: CategoryProject,
    cardId?: string
  ) => {
    if (
      isTransitioningRef.current ||
      dragDistanceRef.current > 10 ||
      dragIntentActiveRef.current ||
      wasFlingingRef.current
    ) {
      // Drag move, transition, or stopping a fast glide: don't trigger click action
      return;
    }

    // In Grid and Slider modes:
    // Only the center colored card can open the full-screen modal!
    // If an outer (non-colored) card is clicked, smoothly shift the screen so it becomes the center focal card.
    if (viewMode === 'grid' || viewMode === 'slider') {
      const el = cardId ? document.getElementById(cardId) : (e.currentTarget as HTMLElement);
      if (el && typeof window !== 'undefined') {
        const rect = el.getBoundingClientRect();
        const cardCenterX = rect.left + rect.width / 2;
        const cardCenterY = rect.top + rect.height / 2;
        const scX = window.innerWidth / 2;
        const scY = window.innerHeight / 2;

        const dist =
          viewMode === 'slider'
            ? Math.abs(cardCenterX - scX)
            : Math.hypot(cardCenterX - scX, cardCenterY - scY);

        const centerTolerance = Math.min(65, TILE_WIDTH * 0.38);
        if (dist >= centerTolerance) {
          // Card is outside the center colored point: shift screen so this card becomes center
          const moveX = scX - cardCenterX;
          const moveY = scY - cardCenterY;

          const rawTargetX = currentPanRef.current.x + moveX;
          const rawTargetY = viewMode === 'grid' ? currentPanRef.current.y + moveY : 0;

          const snap = getSnapCoordinates(rawTargetX, rawTargetY, viewMode);
          targetPanRef.current.x = snap.x;
          if (viewMode === 'grid') {
            targetPanRef.current.y = snap.y;
          }
          saveStateToStorage(viewMode, snap.x, viewMode === 'grid' ? snap.y : 0);
          wakeLoopRef.current();
          return;
        }
      }
    }

    // Stop background card audio fade if opening modal
    stopVideoWithAudioFadeOut();

    // Open full video modal popup
    setActiveModalProject(project);
  };

  // Keyboard Escape listener to exit modal smoothly
  useEffect(() => {
    if (!activeModalProject) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModalProject, closeModal]);

  // Unified Reverse Transition ("Keluar Mundur ke Jendela") returning to Work section
  const handleBackToWork = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.preventDefault();
      stopVideoWithAudioFadeOut();
      startReverseTransition(category.slug);
    },
    [category.slug, startReverseTransition, stopVideoWithAudioFadeOut]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-[100dvh] overflow-hidden select-none bg-[#030712] text-zinc-100 font-sans cursor-grab active:cursor-grabbing opacity-100"
      style={{
        touchAction: 'none',
      }}
    >
      {/* 2. TOP FIXED EDITORIAL HUD BAR (1:1 Remy Shoots style) */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 py-2 sm:py-5 flex items-start justify-between pointer-events-none safe-pt">
        {/* Top-Left: Monogram & Editorial Tagline */}
        <div className="pointer-events-auto flex items-start gap-4">
          <button
            type="button"
            onClick={handleBackToWork}
            className="min-h-[44px] inline-flex items-center font-mono text-sm tracking-widest font-black uppercase text-zinc-200 hover:text-cyan-400 transition-colors py-0.5 cursor-pointer text-left"
          >
            RG<sup>®</sup>
          </button>
          <div className="hidden sm:block border-l border-zinc-700/60 pl-4">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase leading-relaxed text-zinc-400">
              DOCUMENTING EMOTION,
              <br />
              MOVEMENT AND MEANING.
            </p>
          </div>
        </div>

        {/* Top-Center: Minimalist View Mode Switcher (SLIDER / GRID) - 1:1 RemyShoots style */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1 sm:top-5 pointer-events-auto flex items-center gap-6 sm:gap-8 select-none font-mono text-[11px] md:text-[12px] tracking-[0.25em] font-bold uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => switchViewMode('slider')}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-colors py-0.5 ${
                viewMode === 'slider' ? 'text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              SLIDER
            </button>
            <span
              className={`text-[8px] text-[#ef4444] leading-none -mt-1 transition-opacity duration-200 ${
                viewMode === 'slider' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              ▲
            </span>
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => switchViewMode('grid')}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center transition-colors py-0.5 ${
                viewMode === 'grid' ? 'text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              GRID
            </button>
            <span
              className={`text-[8px] text-[#ef4444] leading-none -mt-1 transition-opacity duration-200 ${
                viewMode === 'grid' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              ▲
            </span>
          </div>
        </div>

        {/* Top-Right: Back Button with Zoom-Out Transition */}
        <nav className="pointer-events-auto flex items-center gap-6 font-mono text-[11px] tracking-[0.25em] uppercase">
          {/* Back to Portfolio Showcase with Zoom-Out Camera Pull-Back */}
          <button
            type="button"
            onClick={handleBackToWork}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 hover:text-cyan-400 hover:border-cyan-400/60 transition-all shadow-md backdrop-blur-md cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK</span>
          </button>
        </nav>
      </header>

      {/* 3. MAIN INTERACTIVE 2D CANVASES */}
      {/* MODE A: INFINITE 2D FREE-DRAG CANVAS GRID (Hardware-Accelerated Tapestry with Dynamic Proximity Color) */}
      {viewMode === 'grid' && (
        <div
          ref={canvasRef}
          suppressHydrationWarning
          className="absolute inset-0 w-full h-full will-change-transform"
          style={{
            transform: `translate3d(${wrapRange(currentPanRef.current.x, BLOCK_WIDTH).toFixed(3)}px, ${wrapRange(currentPanRef.current.y, BLOCK_HEIGHT).toFixed(3)}px, 0)`,
          }}
        >
          {BLOCK_Y_OFFSETS.map((by) =>
            BLOCK_X_OFFSETS.map((bx) => (
              <div
                key={`grid_block_${bx}_${by}`}
                suppressHydrationWarning
                className="absolute"
                style={{
                  left: `${bx * BLOCK_WIDTH}px`,
                  top: `${by * BLOCK_HEIGHT}px`,
                  width: `${BLOCK_WIDTH}px`,
                  height: `${BLOCK_HEIGHT}px`,
                }}
              >
                {Array.from({ length: GRID_ROWS }).map((_, row) =>
                  Array.from({ length: GRID_COLS }).map((_, col) => {
                    const projIdx = (col + row * 2) % displayProjects.length;
                    const project = displayProjects[projIdx];
                    if (!project) return null;

                    const isCenterTile = bx === 0 && by === 0 && row === 0 && col === 0;
                    const initialGridOpacity = isCenterTile ? 1 : 0;
                    const initialGridPx = 0;
                    const initialGridPy = 0;

                    return (
                      <div
                        id={`grid_card_${bx}_${by}_${row}_${col}`}
                        key={`grid_card_${bx}_${by}_${row}_${col}_${project.id}`}
                        suppressHydrationWarning
                        onClick={(e) =>
                          handleProjectClick(
                            e,
                            project,
                            `grid_card_${bx}_${by}_${row}_${col}`
                          )
                        }
                        className="gallery-card-item cinema-card-tile absolute overflow-hidden bg-black select-none"
                        style={{
                          left: `${col * STEP_X}px`,
                          top: `${row * STEP_Y}px`,
                          width: `${TILE_WIDTH}px`,
                          height: `${TILE_HEIGHT}px`,
                        }}
                      >
                        <div
                          suppressHydrationWarning
                          className="parallax-wrapper w-full h-full relative will-change-transform"
                          style={{
                            transform: `scale(1.32) translate3d(${initialGridPx.toFixed(1)}px, ${initialGridPy.toFixed(1)}px, 0px)`,
                          }}
                        >
                          <img
                            src={project.thumbnail}
                            alt={project.title}
                            draggable={false}
                            loading={bx === 0 && by === 0 && row < 3 && col < 4 ? 'eager' : 'lazy'}
                            decoding="async"
                            className="monochrome-base w-full h-full min-w-full min-h-full object-cover pointer-events-none"
                          />
                          <div
                            suppressHydrationWarning
                            className="color-overlay absolute inset-0 w-full h-full pointer-events-none will-change-opacity"
                            style={{ opacity: initialGridOpacity }}
                          >
                            <img
                              src={project.thumbnail}
                              alt=""
                              draggable={false}
                              loading={bx === 0 && by === 0 && row < 3 && col < 4 ? 'eager' : 'lazy'}
                              decoding="async"
                              className="color-img w-full h-full min-w-full min-h-full object-cover pointer-events-none"
                            />
                          </div>
                          {project.preview_video || (project.video_url?.endsWith('.mp4') ? project.video_url : null) ? (
                            <div className="card-video-layer absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-0 transition-opacity duration-200 z-10 bg-transparent">
                              <video
                                data-card-video={project.id}
                                data-src={project.preview_video || project.video_url}
                                src={isCenterTile ? (project.preview_video || project.video_url) : undefined}
                                loop
                                playsInline
                                preload={isCenterTile ? "metadata" : "none"}
                                className="w-full h-full min-w-full min-h-full object-cover pointer-events-none"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <div className="card-audio-indicator absolute bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-cyan-400/50 text-[9px] font-mono text-cyan-300 opacity-0 transition-opacity duration-300 shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                <span className="tracking-widest font-bold">AUDIO ON</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* MODE B: INFINITE SLIDER VIEW (Horizontal Filmstrip Carousel with Dynamic Proximity Color) */}
      {viewMode === 'slider' && (
        <div
          ref={canvasRef}
          suppressHydrationWarning
          className="absolute inset-0 w-full h-full flex items-center will-change-transform"
          style={{
            transform: `translate3d(${wrapRange(currentPanRef.current.x, sliderBlockWidth).toFixed(3)}px, 0, 0)`,
          }}
        >
          {SLIDER_OFFSETS.map((so) => (
            <div
              key={`slider_block_${so}`}
              suppressHydrationWarning
              className="absolute inset-y-0 h-full flex items-center select-none"
              style={{
                left: `${so * sliderBlockWidth}px`,
                width: `${sliderBlockWidth}px`,
              }}
            >
              {displayProjects.map((project, idx) => {
                const isCenterSlider = so === 0 && idx === 0;
                const initialPx = 0;
                const initialOpacity = isCenterSlider ? 1 : 0;

                return (
                  <div
                    id={`slider_card_${so}_${idx}`}
                    key={`slider_card_${so}_${project.id}_${idx}`}
                    data-flip-id={so === 0 ? `card-${project.id}` : undefined}
                    suppressHydrationWarning
                    onClick={(e) =>
                      handleProjectClick(e, project, `slider_card_${so}_${idx}`)
                    }
                    className="gallery-card-item cinema-card-tile relative flex-shrink-0 overflow-hidden bg-black select-none"
                    style={{
                      width: `${SLIDER_CARD_WIDTH}px`,
                      height: `${SLIDER_CARD_HEIGHT}px`,
                    }}
                  >
                    <div
                      suppressHydrationWarning
                      className="parallax-wrapper w-full h-full relative will-change-transform"
                      style={{
                        transform: `scale(1.32) translate3d(${initialPx.toFixed(1)}px, 0px, 0px)`,
                      }}
                    >
                      <img
                        src={project.thumbnail}
                        alt={project.title}
                        draggable={false}
                        loading={so === 0 && idx < 5 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="monochrome-base w-full h-full min-w-full min-h-full object-cover pointer-events-none"
                      />
                      <div
                        suppressHydrationWarning
                        className="color-overlay absolute inset-0 w-full h-full pointer-events-none will-change-opacity"
                        style={{ opacity: initialOpacity }}
                      >
                        <img
                          src={project.thumbnail}
                          alt=""
                          draggable={false}
                          loading={so === 0 && idx < 5 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="color-img w-full h-full min-w-full min-h-full object-cover pointer-events-none"
                        />
                      </div>
                      {project.preview_video || (project.video_url?.endsWith('.mp4') ? project.video_url : null) ? (
                        <div className="card-video-layer absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-0 transition-opacity duration-200 z-10 bg-transparent">
                          <video
                            data-card-video={project.id}
                            data-src={project.preview_video || project.video_url}
                            src={isCenterSlider ? (project.preview_video || project.video_url) : undefined}
                            loop
                            playsInline
                            preload={isCenterSlider ? "metadata" : "none"}
                            className="w-full h-full min-w-full min-h-full object-cover pointer-events-none"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div className="card-audio-indicator absolute bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-cyan-400/50 text-[9px] font-mono text-cyan-300 opacity-0 transition-opacity duration-300 shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            <span className="tracking-widest font-bold">AUDIO ON</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* CINEMATIC SOFT VIGNETTE & PROGRESSIVE PERIPHERAL BLUR (Grid & Slider modes) */}
      {(viewMode === 'grid' || viewMode === 'slider') && (
        <div className="cinematic-vignette-blur-overlay pointer-events-none fixed inset-0 z-30 overflow-hidden">
          <div className="vignette-blur-layer-1 absolute inset-0 pointer-events-none" />
          <div className="vignette-blur-layer-2 absolute inset-0 pointer-events-none" />
          <div className="vignette-tint-layer absolute inset-0 pointer-events-none" />
          <div className="vignette-fisheye-ring absolute inset-0 pointer-events-none" />
        </div>
      )}

      {/* MODE C: LIST VIEW (Minimalist Editorial Directory) */}
      {viewMode === 'list' && (
        <div className="absolute inset-0 w-full h-full overflow-y-auto pt-28 pb-24 px-8 md:px-20 select-none">
          <div className="max-w-6xl mx-auto flex flex-col">
            {/* Header row */}
            <div className="grid grid-cols-12 py-3 border-b border-zinc-800 font-mono text-[10px] tracking-[0.3em] uppercase text-zinc-500">
              <span className="col-span-1">#</span>
              <span className="col-span-5">PROJECT / TITLE</span>
              <span className="col-span-2">CLIENT</span>
              <span className="col-span-2">FORMAT</span>
              <span className="col-span-2 text-right">YEAR / ACTION</span>
            </div>

            {/* List Rows */}
            {filteredProjects.map((project, idx) => {
              const isHovered = hoveredProjectId === project.id;
              return (
                <div
                  key={project.id}
                  data-flip-id={`card-${project.id}`}
                  onClick={(e) => handleProjectClick(e, project)}
                  onPointerEnter={() => setHoveredProjectId(project.id)}
                  onPointerLeave={() => setHoveredProjectId(null)}
                  className={`gallery-card-item grid grid-cols-12 py-4 border-b border-zinc-800/60 items-center font-mono text-xs tracking-wider transition-all duration-200 cursor-pointer ${isHovered
                    ? 'bg-cyan-950/20 text-cyan-200 pl-2'
                    : 'text-zinc-300 hover:text-white'
                    }`}
                >
                  <span className="col-span-1 text-zinc-500 font-mono text-[11px]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="col-span-5 flex flex-col">
                    <span className="font-sans font-bold text-sm text-white group-hover:text-cyan-300">
                      {project.title}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                      {project.tag} • {project.role}
                    </span>
                  </div>
                  <span className="col-span-2 text-zinc-400 font-bold uppercase text-[11px]">
                    {project.client}
                  </span>
                  <span className="col-span-2 font-mono text-[10px] tracking-widest uppercase text-cyan-400">
                    {project.type === 'motion'
                      ? `MOTION [${project.duration}]`
                      : `STILLS [${project.duration}]`}
                  </span>
                  <div className="col-span-2 text-right flex items-center justify-end gap-3">
                    <span className="text-zinc-500 text-[11px]">{project.year}</span>
                    <span className="px-2 py-1 rounded text-[9px] uppercase tracking-widest bg-zinc-900 border border-zinc-700 text-cyan-300 group-hover:border-cyan-400">
                      VIEW →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Hover Thumbnail for List View */}
          {hoveredProjectId && (
            <div
              ref={listPreviewRef}
              className="fixed pointer-events-none z-30 w-64 h-80 rounded-lg overflow-hidden border border-cyan-400/80 shadow-[0_0_40px_rgba(56,189,248,0.5)] will-change-transform"
              style={{
                left: 0,
                top: 0,
                transform: 'translate3d(-9999px, -9999px, 0)',
              }}
            >
              {(() => {
                const p = category.projects.find((item) => item.id === hoveredProjectId);
                if (!p) return null;
                return (
                  <img
                    src={p.thumbnail}
                    alt={p.title}
                    className="w-full h-full object-cover"
                  />
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Deep Cinematic Fish-Eye Vignette & Atmosphere */}
      <div
        className="fixed inset-0 pointer-events-none z-20 select-none"
        style={{
          background:
            'radial-gradient(ellipse 86% 80% at 50% 50%, transparent 40%, rgba(2,6,18,0.32) 65%, rgba(2,6,18,0.86) 88%, #020512 100%)',
          boxShadow: 'inset 0 0 130px 50px rgba(2,6,18,0.94)',
        }}
      />

      {/* 4. BOTTOM FIXED TECHNICAL HUD BAR */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 px-6 py-3 sm:py-4 flex flex-col pointer-events-none safe-pb">
        <div className="flex items-center justify-center text-zinc-500 font-mono text-[9px] tracking-[0.3em] uppercase pointer-events-auto">
          {/* Bottom Center: Gesture Instructions */}
          <div className="flex items-center gap-2">
            <span className="hidden md:inline">GESTURES : [FREE DRAG & WHEEL SCROLL]</span>
            <span className="inline md:hidden text-[8px] tracking-[0.2em] text-zinc-400">GESTURES : [SWIPE TO EXPLORE]</span>
          </div>
        </div>

        {/* Film Camera Ruler Tick Marks along bottom */}
        <div className="w-full pt-1.5 flex items-center justify-between opacity-30 select-none overflow-hidden font-mono text-[8px] text-zinc-500">
          <span>| . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . |</span>
        </div>
      </footer>

      {/* 5. CINEMA VIDEO / CASE STUDY MODAL (Spring Morphing Pop-Up & Zero Player Controls) */}
      <AnimatePresence>
        {activeModalProject && (() => {
          const aspect = getModalAspectClasses(activeModalProject.aspectRatio);

          return (
            <motion.div
              key="cinema-video-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/90 backdrop-blur-xl select-none"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeModal();
              }}
            >
              <motion.div
                key={`modal-card-${activeModalProject.id}`}
                initial={{ scale: 0.82, opacity: 0, y: 24 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.88, opacity: 0, y: 16 }}
                transition={{
                  type: 'spring',
                  bounce: 0.1,
                  duration: 0.4,
                }}
                className={`relative ${aspect.container} overflow-hidden rounded-2xl border border-cyan-500/40 bg-black shadow-[0_0_100px_rgba(0,0,0,0.95),0_0_50px_rgba(56,189,248,0.25)] flex flex-col`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Pure Cinema Video Player without any UI controls (100% Clean Full Video, Only X button) */}
                <div
                  className={`relative w-full ${aspect.aspect} bg-black overflow-hidden flex items-center justify-center`}
                >
                  {activeModalProject.preview_video || (activeModalProject.video_url && !activeModalProject.video_url.includes('youtube.com') && !activeModalProject.video_url.includes('youtu.be')) ? (
                    <video
                      key={`modal-video-${activeModalProject.id}`}
                      src={activeModalProject.preview_video || activeModalProject.video_url}
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover select-none cursor-pointer"
                      poster={activeModalProject.thumbnail}
                      onClick={(e) => {
                        e.stopPropagation();
                        const v = e.currentTarget;
                        if (v.paused) {
                          v.play().catch(() => {});
                        } else {
                          v.pause();
                        }
                      }}
                      ref={(v) => {
                        if (v) {
                          v.muted = false;
                          v.volume = 1;
                          const p = v.play();
                          if (p !== undefined) {
                            p.catch(() => {
                              v.muted = true;
                              v.play().catch(() => {});
                            });
                          }
                        }
                      }}
                    />
                  ) : activeModalProject.youtube_id || activeModalProject.video_url?.includes('youtube.com') || activeModalProject.video_url?.includes('youtu.be') ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${activeModalProject.youtube_id || (activeModalProject.video_url?.includes('v=') ? activeModalProject.video_url.split('v=')[1]?.split('&')[0] : activeModalProject.video_url?.split('/').pop()?.split('?')[0])}?autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1&showinfo=0&iv_load_policy=3&disablekb=1`}
                      title={activeModalProject.title}
                      className="w-full h-full border-0 pointer-events-auto"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <img
                      src={activeModalProject.thumbnail}
                      alt={activeModalProject.title}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  )}
                </div>

                {/* Single Minimalist Floating Exit Button (X) - Only button present */}
                <button
                  type="button"
                  onClick={closeModal}
                  className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/20 hover:border-cyan-400 text-white/80 hover:text-white transition-all shadow-[0_0_20px_rgba(0,0,0,0.8)] cursor-pointer active:scale-95"
                  aria-label="Close video"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
