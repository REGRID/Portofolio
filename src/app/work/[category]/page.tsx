'use client';

import React, { useState, use, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Play,
  X,
  ArrowLeft,
  MessageCircle,
  Film,
  Volume2,
  VolumeX,
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

if (typeof window !== 'undefined') {
  gsap.registerPlugin(Flip);
}

// Infinite Canvas Repeating Unit Dimensions (Borderless Seamless Mosaic)
const GRID_COLS = 6;
const GRID_ROWS = 3;
const TILE_WIDTH = 320;
const TILE_HEIGHT = 440;
const TILE_GAP = 0; // Seamless borderless mosaic (all footage touches edge-to-edge)
const STEP_X = TILE_WIDTH + TILE_GAP; // 320px
const STEP_Y = TILE_HEIGHT + TILE_GAP; // 440px
const BLOCK_WIDTH = GRID_COLS * STEP_X; // 1920px
const BLOCK_HEIGHT = GRID_ROWS * STEP_Y; // 1320px

const SLIDER_CARD_WIDTH = 420;
const SLIDER_CARD_GAP = 0; // Seamless continuous filmstrip
const SLIDER_STRIDE = SLIDER_CARD_WIDTH + SLIDER_CARD_GAP; // 420px

const BLOCK_X_OFFSETS = [-1, 0, 1];
const BLOCK_Y_OFFSETS = [-1, 0, 1];
const SLIDER_OFFSETS = [-1, 0, 1];

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

  // Grid 2D mode: center on nearest card (STEP_X, STEP_Y)
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
}: {
  params: Promise<{ category: string }>;
}) {
  const resolvedParams = use(params);
  const categoryKey = resolvedParams.category?.toLowerCase();
  const category = CATEGORY_DATA[categoryKey];

  if (!category) {
    notFound();
  }

  // View mode: 'grid' (2D canvas), 'slider' (horizontal filmstrip), 'list' (editorial directory)
  const [viewMode, setViewMode] = useState<'grid' | 'slider' | 'list'>('grid');

  // Filter mode: 'all' | 'stills' | 'motion'
  const [activeFilter, setActiveFilter] = useState<'all' | 'stills' | 'motion'>('all');

  // Interactive HUD toggles
  const [isFisheye, setIsFisheye] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(false);

  // Active Project Video Modal
  const [activeModalProject, setActiveModalProject] = useState<CategoryProject | null>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);

  // Hovered item for List View Preview
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);

  // DOM Refs for 60-120 FPS Hardware-Accelerated Animation (ZERO React re-renders during drag/scroll)
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorLabelRef = useRef<HTMLSpanElement>(null);
  const listPreviewRef = useRef<HTMLDivElement>(null);
  const activeCenterCardIdRef = useRef<string | null>(null);
  const wheelSnapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cached parallax tiles & color overlay elements for zero-lookup 60-120 FPS proximity fade
  const cachedTilesRef = useRef<
    Array<{
      wrapperEl: HTMLElement;
      colorOverlayEl: HTMLElement;
      localX: number;
      localY: number;
      width: number;
      height: number;
      dist?: number;
      visible?: boolean;
    }>
  >([]);

  // Physics & Pan Coordinates (Direct mutable refs)
  const targetPanRef = useRef({ x: -220, y: -120 });
  const currentPanRef = useRef({ x: -220, y: -120 });
  const isDraggingRef = useRef(false);
  const dragIntentActiveRef = useRef(false);
  const dragStartTimeRef = useRef(0);
  const strokeAccumulatorRef = useRef(0);
  const pointerStartRef = useRef({ x: 0, y: 0, panX: -220, panY: -120 });
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const dragDistanceRef = useRef(0);

  // Filtered project list
  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return category.projects;
    return category.projects.filter((p) => p.type === activeFilter);
  }, [category.projects, activeFilter]);

  // Ensure display array has exactly 18 items to fill the 6x3 grid completely without gaps
  const displayProjects = useMemo(() => {
    if (filteredProjects.length === 0) return category.projects;
    const items: CategoryProject[] = [];
    while (items.length < 18) {
      for (const p of filteredProjects) {
        items.push(p);
        if (items.length >= 18) break;
      }
    }
    return items;
  }, [filteredProjects, category.projects]);

  const sliderBlockWidth = displayProjects.length * SLIDER_STRIDE;

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
      wrapperEl: HTMLElement;
      colorOverlayEl: HTMLElement;
      localX: number;
      localY: number;
      width: number;
      height: number;
    }> = [];

    if (viewMode === 'grid') {
      BLOCK_Y_OFFSETS.forEach((by) => {
        BLOCK_X_OFFSETS.forEach((bx) => {
          displayProjects.forEach((_, idx) => {
            const id = `grid_card_${bx}_${by}_${idx}`;
            const el = document.getElementById(id);
            const wrapper = el?.querySelector<HTMLElement>('.parallax-wrapper');
            const colorOverlay = el?.querySelector<HTMLElement>('.color-overlay');
            if (el && wrapper && colorOverlay) {
              const col = idx % GRID_COLS;
              const row = Math.floor(idx / GRID_COLS);
              tiles.push({
                wrapperEl: wrapper,
                colorOverlayEl: colorOverlay,
                localX: bx * BLOCK_WIDTH + col * STEP_X,
                localY: by * BLOCK_HEIGHT + row * STEP_Y,
                width: TILE_WIDTH,
                height: TILE_HEIGHT,
              });
            }
          });
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
              wrapperEl: wrapper,
              colorOverlayEl: colorOverlay,
              localX: so * sliderBlockWidth + idx * SLIDER_STRIDE,
              localY: 0,
              width: SLIDER_CARD_WIDTH,
              height: 600,
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

  // Ensure the center of the screen ALWAYS contains a card (on load & on window resize)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scX = window.innerWidth / 2;
    const scY = window.innerHeight / 2;

    // Center focal hero card (col 2, row 1) right in the middle of the viewport
    const initX = scX - TILE_WIDTH / 2 - 2 * STEP_X;
    const initY = scY - TILE_HEIGHT / 2 - 1 * STEP_Y;

    targetPanRef.current = { x: initX, y: initY };
    currentPanRef.current = { x: initX, y: initY };

    const handleResize = () => {
      const snap = getSnapCoordinates(
        targetPanRef.current.x,
        targetPanRef.current.y,
        viewMode
      );
      targetPanRef.current = snap;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  // High-performance 60-120 FPS hardware-accelerated RAF Lerp loop
  useEffect(() => {
    let rafId: number;

    const tick = () => {
      // S-Curve Velocity Chase & Deceleration Engine:
      // - While dragging: elastic lag chase scaling smoothly with distance and kinetic velocity
      // - At rest / start: gentle baseline ease (~0.12)
      // - Surging in motion: dynamic velocity boost accelerates the chase smoothly up to ~0.24
      // - Reaching destination / slowing down: natural exponential decay deceleration curve ("lalu melambat lagi")
      // - When released: silky friction deceleration and smooth snap to nearest card (chaseEase ~0.075)
      let chaseEase = 0.075;

      if (isDraggingRef.current) {
        if (!dragIntentActiveRef.current) {
          chaseEase = 0.04;
        } else {
          const dx = targetPanRef.current.x - currentPanRef.current.x;
          const dy = targetPanRef.current.y - currentPanRef.current.y;
          const distToTarget = Math.hypot(dx, dy);
          const pointerSpeed = Math.hypot(
            velocityRef.current.vx,
            velocityRef.current.vy
          );

          // S-curve ease response: accelerates when distance/speed builds, eases out when closing in
          const distBoost = Math.min(0.08, (distToTarget / 500) * 0.08);
          const speedBoost = Math.min(0.06, pointerSpeed * 0.04);
          chaseEase = 0.12 + distBoost + speedBoost;
        }
      } else {
        // Friction decay on velocity when released
        velocityRef.current.vx *= 0.93;
        velocityRef.current.vy *= 0.93;
      }

      currentPanRef.current.x +=
        (targetPanRef.current.x - currentPanRef.current.x) * chaseEase;
      currentPanRef.current.y +=
        (targetPanRef.current.y - currentPanRef.current.y) * chaseEase;

      // Lock subpixel precision when settled to eliminate micro-jitter
      if (!isDraggingRef.current) {
        if (Math.abs(targetPanRef.current.x - currentPanRef.current.x) < 0.04) {
          currentPanRef.current.x = targetPanRef.current.x;
        }
        if (Math.abs(targetPanRef.current.y - currentPanRef.current.y) < 0.04) {
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
        const lagX = Math.max(-16, Math.min(16, -velocityRef.current.vx * 16));
        const lagY = Math.max(-16, Math.min(16, -velocityRef.current.vy * 16));

        // Proximity configuration:
        // r0: Full 100% color zone when a card is centered (dist <= 60px)
        // r1: Outer boundary where color reaches 0% (dist >= 480px)
        const r0 = 60;
        const r1 = 480;
        const rDiff = r1 - r0;

        // First pass: calculate parallax, screen distances, and track closest card
        let minDist = 9999;
        let closestIdx = -1;

        for (let i = 0; i < tileCount; i++) {
          const tile = tiles[i];
          const screenX = tile.localX + wx;
          const screenY = tile.localY + wy;

          // Frustum culling: calculate parallax & color only for visible cards
          if (
            screenX > -tile.width &&
            screenX < window.innerWidth + tile.width &&
            screenY > -tile.height &&
            screenY < window.innerHeight + tile.height
          ) {
            const cardCenterX = screenX + tile.width / 2;
            const cardCenterY = screenY + tile.height / 2;

            const normX = (cardCenterX - scX) / scX;
            const normY = (cardCenterY - scY) / scY;

            // Optical parallax displacement + dynamic velocity momentum
            const px = -normX * 28 + lagX;
            const py = -normY * 32 + lagY;

            tile.wrapperEl.style.transform = `scale(1.22) translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;

            // Distance from card center to viewport center:
            const dist =
              viewMode === 'slider'
                ? Math.abs(cardCenterX - scX)
                : Math.hypot(cardCenterX - scX, cardCenterY - scY);

            tile.dist = dist;
            tile.visible = true;

            if (dist < minDist) {
              minDist = dist;
              closestIdx = i;
            }
          } else {
            tile.visible = false;
            tile.colorOverlayEl.style.opacity = '0';
          }
        }

        // Allowance for other (non-closest) cards:
        // When 1 card is centered (minDist <= 50px): otherCardAllowance = 0.0 -> ONLY 1 card is colored!
        // When panning towards 4-grid intersection (minDist increases to 272px):
        // otherCardAllowance opens up to 1.0 so all 4 cards show their soft color!
        const tAllowance = Math.max(0, Math.min(1, (minDist - 50) / 140));
        const otherCardAllowance = tAllowance * tAllowance * (3 - 2 * tAllowance);

        // Second pass: apply proximity color with center isolation
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

          // If closest card: full baseFactor (100% when centered)
          // If other card: scaled by otherCardAllowance (0% when 1 card is centered)
          const finalFactor = i === closestIdx ? baseFactor : baseFactor * otherCardAllowance;
          tile.colorOverlayEl.style.opacity = finalFactor.toFixed(3);
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

  // Poin 4 Panduan RemyShoots: View switcher dengan GSAP Flip layout morphing & snap
  const switchViewMode = useCallback((newMode: 'grid' | 'slider' | 'list') => {
    if (newMode === viewMode) return;

    if (newMode === 'grid' || newMode === 'slider') {
      const snap = getSnapCoordinates(
        currentPanRef.current.x,
        currentPanRef.current.y,
        newMode
      );
      targetPanRef.current = snap;
      currentPanRef.current = snap;
    }

    // Capture previous layout state of gallery cards
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
  }, [viewMode]);

  // Native Hardware-Accelerated Free Drag & Wheel Engine (Bypasses React SyntheticEvents)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      dragIntentActiveRef.current = false;
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
      if (cursorLabelRef.current) cursorLabelRef.current.textContent = 'DRAG';
    };

    const onPointerMove = (e: PointerEvent) => {
      // Direct GPU cursor translation - zero React overhead
      if (cursorRef.current) {
        cursorRef.current.style.display = 'flex';
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      if (listPreviewRef.current) {
        listPreviewRef.current.style.transform = `translate3d(${e.clientX + 24}px, ${e.clientY - 140}px, 0)`;
      }

      if (!isDraggingRef.current) return;

      const now = performance.now();
      const dt = Math.max(1, now - lastPointerRef.current.time);
      const stepDx = e.clientX - lastPointerRef.current.x;
      const stepDy = e.clientY - lastPointerRef.current.y;

      // Smoothed velocity vector using exponential moving average (curva velocity)
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

      // Intent detection: ignore initial tiny accidental micro-clicks (< 5px)
      // "jangan langsung bereaksi pada mouse yang men drag. berikan jeda beberapa ms untuk mendeteksi pergerakan nya mengarah kemana"
      const timeSinceStart = now - dragStartTimeRef.current;
      if (!dragIntentActiveRef.current) {
        if (distFromStart >= 5 || timeSinceStart >= 35) {
          dragIntentActiveRef.current = true;
          // Synchronize lastPointer so the first movement step is 0 (zero jump!)
          lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };
          if (cursorLabelRef.current) cursorLabelRef.current.textContent = 'CHASING';
        } else {
          lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };
          return;
        }
      }

      // Continuous kinetic stroke integration:
      const stepDist = Math.hypot(stepDx, stepDy);
      strokeAccumulatorRef.current =
        strokeAccumulatorRef.current * 0.94 + stepDist;

      // S-Curve Non-Linear Velocity Gain:
      // - Starts slow (gain ~0.70) when drag begins or moving small ("berawalan lambat")
      // - Smoothly accelerates up to ~1.85 - 2.2x as distance accumulates ("semakin cepat, bergerak lebih kencang atau lebih jauh")
      // - When dragging far, the canvas accelerates beyond mouse speed, then glides smoothly
      const strokeProgress = Math.min(
        1,
        Math.max(0, (strokeAccumulatorRef.current - 20) / 140)
      );
      const sCurve = strokeProgress * strokeProgress * (3 - 2 * strokeProgress);
      const pointerSpeed = Math.hypot(
        velocityRef.current.vx,
        velocityRef.current.vy
      );
      const speedBonus = Math.min(0.65, pointerSpeed * 0.4);
      const velocityGain = 0.70 + sCurve * (0.90 + speedBonus);

      // Continuous, seamless incremental delta scaled by velocity curve
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };

      targetPanRef.current.x += stepDx * velocityGain;
      if (viewMode === 'grid') {
        targetPanRef.current.y += stepDy * velocityGain;
      }
    };

    const onPointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const hadIntent = dragIntentActiveRef.current;
      dragIntentActiveRef.current = false;
      if (cursorLabelRef.current) cursorLabelRef.current.textContent = 'DRAG';

      if (!hadIntent || dragDistanceRef.current < 5) {
        // Micro movement / tap without intent: keep settled position
        return;
      }

      // Project release position with inertia velocity (curva velocity momentum)
      const flingX = velocityRef.current.vx * 240;
      const flingY = velocityRef.current.vy * 240;
      const projectedX = currentPanRef.current.x + flingX;
      const projectedY = currentPanRef.current.y + flingY;

      // Snap smoothly to the nearest card in the direction of the latest motion!
      const snap = getSnapCoordinates(projectedX, projectedY, viewMode);
      targetPanRef.current.x = snap.x;
      if (viewMode === 'grid') {
        targetPanRef.current.y = snap.y;
      }
    };

    const onPointerLeave = () => {
      if (cursorRef.current) cursorRef.current.style.display = 'none';
    };

    // 2D Wheel Scroll navigation directly updating targetPanRef with smooth glide & snap
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (viewMode === 'slider') {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        targetPanRef.current.x -= delta * 1.5;
      } else {
        targetPanRef.current.x -= e.deltaX * 1.3;
        targetPanRef.current.y -= e.deltaY * 1.3;
      }

      // Smooth snap to nearest card when wheel scrolling settles
      if (wheelSnapTimeoutRef.current) clearTimeout(wheelSnapTimeoutRef.current);
      wheelSnapTimeoutRef.current = setTimeout(() => {
        const snap = getSnapCoordinates(
          targetPanRef.current.x,
          targetPanRef.current.y,
          viewMode
        );
        targetPanRef.current.x = snap.x;
        if (viewMode === 'grid') {
          targetPanRef.current.y = snap.y;
        }
      }, 150);
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
  }, [viewMode]);

  // Handle Project Click:
  // - If clicked card is outside the center: smoothly pan/center to that card
  // - Zero popup: do not open video modal on 2D/Slider canvas, keep screen completely clean!
  const handleProjectClick = (
    e: React.MouseEvent<HTMLElement>,
    project: CategoryProject,
    cardId?: string
  ) => {
    if (dragDistanceRef.current > 10 || dragIntentActiveRef.current) {
      // Drag move, don't trigger click action
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
      }
    }
  };

  // Sound synth effect toggle
  const toggleSound = () => {
    setIsSoundOn((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden select-none bg-[#030712] text-zinc-100 font-sans cursor-grab active:cursor-grabbing"
      style={{
        touchAction: 'none',
      }}
    >
      {/* 1. TACTICAL HUD RETICLE CURSOR [ DRAG ] (GPU Direct Transform) */}
      {!activeModalProject && (
        <div
          ref={cursorRef}
          className="fixed pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-1 will-change-transform"
          style={{
            display: 'none',
            left: 0,
            top: 0,
          }}
        >
          <div className="relative px-3 py-1.5 flex items-center justify-center font-mono text-[10px] tracking-[0.25em] uppercase font-bold text-cyan-300 bg-[#020512]/85 border border-cyan-500/40 rounded shadow-[0_0_20px_rgba(6,182,212,0.35)] backdrop-blur-md">
            {/* Tactical Corner Brackets */}
            <span className="absolute -top-1 -left-1 text-[8px] text-cyan-400 font-mono">┌</span>
            <span className="absolute -top-1 -right-1 text-[8px] text-cyan-400 font-mono">┐</span>
            <span className="absolute -bottom-1 -left-1 text-[8px] text-cyan-400 font-mono">└</span>
            <span className="absolute -bottom-1 -right-1 text-[8px] text-cyan-400 font-mono">┘</span>

            <span ref={cursorLabelRef}>DRAG</span>
          </div>
        </div>
      )}

      {/* 2. TOP FIXED EDITORIAL HUD BAR (1:1 Remy Shoots style) */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-5 flex items-start justify-between pointer-events-none">
        {/* Top-Left: Monogram & Editorial Tagline */}
        <div className="pointer-events-auto flex items-start gap-4">
          <Link
            href="/#portfolio"
            className="font-mono text-sm tracking-widest font-black uppercase text-zinc-200 hover:text-cyan-400 transition-colors py-0.5"
          >
            RG<sup>®</sup>
          </Link>
          <div className="border-l border-zinc-700/60 pl-4">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase leading-relaxed text-zinc-400">
              DOCUMENTING EMOTION,
              <br />
              MOVEMENT AND MEANING.
            </p>
          </div>
        </div>

        {/* Top-Center: Interactive View Mode Switcher (SLIDER | GRID | LIST) */}
        <div className="pointer-events-auto flex flex-col items-center">
          <div className="flex items-center gap-6 font-mono text-[11px] tracking-[0.3em] uppercase bg-[#061026]/90 border border-zinc-800/80 px-6 py-2 rounded-full shadow-[0_4px_30px_rgba(0,0,0,0.6)] backdrop-blur-md">
            <button
              type="button"
              onClick={() => switchViewMode('slider')}
              className={`transition-colors relative py-0.5 ${viewMode === 'slider' ? 'text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              SLIDER
            </button>
            <span className="text-zinc-700">|</span>
            <button
              type="button"
              onClick={() => switchViewMode('grid')}
              className={`transition-colors relative py-0.5 ${viewMode === 'grid' ? 'text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              GRID
            </button>
            <span className="text-zinc-700">|</span>
            <button
              type="button"
              onClick={() => switchViewMode('list')}
              className={`transition-colors relative py-0.5 ${viewMode === 'list' ? 'text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              LIST
            </button>
          </div>

          {/* Indicator triangle red/cyan under active view */}
          <div className="h-2 flex items-center justify-center pt-0.5">
            <span
              className="text-[9px] text-cyan-400 transform transition-all duration-300"
              style={{
                transform:
                  viewMode === 'slider'
                    ? 'translateX(-62px)'
                    : viewMode === 'grid'
                      ? 'translateX(0px)'
                      : 'translateX(62px)',
              }}
            >
              ▲
            </span>
          </div>
        </div>

        {/* Top-Right: Filters & Back Button */}
        <nav className="pointer-events-auto flex items-center gap-6 font-mono text-[11px] tracking-[0.25em] uppercase">
          {/* Works / Stills / Motion Filter Switcher */}
          <div className="flex items-center gap-4 text-zinc-400 bg-[#061026]/80 px-4 py-1.5 rounded-full border border-zinc-800/80 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`transition-colors ${activeFilter === 'all' ? 'text-cyan-400 font-bold' : 'hover:text-zinc-200'
                }`}
            >
              WORKS({category.projects.length})
            </button>
            <span className="text-zinc-700">|</span>
            <button
              type="button"
              onClick={() => setActiveFilter('stills')}
              className={`transition-colors ${activeFilter === 'stills' ? 'text-cyan-400 font-bold' : 'hover:text-zinc-200'
                }`}
            >
              STILLS({stillsCount})
            </button>
            <span className="text-zinc-700">|</span>
            <button
              type="button"
              onClick={() => setActiveFilter('motion')}
              className={`transition-colors ${activeFilter === 'motion' ? 'text-cyan-400 font-bold' : 'hover:text-zinc-200'
                }`}
            >
              MOTION({motionCount})
            </button>
          </div>

          {/* Back to Portfolio Showcase */}
          <Link
            href="/#portfolio"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/60 text-zinc-300 hover:text-cyan-400 hover:border-cyan-400/60 transition-all shadow-md backdrop-blur-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK</span>
          </Link>
        </nav>
      </header>

      {/* 3. MAIN INTERACTIVE 2D CANVASES */}
      {/* MODE A: INFINITE 2D FREE-DRAG CANVAS GRID (Hardware-Accelerated Tapestry with Dynamic Proximity Color) */}
      {viewMode === 'grid' && (
        <div
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full will-change-transform ${isFisheye ? 'scale-105 perspective-[1000px]' : ''
            }`}
          style={{
            transform: 'translate3d(-220px, -120px, 0)',
          }}
        >
          {BLOCK_Y_OFFSETS.map((by) =>
            BLOCK_X_OFFSETS.map((bx) => (
              <div
                key={`grid_block_${bx}_${by}`}
                className="absolute grid grid-cols-6"
                style={{
                  left: `${bx * BLOCK_WIDTH}px`,
                  top: `${by * BLOCK_HEIGHT}px`,
                  width: `${BLOCK_WIDTH}px`,
                  height: `${BLOCK_HEIGHT}px`,
                }}
              >
                {displayProjects.map((project, idx) => (
                  <div
                    id={`grid_card_${bx}_${by}_${idx}`}
                    key={`grid_card_${bx}_${by}_${project.id}_${idx}`}
                    data-flip-id={bx === 0 && by === 0 ? `card-${project.id}` : undefined}
                    onClick={(e) =>
                      handleProjectClick(e, project, `grid_card_${bx}_${by}_${idx}`)
                    }
                    className="gallery-card-item cinema-card-tile relative w-[320px] h-[440px] overflow-hidden bg-black select-none"
                  >
                    <div className="parallax-wrapper w-full h-full relative will-change-transform">
                      <img
                        src={project.thumbnail}
                        alt={project.title}
                        draggable={false}
                        className="monochrome-base w-full h-full object-cover pointer-events-none"
                      />
                      <div className="color-overlay absolute inset-0 w-full h-full pointer-events-none opacity-0 will-change-opacity">
                        <img
                          src={project.thumbnail}
                          alt=""
                          draggable={false}
                          className="color-img w-full h-full object-cover pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* MODE B: INFINITE SLIDER VIEW (Horizontal Filmstrip Carousel with Dynamic Proximity Color) */}
      {viewMode === 'slider' && (
        <div
          ref={canvasRef}
          className="absolute inset-0 w-full h-full flex items-center will-change-transform"
          style={{
            transform: 'translate3d(-220px, 0, 0)',
          }}
        >
          {SLIDER_OFFSETS.map((so) => (
            <div
              key={`slider_block_${so}`}
              className="absolute flex items-center select-none"
              style={{
                left: `${so * sliderBlockWidth}px`,
                width: `${sliderBlockWidth}px`,
              }}
            >
              {displayProjects.map((project, idx) => (
                <div
                  id={`slider_card_${so}_${idx}`}
                  key={`slider_card_${so}_${project.id}_${idx}`}
                  data-flip-id={so === 0 ? `card-${project.id}` : undefined}
                  onClick={(e) =>
                    handleProjectClick(e, project, `slider_card_${so}_${idx}`)
                  }
                  className="gallery-card-item cinema-card-tile relative shrink-0 w-[420px] h-[65vh] overflow-hidden bg-black"
                >
                  <div className="parallax-wrapper w-full h-full relative will-change-transform">
                    <img
                      src={project.thumbnail}
                      alt={project.title}
                      draggable={false}
                      className="monochrome-base w-full h-full object-cover pointer-events-none"
                    />
                    <div className="color-overlay absolute inset-0 w-full h-full pointer-events-none opacity-0 will-change-opacity">
                      <img
                        src={project.thumbnail}
                        alt=""
                        draggable={false}
                        className="color-img w-full h-full object-cover pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
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

      {/* 4. BOTTOM FIXED TECHNICAL HUD BAR (1:1 Remy Shoots style) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 px-6 py-4 flex flex-col pointer-events-none">
        <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] tracking-[0.25em] uppercase pointer-events-auto">
          {/* Bottom Left: Fisheye Lens Toggle & Category Badge */}
          <div className="flex items-center gap-4 bg-[#061026]/80 px-4 py-1.5 rounded-full border border-zinc-800/80 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setIsFisheye((prev) => !prev)}
              className={`flex items-center gap-1.5 transition-colors ${isFisheye ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <span>FISHEYE : [{isFisheye ? 'ON' : 'OFF'}]</span>
            </button>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-500">{category.badge}</span>
          </div>

          {/* Bottom Center: Gesture Instructions */}
          <div className="hidden md:flex items-center gap-2 text-zinc-500 font-mono text-[9px] tracking-[0.3em]">
            <span>GESTURES : [FREE DRAG & WHEEL SCROLL]</span>
          </div>

          {/* Bottom Right: Sound Toggle & Contact WhatsApp */}
          <div className="flex items-center gap-4 bg-[#061026]/80 px-4 py-1.5 rounded-full border border-zinc-800/80 backdrop-blur-md">
            <button
              type="button"
              onClick={toggleSound}
              className={`flex items-center gap-1.5 transition-colors ${isSoundOn ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              {isSoundOn ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>SOUND : [{isSoundOn ? 'ON' : 'OFF'}]</span>
            </button>
            <span className="text-zinc-700">|</span>
            <a
              href="https://wa.me/62895395277103?text=Halo%20Refo,%20saya%20tertarik%20dengan%20karya%20Anda."
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-300 hover:text-cyan-400 transition-colors"
            >
              CONTACT
            </a>
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
    </div>
  );
}
