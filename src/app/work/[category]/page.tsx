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
import { CATEGORY_DATA, CategoryProject } from '@/data/categoryData';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Flip);
}

// Infinite Canvas Repeating Unit Dimensions (Borderless Seamless Mosaic)
const TILE_WIDTH = 345;
const TILE_HEIGHT = 475;
const TILE_GAP = 0; // Seamless borderless mosaic (all footage touches edge-to-edge)
const STEP_X = TILE_WIDTH + TILE_GAP; // 345px
const STEP_Y = TILE_HEIGHT + TILE_GAP; // 475px

const SLIDER_CARD_WIDTH = 450;
const SLIDER_CARD_HEIGHT = 620; // Exact matched aspect ratio to TILE (345x475 -> 450x620)
const SLIDER_CARD_GAP = 0; // Seamless continuous filmstrip
const SLIDER_STRIDE = SLIDER_CARD_WIDTH + SLIDER_CARD_GAP; // 450px

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
  mode: 'grid' | 'slider' | 'list'
): { x: number; y: number } {
  if (typeof window === 'undefined' || mode === 'list') return { x: rawX, y: rawY };

  const scX = window.innerWidth / 2;
  const scY = window.innerHeight / 2;

  if (mode === 'slider') {
    const baseOffsetX = scX - SLIDER_CARD_WIDTH / 2;
    const stepCountX = Math.round((rawX - baseOffsetX) / SLIDER_STRIDE);
    const snapX = baseOffsetX + stepCountX * SLIDER_STRIDE;
    return { x: snapX, y: 0 };
  }

  // Grid 2D mode: free movement in all directions, snapping to nearest card in both X and Y
  const baseOffsetX = scX - TILE_WIDTH / 2;
  const baseOffsetY = scY - TILE_HEIGHT / 2;

  const stepCountX = Math.round((rawX - baseOffsetX) / STEP_X);
  const stepCountY = Math.round((rawY - baseOffsetY) / STEP_Y);

  const snapX = baseOffsetX + stepCountX * STEP_X;
  const snapY = baseOffsetY + stepCountY * STEP_Y;

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
  // View mode: 'grid' (2D canvas), 'slider' (horizontal filmstrip), 'list' (editorial directory)
  const [viewMode, setViewMode] = useState<'grid' | 'slider' | 'list'>(initialMode);
  const [isReady, setIsReady] = useState(false);
  const [isZoomingOut, setIsZoomingOut] = useState(false);

  // Filter mode: 'all' | 'stills' | 'motion'
  const [activeFilter, setActiveFilter] = useState<'all' | 'stills' | 'motion'>('all');

  // Active Project Video Modal
  const [activeModalProject, setActiveModalProject] = useState<CategoryProject | null>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);

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

  // Cached parallax tiles & color overlay elements for zero-lookup 60-120 FPS proximity fade
  const cachedTilesRef = useRef<
    Array<{
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
    }>
  >([]);

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
  const GRID_COLS = N;
  const GRID_ROWS = N;
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
    const tiles: Array<{
      cardEl: HTMLElement;
      wrapperEl: HTMLElement;
      colorOverlayEl: HTMLElement;
      localX: number;
      localY: number;
      width: number;
      height: number;
      visible?: boolean;
      wasVisible?: boolean;
      lastPx?: number;
      lastPy?: number;
      lastOpacity?: number;
    }> = [];

    if (viewMode === 'grid') {
      BLOCK_Y_OFFSETS.forEach((by) => {
        BLOCK_X_OFFSETS.forEach((bx) => {
          for (let row = 0; row < GRID_ROWS; row++) {
            for (let col = 0; col < GRID_COLS; col++) {
              const id = `grid_card_${bx}_${by}_${row}_${col}`;
              const el = document.getElementById(id);
              const wrapper = el?.querySelector<HTMLElement>('.parallax-wrapper');
              const colorOverlay = el?.querySelector<HTMLElement>('.color-overlay');
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
                });
              }
            }
          }
        });
      });
    } else if (viewMode === 'slider') {
      SLIDER_OFFSETS.forEach((so) => {
        displayProjects.forEach((_, idx) => {
          const id = `slider_card_${so}_${idx}`;
          const el = document.getElementById(id);
          const wrapper = el?.querySelector<HTMLElement>('.parallax-wrapper');
          const colorOverlay = el?.querySelector<HTMLElement>('.color-overlay');
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
            });
          }
        });
      });
    }

    cachedTilesRef.current = tiles;
  }, [viewMode, displayProjects, sliderBlockWidth]);

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
          focalIdx = (normCol + normRow) % displayProjects.length;
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
    const scX = window.innerWidth / 2;
    const scY = window.innerHeight / 2;

    let targetX = scX - TILE_WIDTH / 2 - 2 * STEP_X;
    let targetY = scY - TILE_HEIGHT / 2 - 2 * STEP_Y;

    try {
      const savedStr =
        sessionStorage.getItem(`portfolio_state_${categoryKey}`) ||
        localStorage.getItem(`portfolio_state_${categoryKey}`);

      let mode = viewModeRef.current;
      let savedPanX: number | null = null;
      let savedPanY: number | null = null;
      let savedFocalIdx: number | null = null;

      if (savedStr) {
        const saved = JSON.parse(savedStr);
        if (saved.viewMode) mode = saved.viewMode;
        if (typeof saved.panX === 'number') savedPanX = saved.panX;
        if (typeof saved.panY === 'number') savedPanY = saved.panY;
        if (typeof saved.focalIdx === 'number') savedFocalIdx = saved.focalIdx;
      }

      if (mode === 'slider') {
        const focalIdx = typeof savedFocalIdx === 'number' ? savedFocalIdx : 0;
        const rawTargetX = scX - SLIDER_CARD_WIDTH / 2 - focalIdx * SLIDER_STRIDE;
        targetX = wrapRange(rawTargetX, sliderBlockWidth);
        targetY = 0;
      } else if (
        mode === 'grid' &&
        typeof savedPanX === 'number' &&
        typeof savedPanY === 'number'
      ) {
        const snap = getSnapCoordinates(savedPanX, savedPanY, 'grid');
        targetX = snap.x;
        targetY = snap.y;
      }
    } catch {}

    targetPanRef.current = { x: targetX, y: targetY };
    currentPanRef.current = { x: targetX, y: targetY };
    pointerStartRef.current.panX = targetX;
    pointerStartRef.current.panY = targetY;

    if (canvasRef.current) {
      const wx =
        viewModeRef.current === 'grid'
          ? wrapRange(targetX, BLOCK_WIDTH)
          : wrapRange(targetX, sliderBlockWidth);
      const wy =
        viewModeRef.current === 'grid' ? wrapRange(targetY, BLOCK_HEIGHT) : 0;
      canvasRef.current.style.transform = `translate3d(${wx.toFixed(3)}px, ${wy.toFixed(3)}px, 0)`;
    }
  }, [categoryKey, sliderBlockWidth, BLOCK_WIDTH, BLOCK_HEIGHT]);

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

    const handleResize = () => {
      const snap = getSnapCoordinates(
        targetPanRef.current.x,
        targetPanRef.current.y,
        viewModeRef.current
      );
      targetPanRef.current = snap;
      saveStateToStorage(viewModeRef.current, snap.x, snap.y);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [categoryKey, saveStateToStorage]);

  // High-performance 60-120 FPS hardware-accelerated RAF Lerp loop
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

      if (isDraggingRef.current) {
        // Active pointer drag: instantaneous, agile tracking with zero perceived lag
        chaseEase = 0.28;
      } else if (isWheelingRef.current) {
        // Active wheel scrolling: light, fluid, highly responsive
        chaseEase = 0.22;
      } else {
        // Snappy, authoritative docking into exact card center
        velocityRef.current.vx *= 0.90;
        velocityRef.current.vy *= 0.90;
        chaseEase = 0.24;
      }

      currentPanRef.current.x +=
        (targetPanRef.current.x - currentPanRef.current.x) * chaseEase;
      currentPanRef.current.y +=
        (targetPanRef.current.y - currentPanRef.current.y) * chaseEase;

      // Lock subpixel precision when settled to eliminate micro-jitter
      if (!isDraggingRef.current && !isWheelingRef.current) {
        if (Math.abs(targetPanRef.current.x - currentPanRef.current.x) < 0.4) {
          currentPanRef.current.x = targetPanRef.current.x;
        }
        if (Math.abs(targetPanRef.current.y - currentPanRef.current.y) < 0.4) {
          currentPanRef.current.y = targetPanRef.current.y;
        }
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

        const r0 = 65;
        const r1 = 500;
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

            // Optical parallax displacement: subtle and restrained for cinematic stability
            const px = Math.max(-28, Math.min(28, -normX * 18 + lagX));
            const py = isSlider ? 0 : Math.max(-32, Math.min(32, -normY * 20 + lagY));

            // Only update transform if changed noticeably (avoids layout/style recalc)
            if (
              tile.lastPx === undefined ||
              Math.abs(px - tile.lastPx) > 0.08 ||
              Math.abs(py - (tile.lastPy || 0)) > 0.08
            ) {
              tile.wrapperEl.style.transform = `scale(1.22) translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
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

        const tAllowance = Math.max(0, Math.min(1, (minDist - 55) / 150));
        const otherCardAllowance = tAllowance * tAllowance * (3 - 2 * tAllowance);

        // Second pass: apply proximity color only on visible cards, only when opacity changes
        for (let i = 0; i < tileCount; i++) {
          const tile = tiles[i];
          if (!tile.visible || tile.dist === undefined) continue;

          const dist = tile.dist;
          let baseFactor = 0;
          if (dist <= r0) {
            baseFactor = 1.0;
          } else if (dist < r1) {
            const t = (dist - r0) / rDiff;
            baseFactor = 0.5 * (1 + Math.cos(t * Math.PI));
          } else {
            baseFactor = 0;
          }

          const finalFactor = i === closestIdx ? baseFactor : baseFactor * otherCardAllowance;
          if (
            tile.lastOpacity === undefined ||
            Math.abs(finalFactor - tile.lastOpacity) > 0.005
          ) {
            tile.colorOverlayEl.style.opacity = finalFactor.toFixed(3);
            tile.lastOpacity = finalFactor;
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [viewMode, sliderBlockWidth, displayProjects.length, refreshCachedTiles]);

  // Close modal with transitions-dev asymmetric exit
  const closeModal = useCallback(() => {
    setIsModalClosing(true);
    setTimeout(() => {
      setActiveModalProject(null);
      setIsModalClosing(false);
    }, 160);
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
        let baseFactor = 0;
        if (dist <= 65) baseFactor = 1.0;
        else if (dist < 500) {
          const t = (dist - 65) / (500 - 65);
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
            tile.colorOverlayEl.style.opacity = dist < 70 ? '1' : '0';
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
        const finalOpacity = dist < 70 ? 1 : 0;
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

      lastPointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
      };
      velocityRef.current = { vx: 0, vy: 0 };
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

      // Smoothed velocity vector using exponential moving average
      const rawVx = stepDx / dt;
      const rawVy = stepDy / dt;
      velocityRef.current = {
        vx: velocityRef.current.vx * 0.7 + rawVx * 0.3,
        vy: velocityRef.current.vy * 0.7 + rawVy * 0.3,
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
    };

    const onPointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      dragIntentActiveRef.current = false;

      // Smooth inertia fling with momentum (up to 3 cards distance based on flick velocity)
      const maxFling = viewMode === 'slider' ? SLIDER_STRIDE * 3 : STEP_X * 3;
      const flingX = Math.max(-maxFling, Math.min(maxFling, velocityRef.current.vx * 150));
      const flingY = Math.max(-STEP_Y * 3, Math.min(STEP_Y * 3, velocityRef.current.vy * 150));
      const projectedX = currentPanRef.current.x + flingX;
      const projectedY = currentPanRef.current.y + flingY;

      // Always snap crisply and authoritatively to the nearest card
      const snap = getSnapCoordinates(projectedX, projectedY, viewMode);
      targetPanRef.current.x = snap.x;
      if (viewMode === 'grid') {
        targetPanRef.current.y = snap.y;
      }
      saveStateToStorage(viewMode, snap.x, viewMode === 'grid' ? snap.y : 0);
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
      }, 90);
    };

    container.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('wheel', onWheel);
      if (wheelSnapTimeoutRef.current) clearTimeout(wheelSnapTimeoutRef.current);
    };
  }, [viewMode, saveStateToStorage]);

  // Handle Project Click:
  // - If clicked card is outside the center: smoothly pan/center to that card
  // - Zero popup: do not open video modal on 2D/Slider canvas, keep screen completely clean!
  const handleProjectClick = (
    e: React.MouseEvent<HTMLElement>,
    project: CategoryProject,
    cardId?: string
  ) => {
    if (isTransitioningRef.current || dragDistanceRef.current > 10 || dragIntentActiveRef.current) {
      // Drag move or transition in progress, don't trigger click action
      return;
    }

    // In List view, row click opens the project modal
    if (viewMode === 'list') {
      setActiveModalProject(project);
      return;
    }

    // On 2D Canvas & Slider: smoothly pan to center the clicked card, zero popup!
    if (typeof window !== 'undefined') {
      const cardEl = e.currentTarget;
      const rect = cardEl.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;
      const scX = window.innerWidth / 2;
      const scY = window.innerHeight / 2;

      const deltaX = scX - cardCenterX;
      const deltaY = scY - cardCenterY;

      if (Math.hypot(deltaX, deltaY) > 4) {
        const nextX = currentPanRef.current.x + deltaX;
        const nextY = currentPanRef.current.y + deltaY;

        const snap = getSnapCoordinates(nextX, nextY, viewMode);
        targetPanRef.current.x = snap.x;
        if (viewMode === 'grid') {
          targetPanRef.current.y = snap.y;
        }
        saveStateToStorage(viewMode, snap.x, viewMode === 'grid' ? snap.y : 0);
      }
    }
  };

  // Cinematic Zoom-Out Exit Transition returning to Work section
  const handleBackToWork = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.preventDefault();
      if (isZoomingOut) return;

      setIsZoomingOut(true);
      isTransitioningRef.current = true;
      velocityRef.current = { vx: 0, vy: 0 };

      // Master Zoom-Out GSAP Timeline (camera pulls backward away from canvas)
      const tl = gsap.timeline({
        onComplete: () => {
          router.push('/?section=work#portfolio');
        },
      });

      // 1. Zoom out the entire canvas with cinematic S-curve
      if (canvasRef.current) {
        tl.to(
          canvasRef.current,
          {
            scale: 0.1,
            opacity: 0,
            filter: 'blur(8px)',
            duration: 0.88,
            ease: 'power3.inOut',
            transformOrigin: '50% 50%',
          },
          0
        );
      }

      // 2. Optical parallax pull-back on all cards
      tl.to(
        '.parallax-wrapper',
        {
          scale: 0.85,
          duration: 0.7,
          ease: 'power2.in',
        },
        0
      );

      // 3. Clean HUD & Vignette exit
      tl.to(
        'header, .cinematic-vignette-blur-overlay',
        {
          opacity: 0,
          duration: 0.4,
          ease: 'power2.out',
        },
        0
      );
    },
    [isZoomingOut, router]
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen overflow-hidden select-none bg-[#030712] text-zinc-100 font-sans cursor-grab active:cursor-grabbing transition-opacity duration-300 ease-out ${
        isReady ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        touchAction: 'none',
      }}
    >
      {/* 2. TOP FIXED EDITORIAL HUD BAR (1:1 Remy Shoots style) */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-5 flex items-start justify-between pointer-events-none">
        {/* Top-Left: Monogram & Editorial Tagline */}
        <div className="pointer-events-auto flex items-start gap-4">
          <button
            type="button"
            onClick={handleBackToWork}
            className="font-mono text-sm tracking-widest font-black uppercase text-zinc-200 hover:text-cyan-400 transition-colors py-0.5 cursor-pointer text-left"
          >
            RG<sup>®</sup>
          </button>
          <div className="border-l border-zinc-700/60 pl-4">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase leading-relaxed text-zinc-400">
              DOCUMENTING EMOTION,
              <br />
              MOVEMENT AND MEANING.
            </p>
          </div>
        </div>

        {/* Top-Center: Minimalist View Mode Switcher (SLIDER / GRID) - 1:1 RemyShoots style */}
        <div className="absolute left-1/2 -translate-x-1/2 top-5 pointer-events-auto flex items-center gap-8 select-none font-mono text-[11px] md:text-[12px] tracking-[0.25em] font-bold uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => switchViewMode('slider')}
              className={`transition-colors py-0.5 ${
                viewMode === 'slider' ? 'text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              SLIDER
            </button>
            <span
              className={`text-[8px] text-[#ef4444] leading-none mt-1 transition-opacity duration-200 ${
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
              className={`transition-colors py-0.5 ${
                viewMode === 'grid' ? 'text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              GRID
            </button>
            <span
              className={`text-[8px] text-[#ef4444] leading-none mt-1 transition-opacity duration-200 ${
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 hover:text-cyan-400 hover:border-cyan-400/60 transition-all shadow-md backdrop-blur-md cursor-pointer"
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
                    const projIdx = (col + row) % displayProjects.length;
                    const project = displayProjects[projIdx];
                    if (!project) return null;
                    return (
                      <div
                        id={`grid_card_${bx}_${by}_${row}_${col}`}
                        key={`grid_card_${bx}_${by}_${row}_${col}_${project.id}`}
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
                          className="parallax-wrapper w-full h-full relative will-change-transform"
                          style={{ transform: 'scale(1.22)' }}
                        >
                          <img
                            src={project.thumbnail}
                            alt={project.title}
                            draggable={false}
                            loading="eager"
                            decoding="sync"
                            className="monochrome-base w-full h-full object-cover pointer-events-none"
                          />
                          <div className="color-overlay absolute inset-0 w-full h-full pointer-events-none opacity-0 will-change-opacity">
                            <img
                              src={project.thumbnail}
                              alt=""
                              draggable={false}
                              loading="eager"
                              decoding="sync"
                              className="color-img w-full h-full object-cover pointer-events-none"
                            />
                          </div>
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
              className="absolute inset-y-0 h-full flex items-center select-none"
              style={{
                left: `${so * sliderBlockWidth}px`,
                width: `${sliderBlockWidth}px`,
              }}
            >
              {displayProjects.map((project, idx) => {
                let initialPx = 0;
                let initialOpacity = 0;
                if (isReady && typeof window !== 'undefined') {
                  const scX = window.innerWidth / 2;
                  const curWx = wrapRange(currentPanRef.current.x, sliderBlockWidth);
                  const localX = so * sliderBlockWidth + idx * SLIDER_STRIDE;
                  const screenX = localX + curWx;
                  const cardCenterX = screenX + SLIDER_CARD_WIDTH / 2;
                  const dist = Math.abs(cardCenterX - scX);
                  initialOpacity = dist < 70 ? 1 : 0;
                  const normX = (cardCenterX - scX) / scX;
                  initialPx = Math.max(-28, Math.min(28, -normX * 18));
                }

                return (
                  <div
                    id={`slider_card_${so}_${idx}`}
                    key={`slider_card_${so}_${project.id}_${idx}`}
                    data-flip-id={so === 0 ? `card-${project.id}` : undefined}
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
                        transform: `scale(1.22) translate3d(${initialPx.toFixed(1)}px, 0px, 0px)`,
                      }}
                    >
                      <img
                        src={project.thumbnail}
                        alt={project.title}
                        draggable={false}
                        loading="eager"
                        decoding="sync"
                        className="monochrome-base w-full h-full object-cover pointer-events-none"
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
                          loading="eager"
                          decoding="sync"
                          className="color-img w-full h-full object-cover pointer-events-none"
                        />
                      </div>
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

      {/* 4. BOTTOM FIXED TECHNICAL HUD BAR */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 px-6 py-4 flex flex-col pointer-events-none">
        <div className="flex items-center justify-center text-zinc-500 font-mono text-[9px] tracking-[0.3em] uppercase pointer-events-auto">
          {/* Bottom Center: Gesture Instructions */}
          <div className="hidden md:flex items-center gap-2">
            <span>GESTURES : [FREE DRAG & WHEEL SCROLL]</span>
          </div>
        </div>

        {/* Film Camera Ruler Tick Marks along bottom */}
        <div className="w-full pt-2 flex items-center justify-between opacity-30 select-none overflow-hidden font-mono text-[8px] text-zinc-500">
          <span>| . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . | . . . . |</span>
        </div>
      </footer>

      {/* 5. CINEMA VIDEO / CASE STUDY MODAL */}
      {activeModalProject && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 select-auto transition-opacity duration-200 ${isModalClosing ? 'opacity-0' : 'opacity-100'
            }`}
          style={{
            backgroundColor: 'rgba(2, 5, 18, 0.95)',
            backdropFilter: 'blur(16px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className={`relative w-full max-w-5xl rounded-2xl overflow-hidden border border-cyan-500/40 bg-[#061026] shadow-[0_0_80px_rgba(56,189,248,0.35)] flex flex-col transition-transform duration-200 ${isModalClosing ? 'scale-95' : 'scale-100'
              }`}
          >
            {/* Modal Top Bar */}
            <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-[#040a1c]">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono text-xs tracking-[0.25em] uppercase text-cyan-300 font-bold">
                  {activeModalProject.client} • {activeModalProject.year}
                </span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-cyan-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cinema Video Player (2.39:1 Anamorphic Scope) */}
            <div className="relative w-full aspect-[2.39/1] bg-black overflow-hidden flex items-center justify-center">
              <video
                src={activeModalProject.video_url}
                controls
                autoPlay
                className="w-full h-full object-cover"
                poster={activeModalProject.thumbnail}
              />
            </div>

            {/* Project Synopsis & Production Metadata */}
            <div className="p-6 md:p-8 flex flex-col gap-6 bg-[#040a1c]">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 font-bold">
                      {activeModalProject.tag}
                    </span>
                    <span className="text-zinc-500 text-xs font-mono">•</span>
                    <span className="font-mono text-xs text-zinc-400">
                      {activeModalProject.type === 'motion'
                        ? `RUN TIME: ${activeModalProject.duration}`
                        : `${activeModalProject.duration}`}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    {activeModalProject.title}
                  </h2>
                  <p className="text-cyan-400 font-mono text-xs tracking-wider mt-1">
                    ROLE: {activeModalProject.role}
                  </p>
                </div>

                {/* Direct WhatsApp Action */}
                <a
                  href={`https://wa.me/62895395277103?text=${encodeURIComponent(
                    `Halo Refo, saya baru saja melihat proyek "${activeModalProject.title}" di portofolio Anda dan ingin berdiskusi mengenai proyek serupa.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-mono text-xs tracking-widest uppercase font-bold shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all transform hover:-translate-y-0.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>INQUIRE VIA WHATSAPP</span>
                </a>
              </div>

              <p className="text-zinc-300 text-sm md:text-base leading-relaxed">
                {activeModalProject.description}
              </p>

              {/* Technical Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-zinc-800/80 font-mono text-xs">
                {activeModalProject.aspectRatio && (
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <span className="text-zinc-500 text-[10px] tracking-widest uppercase block">Framing</span>
                    <span className="text-zinc-200 font-bold mt-0.5 block">{activeModalProject.aspectRatio}</span>
                  </div>
                )}
                {activeModalProject.colorScience && (
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <span className="text-zinc-500 text-[10px] tracking-widest uppercase block">Color Science</span>
                    <span className="text-cyan-300 font-bold mt-0.5 block">{activeModalProject.colorScience}</span>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] tracking-widest uppercase block">Client</span>
                  <span className="text-zinc-200 font-bold mt-0.5 block">{activeModalProject.client}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] tracking-widest uppercase block">Production Year</span>
                  <span className="text-zinc-200 font-bold mt-0.5 block">{activeModalProject.year}</span>
                </div>
              </div>

              {/* Project Tags */}
              <div className="flex flex-wrap gap-2 pt-2">
                {activeModalProject.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full text-[11px] font-mono tracking-wider bg-zinc-900/80 border border-zinc-800 text-zinc-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CINEMATIC ZOOM-OUT EXIT PORTAL OVERLAY (REVERSE CAMERA PULL-BACK) */}
      {isZoomingOut && (
        <div
          className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center select-none overflow-hidden"
          style={{
            backgroundColor: 'rgba(3, 8, 26, 0.92)',
            animation: 'zoomOutBgFade 0.88s cubic-bezier(0.65, 0, 0.15, 1) forwards',
          }}
        >
          {/* Contracting Reverse Aperture Ring */}
          <div
            className="rounded-full border-2 border-cyan-400 pointer-events-none"
            style={{
              width: '180px',
              height: '180px',
              boxShadow: '0 0 100px rgba(56,189,248,0.9), inset 0 0 70px rgba(56,189,248,0.6)',
              animation: 'zoomOutRingContract 0.88s cubic-bezier(0.65, 0, 0.15, 1) forwards',
            }}
          />

          {/* Heading badge */}
          <div className="absolute z-20 font-mono text-xs tracking-[0.45em] uppercase text-cyan-300 font-bold drop-shadow-[0_0_12px_rgba(56,189,248,0.9)] animate-pulse">
            RETURNING TO WORK...
          </div>
        </div>
      )}
    </div>
  );
}
