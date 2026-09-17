'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Lenis from 'lenis';
import Snap from 'lenis/snap';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CATEGORY_DATA } from '@/data/categoryData';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}
import {
  Play,
  X,
  ArrowRight,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  FileText,
  Clock,
  Film,
  MessageCircle,
  Award,
  Check,
  Mail,
  MapPin,
  Sparkles,
  Layers,
  Camera,
  Monitor
} from 'lucide-react';

interface Project {
  id: number;
  title: string;
  slug: string;
  client: string;
  category: string;
  video_url: string;
  thumbnail_url: string;
  duration: string;
  year: string;
  description: string;
  tags: string[];
  featured: boolean;
}

export default function PortfolioPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Project | null>(null);
  const [isVideoClosing, setIsVideoClosing] = useState(false);
  const [isCvOpen, setIsCvOpen] = useState(false);
  const [isCvClosing, setIsCvClosing] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cinema Zoom-In Portal Transition State (3-Stage Steady Frame Expansion)
  const [zoomingPortal, setZoomingPortal] = useState<{
    slug: string;
    title: string;
    image: string;
    x: number;
    y: number;
    width: number;
    height: number;
    stage: 'init' | 'centered' | 'expanding';
  } | null>(null);

  const handleCardCategoryClick = useCallback((card: {
    id: number;
    slug: string;
    title: string;
    image: string;
  }, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const resolvedImage = CATEGORY_DATA[card.slug]?.projects[0]?.thumbnail || card.image;

    // Stage 1 (init): Lock exact click position
    setZoomingPortal({
      slug: card.slug,
      title: card.title,
      image: resolvedImage,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      stage: 'init',
    });

    // Animate smoothly to screen center
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setZoomingPortal((prev) => (prev ? { ...prev, stage: 'centered' } : null));
      });
    });

    // Stage 2: Steady pause moment at center, then Stage 3: Card frame expands outward
    const expandTimer = setTimeout(() => {
      setZoomingPortal((prev) => (prev ? { ...prev, stage: 'expanding' } : null));
    }, 750);

    // Navigate to category showcase page as the frame reaches full screen
    const navTimer = setTimeout(() => {
      router.push(`/work/${card.slug}`);
    }, 1450);

    // Clean up
    const cleanupTimer = setTimeout(() => {
      setZoomingPortal(null);
    }, 2400);

    return () => {
      clearTimeout(expandTimer);
      clearTimeout(navTimer);
      clearTimeout(cleanupTimer);
    };
  }, [router]);

  // Transitions.dev Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'info' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const triggerToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3800);
  }, []);

  // Transitions.dev Asymmetric Modal Close Handlers (open: 250ms, close: 150ms)
  const closeCvModal = useCallback(() => {
    setIsCvClosing(true);
    setTimeout(() => {
      setIsCvOpen(false);
      setIsCvClosing(false);
    }, 150);
  }, []);

  const closeVideoModal = useCallback(() => {
    setIsVideoClosing(true);
    setTimeout(() => {
      setSelectedVideo(null);
      setIsVideoClosing(false);
    }, 150);
  }, []);

  // Transitions.dev 3D Card Hover Tilt with Pointer-Tracked Glare (19-card-tilt.md)
  const handleTiltMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = Math.min(100, Math.max(0, (x / rect.width) * 100));
    const py = Math.min(100, Math.max(0, (y / rect.height) * 100));
    const rx = ((y - rect.height / 2) / (rect.height / 2)) * -8.5;
    const ry = ((x - rect.width / 2) / (rect.width / 2)) * 8.5;

    el.style.setProperty('--tilt-rx', `${rx.toFixed(2)}deg`);
    el.style.setProperty('--tilt-ry', `${ry.toFixed(2)}deg`);
    el.style.setProperty('--tilt-gx', `${px.toFixed(1)}%`);
    el.style.setProperty('--tilt-gy', `${py.toFixed(1)}%`);
    el.classList.add('is-tilting', 'is-hover');
  }, []);

  const handleTiltLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.style.setProperty('--tilt-rx', '0deg');
    el.style.setProperty('--tilt-ry', '0deg');
    el.classList.remove('is-tilting', 'is-hover');
  }, []);

  // Recruiter Contact Form State
  const [recruiterForm, setRecruiterForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    role_offered: 'Lead Video Editor (Full-Time)',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [isFormShaking, setIsFormShaking] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  const DEFAULT_PORTFOLIO_WORKS: Project[] = [
    {
      id: 1,
      title: 'Commercial & Brand Film',
      slug: 'commercial-brand-film',
      client: 'Commercial & TVC Productions',
      category: 'Commercial',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail_url: '/reference_assets/card_studio74_art.jpg',
      duration: '01:15',
      year: '2024',
      description: 'High-impact commercial video editing and cinematography featuring dynamic speed ramps, rhythmic sound design, and color grading calibrated for luxury and automotive brand aesthetics.',
      tags: ['Commercial', 'Brand Campaign', 'DaVinci Resolve', 'Premiere Pro', 'Sound Design'],
      featured: true,
    },
    {
      id: 2,
      title: 'Narrative & Documentary Story',
      slug: 'narrative-documentary-story',
      client: 'Independent Film & Documentary',
      category: 'Narrative',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      thumbnail_url: '/reference_assets/card_gloster_art.jpg',
      duration: '04:45',
      year: '2024',
      description: 'Deep emotional narrative pacing, patient cut sequencing, and nuanced dialogue balancing. Crafted to immerse viewers into authentic real-life stories.',
      tags: ['Short Film', 'Documentary', 'Cinematography', 'Color Science', 'Storytelling'],
      featured: false,
    },
    {
      id: 3,
      title: 'Cinematic Music Video',
      slug: 'cinematic-music-video',
      client: 'Artist & Music Label Production',
      category: 'Music Video',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail_url: '/reference_assets/card_linea_fluid.png',
      duration: '03:20',
      year: '2024',
      description: 'Frame-accurate rhythm cutting with custom motion transitions, film grain textures, and stylized anamorphic aspect ratio emulation.',
      tags: ['Music Video', 'Rhythm Cut', 'Stylized Grade', 'After Effects', 'Sound Sync'],
      featured: false,
    },
    {
      id: 4,
      title: 'Cinematography Reel & Event Highlights',
      slug: 'cinematography-reel-events',
      client: 'Annual Showreel & Festival Aftermovie',
      category: 'Event & Reel',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      thumbnail_url: '/reference_assets/card_cube_art.jpg',
      duration: '02:10',
      year: '2024',
      description: 'Comprehensive showreel demonstrating cinematic camera movement, gimbal stabilization, lighting mastery, and high-tempo editorial sequencing.',
      tags: ['Showreel', 'Event Aftermovie', '4K Cinema', 'Gimbal Rig', 'Festival Highlight'],
      featured: false,
    },
  ];

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          setProjects(data.data);
        } else {
          setProjects(DEFAULT_PORTFOLIO_WORKS);
        }
      } catch (err) {
        console.error('Gagal memuat proyek:', err);
        setProjects(DEFAULT_PORTFOLIO_WORKS);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  const handleRecruiterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormFeedback(null);

    try {
      const payload = {
        name: `${recruiterForm.name} — ${recruiterForm.company}`,
        email: recruiterForm.email,
        phone: recruiterForm.phone,
        project_type: recruiterForm.role_offered,
        estimated_date: 'Full-Time / In-House Readiness',
        budget_range: 'Tawaran Rekrutmen Kerja',
        message: recruiterForm.message,
      };

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setFormFeedback({
          success: true,
          message: 'Terima kasih. Pesan dan penawaran kerja Anda telah diterima. Refo akan segera merespons via WhatsApp atau Email!',
        });
        setRecruiterForm({
          name: '',
          company: '',
          email: '',
          phone: '',
          role_offered: 'Lead Video Editor (Full-Time)',
          message: '',
        });
      } else {
        setFormFeedback({
          success: false,
          message: data.error || 'Terjadi kendala saat mengirimkan pesan.',
        });
      }
    } catch {
      setFormFeedback({
        success: false,
        message: 'Koneksi bermasalah. Anda juga dapat langsung menyapa Refo via WhatsApp.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const featuredProject = projects.find((p) => p.featured) || projects[0];
  const [heroTitle, setHeroTitle] = useState("SIMON SPARKS");

  // 4 Guideline Points (Circle 1: About, Circle 2: Work, Circle 3: Shop, Circle 4: Contact)
  const guidelinePages = [
    { id: 'about', label: '01', title: 'About' },
    { id: 'portfolio', label: '02', title: 'Work' },
    { id: 'shop', label: '03', title: 'Shop' },
    { id: 'contact', label: '04', title: 'Contact' },
  ];
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);

  const activePageIndexRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    activePageIndexRef.current = activePageIndex;
  }, [activePageIndex]);

  // Master Discrete GSAP Section Transition (1x scroll = glide directly to next/prev section with Fade + Slide)
  const goToSection = useCallback((targetIndex: number) => {
    const currentIndex = activePageIndexRef.current;
    if (targetIndex === currentIndex || targetIndex < 0 || targetIndex >= guidelinePages.length) return;
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    const direction = targetIndex > currentIndex ? 'next' : 'prev';

    const currentId = guidelinePages[currentIndex].id;
    const targetId = guidelinePages[targetIndex].id;

    const currentEl = document.getElementById(currentId);
    const targetEl = document.getElementById(targetId);

    // Update active page index state immediately for UI indicators (Header & Dots)
    activePageIndexRef.current = targetIndex;
    setActivePageIndex(targetIndex);

    if (currentEl && targetEl) {
      const outY = direction === 'next' ? -80 : 80;
      const inStartY = direction === 'next' ? 90 : -90;

      // Make target element visible and active immediately
      gsap.set(targetEl, { visibility: 'visible', pointerEvents: 'auto' });
      gsap.set(currentEl, { pointerEvents: 'none' });

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(currentEl, { visibility: 'hidden', opacity: 0, y: 0 });
          gsap.set(targetEl, { y: 0, opacity: 1 });
          if (targetIndex === 0) {
            gsap.set(['.hero-ring', '.hero-title', '.hero-illustration', '.hero-subtitle', '.hero-marker', '.hero-anim-item'], {
              opacity: 1,
              y: 0,
              x: 0,
              scale: 1,
              clearProps: 'transform,opacity',
            });
          }
          if (targetIndex === 1) gsap.set('.bento-anim-card', { opacity: 1, y: 0, clearProps: 'transform' });
          setTimeout(() => {
            isTransitioningRef.current = false;
          }, 190); // 190ms debounce buffer to absorb trackpad inertia
        },
      });

      // 1. Outgoing Section: FADE OUT + SLIDE
      tl.to(currentEl, {
        opacity: 0,
        y: outY,
        duration: 0.84,
        ease: 'power3.out',
      }, 0);

      // 2. Incoming Section: FADE IN + SLIDE from opposite direction
      tl.fromTo(targetEl,
        { opacity: 0, y: inStartY },
        { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' },
        0.05
      );

      // 3. Specialized per-object staggered choreography for Hero (Section 0)
      if (currentIndex === 0) {
        // Staggered Exit: Illustration leaves first -> Marker -> Title -> Ring (heavy) -> Subtitle
        tl.to('.hero-illustration', { y: outY * 0.90, opacity: 0, duration: 0.60, ease: 'power3.inOut' }, 0);
        tl.to('.hero-marker', { y: outY * 0.50, opacity: 0, duration: 0.58, ease: 'power3.inOut' }, 0.03);
        tl.to('.hero-title', { y: outY * 0.85, opacity: 0, duration: 0.70, ease: 'power3.inOut' }, 0.06);
        tl.to('.hero-ring', { y: outY * 0.95, opacity: 0, scale: 0.94, duration: 0.78, ease: 'power3.inOut' }, 0.10);
        tl.to('.hero-subtitle', { y: outY * 0.65, opacity: 0, duration: 0.64, ease: 'power3.inOut' }, 0.14);
      }
      if (targetIndex === 0) {
        // Staggered Entrance: 3D Ring anchors first -> Headline -> Illustration -> Subtitle -> Marker
        tl.fromTo('.hero-ring',
          { y: inStartY * 0.90, opacity: 0, scale: 0.93 },
          { y: 0, opacity: 1, scale: 1, duration: 0.92, ease: 'power3.out' },
          0.04
        );
        tl.fromTo('.hero-title',
          { y: inStartY * 0.80, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.86, ease: 'power3.out' },
          0.10
        );
        tl.fromTo('.hero-illustration',
          { y: inStartY * 0.65, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.80, ease: 'power3.out' },
          0.16
        );
        tl.fromTo('.hero-subtitle',
          { y: inStartY * 0.70, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.82, ease: 'power3.out' },
          0.22
        );
        tl.fromTo('.hero-marker',
          { y: inStartY * 0.40, x: -18, opacity: 0 },
          { y: 0, x: 0, opacity: 1, duration: 0.78, ease: 'power3.out' },
          0.26
        );
      }
      if (currentIndex === 1) {
        tl.to('.bento-anim-card', {
          y: outY * 0.75,
          opacity: 0,
          duration: 0.74,
          stagger: 0.03,
          ease: 'power3.out',
        }, 0);
      }
      if (targetIndex === 1) {
        tl.fromTo('.bento-anim-card',
          { y: inStartY * 0.7, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.88, stagger: 0.04, ease: 'power3.out' },
          0.06
        );
      }
    } else {
      isTransitioningRef.current = false;
    }
  }, [guidelinePages]);

  const handlePageClick = useCallback((index: number) => {
    goToSection(index);
  }, [goToSection]);

  // Seamless Wheel Controller: Strictly 1x scroll = 1 section jump (Zero Free Scroll)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (selectedVideo || isCvOpen) return;

      // 100% STOP ALL BROWSER FREE SCROLLING
      e.preventDefault();

      if (isTransitioningRef.current) return;

      // Threshold to ignore micro-touch jitter
      if (Math.abs(e.deltaY) < 14) return;

      const current = activePageIndexRef.current;
      if (e.deltaY > 0) {
        if (current < guidelinePages.length - 1) {
          goToSection(current + 1);
        }
      } else if (e.deltaY < 0) {
        if (current > 0) {
          goToSection(current - 1);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [guidelinePages, goToSection, selectedVideo, isCvOpen]);

  // Touch Swipe Controller for Mobile Devices
  useEffect(() => {
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (selectedVideo || isCvOpen || isTransitioningRef.current) return;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchStartY - touchEndY;
      if (Math.abs(deltaY) < 35) return;

      const current = activePageIndexRef.current;
      if (deltaY > 0 && current < guidelinePages.length - 1) {
        goToSection(current + 1);
      } else if (deltaY < 0 && current > 0) {
        goToSection(current - 1);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [guidelinePages, goToSection, selectedVideo, isCvOpen]);

  // Keyboard navigation (Arrow keys / Page keys / Space / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedVideo || isCvOpen) {
        if (e.key === 'Escape') {
          setSelectedVideo(null);
          setIsCvOpen(false);
        }
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      const current = activePageIndexRef.current;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (current < guidelinePages.length - 1) goToSection(current + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        if (current > 0) goToSection(current - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guidelinePages, goToSection, selectedVideo, isCvOpen]);

  // Ultra-smooth GSAP modal entrance tween
  useEffect(() => {
    if (selectedVideo || isCvOpen) {
      requestAnimationFrame(() => {
        gsap.fromTo(
          '.modal-card-smooth',
          { scale: 0.94, y: 16, opacity: 0 },
          { scale: 1, y: 0, opacity: 1, duration: 0.38, ease: 'power3.out', overwrite: 'auto' }
        );
      });
    }
  }, [selectedVideo, isCvOpen]);

  const isTransitioning = false;
  const getStaggerClass = (_sectionIdx: number, _itemOrderNext: number, _itemOrderPrev: number) => '';

  // 1-Minute (60 seconds) Auto-Advance from About (Point 1) to Work (Point 2)
  useEffect(() => {
    if (activePageIndex === 0) {
      const timer = setTimeout(() => {
        handlePageClick(1);
      }, 60000); // 60,000ms = 1 minute
      return () => clearTimeout(timer);
    }
  }, [activePageIndex, handlePageClick]);

  // Activate Section 02 Work & smooth zoom-out landing animation when returning from /work/[category]
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkTargetSection = () => {
      // Force reset any lingering scroll offset to guarantee viewport-fixed element alignment
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;

      const hash = window.location.hash;
      const urlParams = new URLSearchParams(window.location.search);
      const section = urlParams.get('section');

      if (hash === '#portfolio' || section === 'work') {
        activePageIndexRef.current = 1;
        setActivePageIndex(1);
        const aboutEl = document.getElementById('about');
        const portfolioEl = document.getElementById('portfolio');

        if (aboutEl) {
          gsap.set(aboutEl, { visibility: 'hidden', opacity: 0, pointerEvents: 'none' });
        }
        if (portfolioEl) {
          gsap.set(portfolioEl, {
            visibility: 'visible',
            opacity: 1,
            y: 0,
            pointerEvents: 'auto',
          });

          // Cinematic zoom-out landing for the 4 Bento cards (camera pulls back into position)
          gsap.fromTo(
            '.bento-anim-card',
            { scale: 1.18, opacity: 0, filter: 'blur(6px)' },
            {
              scale: 1,
              opacity: 1,
              filter: 'blur(0px)',
              duration: 0.85,
              stagger: 0.05,
              ease: 'power2.out',
              clearProps: 'filter,transform',
            }
          );
        }
      }
    };

    checkTargetSection();
    window.addEventListener('hashchange', checkTargetSection);
    return () => window.removeEventListener('hashchange', checkTargetSection);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden simon-sparks-bg text-[#f1f5f9] font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Subtle Radial Lighting Overlay (Clean Studio Canvas) */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_35%,rgba(14,45,95,0.45)_0%,transparent_100%)]" />

      {/* 1. PERSISTENT MINIMALIST GLOBAL HEADER (1:1 with Simon Sparks) */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-5 sm:pt-6 pb-2 px-4 sm:px-8 md:px-12 pointer-events-auto select-none">
        <nav className="w-full max-w-4xl lg:max-w-5xl mx-auto flex items-center justify-between">
          {/* ABOUT (Point 1) */}
          <button
            onClick={() => handlePageClick(0)}
            className={`text-[11px] sm:text-[12px] md:text-[13px] font-sans font-bold tracking-[0.22em] uppercase transition-all duration-300 cursor-pointer ${
              activePageIndex === 0 ? "text-[#f3bd8b] drop-shadow-[0_0_8px_rgba(243,189,139,0.5)]" : "text-[#abc8e6] hover:text-white"
            }`}
          >
            ABOUT
          </button>

          {/* Dot 1 */}
          <span className="w-1.5 h-1.5 rounded-full bg-[#1c5285] select-none pointer-events-none" />

          {/* WORK (Point 2) */}
          <button
            onClick={() => handlePageClick(1)}
            className={`text-[11px] sm:text-[12px] md:text-[13px] font-sans font-bold tracking-[0.22em] uppercase transition-all duration-300 cursor-pointer ${
              activePageIndex === 1 ? "text-[#f3bd8b] drop-shadow-[0_0_8px_rgba(243,189,139,0.5)]" : "text-[#abc8e6] hover:text-white"
            }`}
          >
            WORK
          </button>

          {/* Dot 2 */}
          <span className="w-1.5 h-1.5 rounded-full bg-[#1c5285] select-none pointer-events-none" />

          {/* Center Simon Sparks S Monogram Logo */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handlePageClick(0);
            }}
            className="flex items-center justify-center group transition-transform duration-300 hover:scale-110 active:scale-95 cursor-pointer"
            aria-label="Simon Sparks"
          >
            <img
              src="/images/sparks-logo.png"
              alt="Simon Sparks Logo"
              className="w-7 sm:w-8 md:w-9 h-auto object-contain select-none pointer-events-none drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]"
            />
          </a>

          {/* Dot 3 */}
          <span className="w-1.5 h-1.5 rounded-full bg-[#1c5285] select-none pointer-events-none" />

          {/* SHOP (Point 3) */}
          <button
            onClick={() => handlePageClick(2)}
            className={`text-[11px] sm:text-[12px] md:text-[13px] font-sans font-bold tracking-[0.22em] uppercase transition-all duration-300 cursor-pointer ${
              activePageIndex === 2 ? "text-[#f3bd8b] drop-shadow-[0_0_8px_rgba(243,189,139,0.5)]" : "text-[#abc8e6] hover:text-white"
            }`}
          >
            SHOP
          </button>

          {/* Dot 4 */}
          <span className="w-1.5 h-1.5 rounded-full bg-[#1c5285] select-none pointer-events-none" />

          {/* CONTACTS (Point 4) */}
          <button
            onClick={() => handlePageClick(3)}
            className={`text-[11px] sm:text-[12px] md:text-[13px] font-sans font-bold tracking-[0.22em] uppercase transition-all duration-300 cursor-pointer ${
              activePageIndex === 3 ? "text-[#f3bd8b] drop-shadow-[0_0_8px_rgba(243,189,139,0.5)]" : "text-[#abc8e6] hover:text-white"
            }`}
          >
            CONTACTS
          </button>
        </nav>
      </header>

      {/* Persistent Right Coordinate & Slide Indicator Widget (Direct Child of Root Viewport Container) */}
      <div className="fixed right-6 sm:right-12 lg:right-20 top-1/2 -translate-y-1/2 hidden md:flex items-start gap-7 sm:gap-9 select-none z-40">
        {/* Hairline guide with sliding arrow pointer that points right directly into the active circle center */}
        <div className="relative flex flex-col justify-between h-[168px] w-28 text-[11px] font-sans tracking-widest text-slate-400 pointer-events-none select-none">
          {/* Dynamic arrow and label tracker */}
          <div
            className="absolute left-0 w-full flex items-center justify-between transition-all duration-500 ease-out"
            style={{
              top: `${activePageIndex * 48 + 14}px`,
              transform: 'translateY(-50%)',
            }}
          >
            <span className="text-[11px] tracking-[0.2em] font-sans font-bold text-white uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              {guidelinePages[activePageIndex].title}
            </span>
            <div className="flex-1 mx-2.5 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-cyan-400/80" />
            <span className="text-[12px] text-cyan-400 font-bold drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]">
              ▸
            </span>
          </div>
        </div>

        {/* The 4 Simon Sparks Minimalist Synchronized Circles (Stacked with Connecting Hairline) */}
        <div className="relative flex flex-col items-center gap-5">
          {/* Subtle connecting vertical guide hairline behind circles */}
          <div className="absolute top-3.5 bottom-3.5 w-[1px] bg-cyan-900/40 -z-10 pointer-events-none" />

          {guidelinePages.map((page, idx) => {
            const isActive = activePageIndex === idx;
            return (
              <button
                key={page.id}
                onClick={() => handlePageClick(idx)}
                className="relative group cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 rounded-full"
                aria-label={`Go to ${page.title} (Page ${page.label})`}
              >
                <svg className="w-7 h-7 overflow-visible">
                  {/* Outer Thin Static Ring Frame */}
                  <circle
                    cx="14"
                    cy="14"
                    r="9.5"
                    fill="none"
                    stroke={isActive ? "rgba(56, 189, 248, 0.45)" : "#0f2f55"}
                    strokeWidth="1.2"
                    className="transition-colors duration-300"
                  />

                  {/* Small Inactive Orbiting Dot / Anchor */}
                  {!isActive && (
                    <circle
                      cx="14"
                      cy="14"
                      r="2.2"
                      fill="#1a4674"
                      className="group-hover:fill-cyan-400 transition-colors"
                    />
                  )}

                  {/* Active State: Centered Bright White Solid Dot + Rotating Progress Stroke */}
                  {isActive && (
                    <>
                      {/* Static Centered Solid Light Dot */}
                      <circle
                        cx="14"
                        cy="14"
                        r="2.4"
                        fill="#ffffff"
                        className="drop-shadow-[0_0_6px_rgba(255,255,255,1)]"
                      />

                      {/* Subtle Background Track */}
                      <circle
                        cx="14"
                        cy="14"
                        r="9.5"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.15)"
                        strokeWidth="1.2"
                      />

                      {/* Animated Progress Stroke (Fills smoothly from 0% to 100% clockwise over 1 minute) */}
                      <circle
                        key={`fill-${activePageIndex}`}
                        cx="14"
                        cy="14"
                        r="9.5"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeDasharray="59.7"
                        strokeDashoffset="59.7"
                        onAnimationEnd={() => {
                          if (activePageIndex === 0) {
                            handlePageClick(1);
                          }
                        }}
                        className="animate-ring-fill -rotate-90 origin-center drop-shadow-[0_0_6px_rgba(255,255,255,0.85)]"
                      />
                    </>
                  )}
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN VIEWPORT CONTAINER */}
      <main ref={mainRef} className="relative w-full h-full overflow-hidden select-none">
        
        {/* 2. HERO SECTION — EXACT SIMON SPARKS FULL SCREEN COMPOSITION */}
        <section
          id="about"
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center px-4 sm:px-8 overflow-hidden select-none will-change-transform"
          style={{
            opacity: 1,
            visibility: 'visible',
            pointerEvents: 'auto',
            transform: 'translate3d(0, 0, 0)',
          }}
        >
          {/* Left Coordinate Marker: 01 ────> (Synced with active point) */}
          <div
            className="hero-anim-item hero-marker absolute left-6 sm:left-12 lg:left-20 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-3 font-sans text-xs text-slate-400 tracking-widest pointer-events-none select-none z-20 will-change-transform"
          >
            <span className="font-bold text-white text-sm transition-all duration-300">
              {guidelinePages[activePageIndex].label}
            </span>
            <div className="w-12 sm:w-16 h-[1px] bg-cyan-700/60 relative flex items-center">
              <span className="absolute right-0 text-[10px] text-cyan-400">▸</span>
            </div>
          </div>

          {/* THE 3D RING CENTERPIECE SCULPTURE */}
          <div
            className="hero-anim-item hero-ring relative w-[min(320px,36vh)] h-[min(320px,36vh)] sm:w-[min(380px,40vh)] sm:h-[min(380px,40vh)] md:w-[min(440px,44vh)] md:h-[min(440px,44vh)] flex items-center justify-center will-change-transform"
          >
            {/* 3D Ring Sculpture Image (Seamlessly blended, zero harsh rectangular bounding box) */}
            <img
              src="/images/simon-sparks-hero.jpg"
              alt="Simon Sparks 3D Ring Sculpture"
              className="w-full h-full object-contain filter drop-shadow-[0_20px_50px_rgba(1,5,16,0.95)] select-none pointer-events-none mix-blend-lighten"
              style={{
                maskImage: 'radial-gradient(circle at 50% 50%, black 60%, transparent 92%)',
                WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 60%, transparent 92%)'
              }}
            />

            {/* Floor Occlusion Ambient Shadow */}
            <div
              className="absolute -bottom-5 sm:-bottom-7 w-[80%] h-10 sm:h-14 torus-floor-shadow pointer-events-none"
            />
          </div>

          {/* TYPOGRAPHY OVERLAY */}
          <div className="relative z-20 -mt-18 sm:-mt-22 md:-mt-26 lg:-mt-28 flex flex-col items-center text-center px-4 w-full select-none will-change-transform">
            {/* Line 1: CINEMATOGRAPHY with Transitions.dev Shimmer */}
            <div
              className="hero-anim-item hero-illustration text-[10px] sm:text-xs font-sans tracking-[0.44em] sm:tracking-[0.54em] uppercase mb-1.5 sm:mb-2 font-semibold select-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] will-change-transform"
            >
              <span className="t-shimmer text-white" data-text="C I N E M A T O G R A P H Y">
                C I N E M A T O G R A P H Y
              </span>
            </div>

            {/* Line 2: REFO GANGGAWASA UTOMO Headline */}
            <h1
              className="hero-anim-item hero-title font-serif text-[clamp(1.75rem,4.4vw,3.9rem)] font-light tracking-[0.03em] text-white uppercase leading-none whitespace-nowrap drop-shadow-[0_12px_45px_rgba(0,0,0,0.95)] select-none will-change-transform"
            >
              REFO GANGGAWASA UTOMO
            </h1>

            {/* Line 3: Symmetrical Triangle & VIDEO EDITOR with Transitions.dev Shimmer */}
            <div
              className="hero-anim-item hero-subtitle flex flex-col items-center will-change-transform"
            >
              <div className="my-1.5 sm:my-2 text-white/90 text-[8px] sm:text-[9px] select-none">
                ▲
              </div>
              <div className="text-[10px] sm:text-xs font-sans tracking-[0.38em] sm:tracking-[0.46em] uppercase font-bold drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                <span className="t-shimmer text-[#f3bd8b] whitespace-pre" data-text="V I D E O   E D I T O R">
                  {"V I D E O   E D I T O R"}
                </span>
              </div>
            </div>
          </div>

        </section>

        {/* 3. WORK / PORTFOLIO SECTION (02 WORK) - 4 CARDS DEAD-CENTER IN VIEWPORT */}
        <section
          id="portfolio"
          className="absolute inset-0 w-full h-full flex items-center justify-center px-4 sm:px-8 md:px-12 select-none will-change-transform overflow-hidden"
          style={{
            opacity: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            transform: 'translate3d(0, 90px, 0)',
          }}
        >
          {/* 4-COLUMN BENTO SHOWCASE (1:1 REPLICATION FROM SIMON SPARKS) - CENTERED IN VIEWPORT */}
          <div
            onMouseLeave={() => setActiveCardIndex(null)}
            className="relative w-full max-w-6xl mx-auto flex items-center justify-center"
          >
            <div className="relative w-full">
              {/* Ambient Contour Wireframe Backdrop with Topographic Hairlines */}
              <div
                className="absolute inset-0 border border-cyan-900/30 rounded-2xl pointer-events-none -m-3 sm:-m-4 overflow-hidden will-change-transform"
              >
                {/* Topographic Contour Lines Backdrop (1:1 with Simon Sparks Video Frame 130-220) */}
                <svg className="w-full h-full text-cyan-500/15" viewBox="0 0 1200 600" fill="none" preserveAspectRatio="none">
                  <path d="M0,130 C280,70 420,200 680,140 C940,80 1080,180 1200,150" stroke="currentColor" strokeWidth="1" />
                  <path d="M0,190 C250,130 390,260 660,200 C930,140 1060,240 1200,210" stroke="currentColor" strokeWidth="1" />
                  <path d="M0,250 C270,190 410,320 700,260 C990,200 1100,300 1200,270" stroke="currentColor" strokeWidth="1" />
                  <path d="M0,310 C300,250 440,380 740,320 C1040,260 1120,360 1200,330" stroke="currentColor" strokeWidth="1" />
                  <path d="M0,370 C340,310 480,440 780,380 C1080,320 1150,420 1200,390" stroke="currentColor" strokeWidth="1" />
                  <ellipse cx="600" cy="300" rx="260" ry="160" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
                  <ellipse cx="600" cy="300" rx="180" ry="110" stroke="currentColor" strokeWidth="1" />
                  <ellipse cx="600" cy="300" rx="110" ry="70" stroke="currentColor" strokeWidth="1" />
                </svg>

                {/* Dynamic Radial Glow that tracks active card */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 w-80 h-96 bg-cyan-500/12 blur-3xl rounded-full transition-all duration-700 pointer-events-none ${
                    activeCardIndex !== null ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    left: `${activeCardIndex !== null ? (activeCardIndex * 25) + 12.5 : 50}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              </div>
              <div
                className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none"
              />

              <div
                onMouseLeave={() => setActiveCardIndex(null)}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-center"
              >
                {[
                  {
                    id: 0,
                    slug: 'commercial',
                    title: 'COMMERCIAL',
                    indexStr: '01',
                    image: CATEGORY_DATA['commercial']?.projects[0]?.thumbnail || '/reference_assets/card_studio74_art.jpg',
                    projectIndex: 0,
                    staggerNext: 0,
                    staggerPrev: 4,
                    monogram: (
                      <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-current" strokeLinecap="round">
                        <circle cx="50" cy="50" r="42" strokeWidth="1.5" opacity="0.3" strokeDasharray="3 3" />
                        <circle cx="50" cy="50" r="36" strokeWidth="2.5" />
                        <polygon points="50,23 73,36 73,64 50,77 27,64 27,36" strokeWidth="1.2" opacity="0.4" />
                        <line x1="50" y1="14" x2="65" y2="40" strokeWidth="2.2" />
                        <line x1="81" y1="32" x2="65" y2="60" strokeWidth="2.2" />
                        <line x1="81" y1="68" x2="50" y2="86" strokeWidth="2.2" />
                        <line x1="50" y1="86" x2="35" y2="60" strokeWidth="2.2" />
                        <line x1="19" y1="68" x2="35" y2="40" strokeWidth="2.2" />
                        <line x1="19" y1="32" x2="50" y2="14" strokeWidth="2.2" />
                        <circle cx="50" cy="50" r="8" fill="currentColor" opacity="0.85" />
                      </svg>
                    ),
                  },
                  {
                    id: 1,
                    slug: 'narrative',
                    title: 'NARRATIVE',
                    indexStr: '02',
                    image: CATEGORY_DATA['narrative']?.projects[0]?.thumbnail || '/reference_assets/card_gloster_art.jpg',
                    projectIndex: 1,
                    staggerNext: 1,
                    staggerPrev: 3,
                    monogram: (
                      <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-current" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="16" y="38" width="68" height="46" rx="4" strokeWidth="2.5" />
                        <line x1="16" y1="52" x2="84" y2="52" strokeWidth="1.8" opacity="0.6" />
                        <line x1="50" y1="52" x2="50" y2="84" strokeWidth="1.8" opacity="0.6" />
                        <circle cx="33" cy="68" r="3" fill="currentColor" />
                        <circle cx="67" cy="68" r="3" fill="currentColor" />
                        <rect x="14" y="20" width="72" height="15" rx="3" strokeWidth="2.5" />
                        <line x1="28" y1="20" x2="36" y2="35" strokeWidth="2.2" />
                        <line x1="44" y1="20" x2="52" y2="35" strokeWidth="2.2" />
                        <line x1="60" y1="20" x2="68" y2="35" strokeWidth="2.2" />
                        <line x1="76" y1="20" x2="84" y2="35" strokeWidth="2.2" />
                      </svg>
                    ),
                  },
                  {
                    id: 2,
                    slug: 'music-video',
                    title: 'MUSIC VIDEO',
                    indexStr: '03',
                    image: CATEGORY_DATA['music-video']?.projects[0]?.thumbnail || '/reference_assets/card_linea_fluid.png',
                    projectIndex: 2,
                    staggerNext: 2,
                    staggerPrev: 2,
                    monogram: (
                      <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-current" strokeLinecap="round">
                        <circle cx="50" cy="50" r="42" strokeWidth="1.5" opacity="0.3" strokeDasharray="3 3" />
                        <line x1="18" y1="46" x2="18" y2="54" strokeWidth="3" />
                        <line x1="26" y1="38" x2="26" y2="62" strokeWidth="3" />
                        <line x1="34" y1="28" x2="34" y2="72" strokeWidth="3" />
                        <line x1="42" y1="18" x2="42" y2="82" strokeWidth="3.2" />
                        <line x1="50" y1="12" x2="50" y2="88" strokeWidth="3.5" />
                        <line x1="58" y1="22" x2="58" y2="78" strokeWidth="3.2" />
                        <line x1="66" y1="32" x2="66" y2="68" strokeWidth="3" />
                        <line x1="74" y1="40" x2="74" y2="60" strokeWidth="3" />
                        <line x1="82" y1="47" x2="82" y2="53" strokeWidth="3" />
                      </svg>
                    ),
                  },
                  {
                    id: 3,
                    slug: 'event-reel',
                    title: 'EVENT & REEL',
                    indexStr: '04',
                    image: CATEGORY_DATA['event-reel']?.projects[0]?.thumbnail || '/reference_assets/card_cube_art.jpg',
                    projectIndex: 3,
                    staggerNext: 3,
                    staggerPrev: 1,
                    monogram: (
                      <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-current" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="50" cy="50" r="40" strokeWidth="2.5" />
                        <circle cx="50" cy="50" r="33" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
                        <circle cx="50" cy="50" r="14" strokeWidth="2.2" />
                        <circle cx="50" cy="50" r="5" fill="currentColor" />
                        <circle cx="50" cy="27" r="5" strokeWidth="1.8" />
                        <circle cx="73" cy="50" r="5" strokeWidth="1.8" />
                        <circle cx="50" cy="73" r="5" strokeWidth="1.8" />
                        <circle cx="27" cy="50" r="5" strokeWidth="1.8" />
                        <line x1="50" y1="10" x2="50" y2="20" strokeWidth="2" />
                        <line x1="90" y1="50" x2="80" y2="50" strokeWidth="2" />
                        <line x1="50" y1="90" x2="50" y2="80" strokeWidth="2" />
                        <line x1="10" y1="50" x2="20" y2="50" strokeWidth="2" />
                      </svg>
                    ),
                  },
                ].map((card) => {
                  const isActive = activeCardIndex === card.id;

                  return (
                    <div
                      key={card.id}
                      onMouseEnter={() => setActiveCardIndex(card.id)}
                      onPointerMove={handleTiltMove}
                      onPointerLeave={handleTiltLeave}
                      onClick={(e) => handleCardCategoryClick(card, e)}
                      className={`t-tilt bento-anim-card relative rounded-xl border bento-card-transition cursor-pointer overflow-hidden flex flex-col justify-between p-5 sm:p-6 will-change-transform ${
                        isActive
                          ? 'border-cyan-400/90 bg-[#081538] shadow-[0_12px_45px_rgba(56,189,248,0.35)] z-20 min-h-[450px] sm:min-h-[475px]'
                          : 'border-cyan-900/40 bg-[#060f28]/90 hover:border-cyan-500/50 hover:bg-[#081538]/80 min-h-[350px] sm:min-h-[375px] z-10'
                      }`}
                    >
                      {/* Transitions.dev 3D Pointer Glare */}
                      <div className="t-tilt-glare" />

                      {/* Top Inverted Triangle Marker (Fades out smoothly when card is active) */}
                      <div className={`flex justify-center transition-all duration-300 text-[10px] relative z-10 ${
                        isActive ? 'opacity-0 -translate-y-2 pointer-events-none' : 'text-cyan-400/50 opacity-100 translate-y-0'
                      }`}>
                        ▼
                      </div>

                      {/* Artwork Slide-Down Unroll (Active / Hover State) */}
                      <div className={`w-full bento-artwork-slider ${
                        isActive
                          ? 'max-h-[260px] opacity-100 my-2 scale-100'
                          : 'max-h-0 opacity-0 my-0 scale-95 pointer-events-none overflow-hidden'
                      }`}>
                        <div className="relative w-full aspect-[3/4] max-w-[195px] sm:max-w-[215px] mx-auto rounded-lg overflow-hidden border border-cyan-400/40 shadow-2xl group/art">
                          <img
                            src={card.image}
                            alt={card.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/art:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#040817]/75 via-transparent to-transparent pointer-events-none" />
                          {/* Play Overlay Button */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/art:opacity-100 transition-opacity bg-black/40">
                            <div className="w-10 h-10 rounded-full bg-cyan-400 text-[#050814] flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.85)] hover:scale-110 transition-transform">
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Monogram SVG & Center Marker (Inactive State) */}
                      <div className={`w-full flex-1 flex flex-col items-center justify-center bento-monogram-slider ${
                        isActive
                          ? 'max-h-0 opacity-0 my-0 scale-90 pointer-events-none overflow-hidden'
                          : 'max-h-[160px] opacity-100 my-4 scale-100'
                      }`}>
                        <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center text-[#8e9ecb]/70 hover:text-white transition-colors duration-300">
                          {card.monogram}
                        </div>
                        {/* Card Dot Marker */}
                        <div className="w-1.5 h-1.5 rounded-full bg-[#1c5285] mt-6" />
                      </div>

                      {/* Typography & Index */}
                      <div className="text-center mt-2 select-none relative z-10">
                        <h4 className={`font-mono text-xs tracking-[0.25em] font-bold uppercase transition-colors duration-300 ${
                          isActive ? 'text-white drop-shadow-[0_2px_12px_rgba(56,189,248,0.4)]' : 'text-white/85'
                        }`}>
                          {card.title}
                        </h4>
                        <div className={`font-mono text-[11px] tracking-[0.2em] font-bold mt-2 transition-colors duration-300 ${
                          isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]' : 'text-[#f3bd8b]'
                        }`}>
                          {card.indexStr}
                        </div>
                      </div>

                      {/* Active Glowing Cyan Underline Bar (Exact to video frame 150-210) */}
                      <div className={`absolute bottom-0 left-5 right-5 h-[3px] rounded-full transition-all duration-500 origin-center ${
                        isActive
                          ? 'bg-cyan-400 shadow-[0_0_15px_rgba(56,189,248,1)] opacity-100 scale-x-100 animate-bento-bar'
                          : 'opacity-0 scale-x-0 pointer-events-none'
                      }`} />

                      {/* Inactive Bottom Notch / Resting Slot */}
                      {!isActive && (
                        <div className="w-8 h-[2px] bg-cyan-950/70 rounded-full mx-auto mt-2 pointer-events-none" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 4. RECRUITMENT & EXPERIENCE (03 SHOP) */}
        <section
          id="shop"
          className="absolute inset-0 w-full h-full py-16 px-4 sm:px-8 md:px-12 max-w-7xl mx-auto flex flex-col justify-center gap-8 sm:gap-10 select-none will-change-transform overflow-y-auto no-scrollbar"
          style={{
            opacity: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            transform: 'translate3d(0, 90px, 0)',
          }}
        >
          {/* CALL TO ACTION BANNER (LOOKING FOR A LEAD VIDEO EDITOR? / SHOP / EXPERIENCE) */}
          <div
            id="skills"
            className={`border border-cyan-900/40 px-6 sm:px-12 py-14 sm:py-16 text-left relative overflow-hidden bg-gradient-to-r from-[#060f28]/95 via-[#091b45]/95 to-[#060f28]/95 rounded-2xl shadow-[0_0_50px_rgba(16,56,117,0.3)] ${getStaggerClass(2, 0, 3)}`}
          >
            {/* Top Ambient Highlight Hairline */}
            <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />

            <div className="text-[10px] font-mono tracking-[0.32em] text-[#f3bd8b] uppercase mb-4 flex items-center gap-2 font-bold">
              <span className="text-cyan-400">▸</span>
              <span>R E C R U I T M E N T   &   I N - H O U S E   D I R E C T I O N</span>
            </div>

            <h2 className="font-serif text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight max-w-4xl">
              Looking for a Lead Video Editor?
            </h2>

            <p className="mt-4 text-xs sm:text-base text-[#abc8e6]/90 max-w-2xl leading-relaxed font-light">
              Saya siap membawa energi positif, kecepatan eksekusi, dan standar sinematik ke dalam tim Anda. Terbuka untuk diskusi peran Full-Time di kantor Anda.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => handlePageClick(3)}
                className="btn-swiss bg-gradient-to-r from-cyan-500 to-cyan-400 text-[#03091e] font-bold hover:brightness-110 shadow-[0_0_25px_rgba(56,189,248,0.4)] cursor-pointer"
              >
                <span>CONTACT US</span>
                <span className="text-[#03091e]">▸</span>
              </button>

              <button
                onClick={() => setIsCvOpen(true)}
                className="btn-swiss border-cyan-500/50 text-[#f3bd8b] hover:bg-cyan-950/40 hover:border-cyan-400 cursor-pointer"
              >
                <span>VIEW RESUME</span>
                <span className="text-cyan-400">▸</span>
              </button>
            </div>
          </div>

          {/* BOTTOM SHOWCASE GRID (TNQ PROJECT / DREAMS / ESCAPE) */}
          <div className="border-t border-cyan-900/40 pt-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Main Featured Box: TNQ PROJECT */}
              <div className={`velocity-card velocity-delay-1 lg:col-span-6 p-4 rounded-xl border border-cyan-900/40 bg-[#060f28]/90 hover:border-cyan-400/60 hover:bg-[#081538]/90 hover:shadow-[0_0_35px_rgba(16,56,117,0.35)] transition-all duration-300 flex flex-col justify-between group ${getStaggerClass(2, 1, 2)}`}>
                <div className="relative aspect-[16/10] w-full rounded overflow-hidden mb-4 bg-[#03081a]">
                  <img
                    src={projects[1]?.thumbnail_url || '/images/refo-hero.png'}
                    alt="TNQ Project"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <h3 className="font-display font-black text-3xl sm:text-4xl text-white tracking-widest drop-shadow-xl">
                      TNQ
                    </h3>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="font-mono text-xs tracking-[0.2em] font-bold text-white uppercase group-hover:text-cyan-300 transition-colors">
                    TNQ PROJECT ▸
                  </span>
                  <span className="text-[11px] font-mono text-[#f3bd8b] font-bold">01 // <span className="text-[#abc8e6]/70 font-normal">COMMERCIAL</span></span>
                </div>
              </div>

              {/* Stacked Box 02: DREAMS */}
              <div className={`velocity-card velocity-delay-2 lg:col-span-3 p-4 rounded-xl border border-cyan-900/40 bg-[#060f28]/90 hover:border-cyan-400/60 hover:bg-[#081538]/90 hover:shadow-[0_0_35px_rgba(16,56,117,0.35)] transition-all duration-300 flex flex-col justify-between group ${getStaggerClass(2, 2, 1)}`}>
                <div className="relative aspect-[4/5] w-full rounded overflow-hidden mb-4 bg-[#03081a]">
                  <img
                    src={projects[2]?.thumbnail_url || '/images/refo-hero.png'}
                    alt="Dreams Project"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-3 left-3 font-mono text-xs font-bold text-[#f3bd8b]">
                    02
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="font-mono text-xs tracking-[0.2em] font-bold text-white uppercase group-hover:text-cyan-300 transition-colors">
                    DREAMS ▸
                  </span>
                </div>
              </div>

              {/* Stacked Box 03: ESCAPE */}
              <div className={`velocity-card velocity-delay-3 lg:col-span-3 p-4 rounded-xl border border-cyan-900/40 bg-[#060f28]/90 hover:border-cyan-400/60 hover:bg-[#081538]/90 hover:shadow-[0_0_35px_rgba(16,56,117,0.35)] transition-all duration-300 flex flex-col justify-between group ${getStaggerClass(2, 3, 0)}`}>
                <div className="relative aspect-[4/5] w-full rounded overflow-hidden mb-4 bg-[#03081a]">
                  <img
                    src={projects[3]?.thumbnail_url || '/images/refo-hero.png'}
                    alt="Escape Project"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-3 left-3 font-mono text-xs font-bold text-[#f3bd8b]">
                    03
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="font-mono text-xs tracking-[0.2em] font-bold text-white uppercase group-hover:text-cyan-300 transition-colors">
                    ESCAPE ▸
                  </span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 5. RECRUITER CONTACT & FOOTER SECTION (04 CONTACT) */}
        <section
          id="contact"
          className="absolute inset-0 w-full h-full py-16 px-4 sm:px-8 md:px-12 max-w-5xl mx-auto flex flex-col justify-center gap-10 select-none will-change-transform overflow-y-auto no-scrollbar"
          style={{
            opacity: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            transform: 'translate3d(0, 90px, 0)',
          }}
        >
          <div className={`max-w-2xl mx-auto text-left w-full ${getStaggerClass(3, 0, 1)}`}>
            <div className="text-[10px] font-mono tracking-[0.32em] text-[#f3bd8b] uppercase mb-2 font-bold flex items-center gap-2">
              <span className="text-cyan-400">▸</span>
              <span>I N T E R V I E W   &   I N Q U I R Y</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl text-white tracking-tight mb-2">
              Jadwalkan Wawancara Kerja
            </h2>
            <p className="text-xs text-[#abc8e6]/80 leading-relaxed mb-8 font-light">
              Kirimkan detail penawaran peran, jadwal wawancara, atau sapaan langsung ke Refo Ganggawasa Utomo.
            </p>

            {formFeedback && (
              <div
                className={`p-4 rounded text-xs mb-6 flex items-start gap-2.5 ${
                  formFeedback.success
                    ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {formFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                )}
                <span>{formFeedback.message}</span>
              </div>
            )}

            <div className="relative p-6 sm:p-9 rounded-2xl border border-cyan-900/40 bg-[#060f28]/95 shadow-[0_15px_50px_rgba(0,0,0,0.8)] overflow-hidden">
              {/* Top ambient highlight hairline */}
              <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />

              <form onSubmit={handleRecruiterSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-[#abc8e6]/80 mb-1.5 font-medium">
                      Nama Rekruter / HR *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama Anda"
                      value={recruiterForm.name}
                      onChange={(e) => setRecruiterForm({ ...recruiterForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/50 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-[#abc8e6]/80 mb-1.5 font-medium">
                      Perusahaan / Studio *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Production House / Tech Co"
                      value={recruiterForm.company}
                      onChange={(e) => setRecruiterForm({ ...recruiterForm, company: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/50 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-[#abc8e6]/80 mb-1.5 font-medium">
                      Email Kontak *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="nama@perusahaan.com"
                      value={recruiterForm.email}
                      onChange={(e) => setRecruiterForm({ ...recruiterForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/50 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-[#abc8e6]/80 mb-1.5 font-medium">
                      WhatsApp / Telepon
                    </label>
                    <input
                      type="tel"
                      placeholder="+62 8..."
                      value={recruiterForm.phone}
                      onChange={(e) => setRecruiterForm({ ...recruiterForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/50 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-wider uppercase text-[#abc8e6]/80 mb-1.5 font-medium">
                    Posisi yang Ditawarkan *
                  </label>
                  <select
                    value={recruiterForm.role_offered}
                    onChange={(e) => setRecruiterForm({ ...recruiterForm, role_offered: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/50 focus:border-cyan-400 text-xs text-white focus:outline-none"
                  >
                    <option value="Lead Video Editor">Lead Video Editor (Full-Time Onsite/Hybrid)</option>
                    <option value="Senior Video Editor">Senior Video Editor (Full-Time)</option>
                    <option value="Creative Director / Videographer">Creative Director / Videographer</option>
                    <option value="Contract / Project-Based">Contract / Project-Based</option>
                    <option value="Peran Kreatif Lainnya">Peran Kreatif Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-wider uppercase text-[#abc8e6]/80 mb-1.5 font-medium">
                    Pesan Tambahan *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Deskripsikan peran, ekspektasi, atau jadwal wawancara yang Anda rencanakan..."
                    value={recruiterForm.message}
                    onChange={(e) => setRecruiterForm({ ...recruiterForm, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/50 focus:border-cyan-400 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-swiss w-full justify-center bg-gradient-to-r from-cyan-500 to-cyan-400 text-[#03091e] font-bold hover:brightness-110 shadow-[0_0_25px_rgba(56,189,248,0.4)] cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'MENGIRIMKAN...' : 'SUBMIT RECRUITER INQUIRY ▸'}
                </button>
              </form>
            </div>
          </div>

          {/* HIGH-IMPACT SOLID FOOTER */}
          <div className={`border-t border-cyan-900/40 pt-16 w-full ${getStaggerClass(3, 1, 0)}`}>
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
              {/* Logo & Monogram */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg border border-cyan-900/50 flex items-center justify-center bg-[#060f28]/90 text-cyan-400 shadow-[0_0_20px_rgba(16,56,117,0.3)]">
                  <svg viewBox="0 0 48 48" className="w-8 h-8 text-cyan-400">
                    <path
                      d="M14 12 H34 C38 12 40 16 38 20 C36 24 30 25 24 25 C18 25 12 26 10 30 C8 34 10 38 14 38 H34"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-serif text-lg text-white font-bold tracking-wider">
                    REFO SPARKS
                  </div>
                  <div className="text-[10px] font-mono tracking-[0.2em] text-[#abc8e6]/60 uppercase">
                    VIDEO EDITOR & VIDEOGRAPHER
                  </div>
                </div>
              </div>

              {/* Large Editorial Nav Links */}
              <div className="font-serif text-lg sm:text-xl text-[#abc8e6] flex flex-wrap items-center justify-center gap-6">
                <button onClick={() => handlePageClick(0)} className="hover:text-[#f3bd8b] transition-colors cursor-pointer">About</button>
                <span className="text-cyan-900/70">/</span>
                <button onClick={() => handlePageClick(1)} className="hover:text-[#f3bd8b] transition-colors cursor-pointer">Work</button>
                <span className="text-cyan-900/70">/</span>
                <button
                  onClick={() => setIsCvOpen(true)}
                  className="hover:text-[#f3bd8b] transition-colors cursor-pointer"
                >
                  Experience
                </button>
                <span className="text-cyan-900/70">/</span>
                <button onClick={() => handlePageClick(3)} className="hover:text-[#f3bd8b] transition-colors cursor-pointer">Contacts</button>
              </div>

              {/* Copyright & Coordinates */}
              <div className="text-[10px] font-mono tracking-[0.25em] text-[#abc8e6]/50 uppercase">
                2026 COPYRIGHT  |  REFO GANGGAWASA  |  ALL RIGHTS RESERVED
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* 10. VIDEO PLAYER MODAL (TRANSITIONS.DEV ASYMMETRIC OPEN/CLOSE 06-modal.md) */}
      {selectedVideo && (
        <div
          data-lenis-prevent="true"
          data-lenis-prevent-wheel="true"
          data-lenis-prevent-touch="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeVideoModal();
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none t-modal-backdrop ${
            isVideoClosing ? 'is-closing' : 'is-open'
          }`}
        >
          <div
            data-lenis-prevent="true"
            className={`relative w-full max-w-4xl rounded-2xl overflow-hidden bg-[#060f28] border border-cyan-500/40 shadow-[0_0_60px_rgba(16,56,117,0.6)] flex flex-col select-auto t-modal ${
              isVideoClosing ? 'is-closing' : 'is-open'
            }`}
          >
            <div className="px-6 py-4 border-b border-cyan-900/40 flex items-center justify-between bg-[#040a1c]">
              <div>
                <span className="text-[10px] font-mono tracking-[0.25em] text-[#f3bd8b] uppercase font-bold">
                  {selectedVideo.client}
                </span>
                <h3 className="font-serif text-lg text-white font-bold">
                  {selectedVideo.title}
                </h3>
              </div>
              <button
                onClick={closeVideoModal}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer"
                aria-label="Close Video Player"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video w-full bg-black">
              {selectedVideo.video_url.includes('youtube.com') || selectedVideo.video_url.includes('youtu.be') ? (
                <iframe
                  src={selectedVideo.video_url.replace('watch?v=', 'embed/')}
                  title={selectedVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={selectedVideo.video_url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="p-6 text-left bg-[#040a1c]">
              <p className="text-xs text-[#abc8e6]/90 leading-relaxed font-light">
                {selectedVideo.description}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono text-[#f3bd8b] uppercase tracking-wider font-bold">TAGS:</span>
                {selectedVideo.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-[#061433] text-cyan-300 border border-cyan-500/40"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. RECRUITER CV / RESUME MODAL (TRANSITIONS.DEV ASYMMETRIC OPEN/CLOSE 06-modal.md) */}
      {isCvOpen && (
        <div
          data-lenis-prevent="true"
          data-lenis-prevent-wheel="true"
          data-lenis-prevent-touch="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCvModal();
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto modal-inner-scroll select-none t-modal-backdrop ${
            isCvClosing ? 'is-closing' : 'is-open'
          }`}
        >
          <div
            data-lenis-prevent="true"
            className={`relative w-full max-w-2xl rounded-2xl overflow-hidden bg-[#060f28] border border-cyan-500/40 shadow-[0_0_60px_rgba(16,56,117,0.6)] p-6 sm:p-8 text-left my-8 select-auto t-modal ${
              isCvClosing ? 'is-closing' : 'is-open'
            }`}
          >
            <div className="flex items-center justify-between border-b border-cyan-900/40 pb-5 mb-6">
              <div>
                <div className="text-[10px] font-mono tracking-[0.25em] text-[#f3bd8b] uppercase font-bold">
                  EXPERIENCE & SPECIFICATIONS
                </div>
                <h3 className="font-serif text-2xl font-bold text-white uppercase">
                  Refo Ganggawasa Utomo
                </h3>
                <p className="text-xs text-[#abc8e6]/70 font-mono mt-0.5">
                  LEAD VIDEO EDITOR & IN-HOUSE VIDEOGRAPHER
                </p>
              </div>
              <button
                onClick={closeCvModal}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer"
                aria-label="Close CV Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6 text-xs text-[#abc8e6]/90 leading-relaxed">
              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3bd8b] font-bold mb-2">
                  // RINGKASAN REKRUTMEN
                </h4>
                <p className="bg-[#040a1c] p-4 rounded-xl border border-cyan-900/40 font-light leading-relaxed">
                  Berpengalaman dalam seluruh siklus pascaproduksi mulai dari pemotongan ritme narasi di Adobe Premiere Pro, color grading standar bioskop di DaVinci Resolve Studio, hingga dynamic motion callouts di After Effects. Siap berkontribusi secara penuh waktu (in-house).
                </p>
              </div>

              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3bd8b] font-bold mb-3">
                  // SENJATA SOFTWARE & GEAR
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/40 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Premiere Pro (Expert)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/40 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>DaVinci Resolve (Colorist)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/40 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>After Effects (Motion FX)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#040a1c] border border-cyan-900/40 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Sony Cinema Rig (4K 10-bit)</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f3bd8b] font-bold mb-2">
                  // KESIAPAN KERJA
                </h4>
                <div className="space-y-1.5 font-mono text-[#abc8e6]/80">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>Status: Siap Full-Time In-House</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>Penempatan: On-Site (Jabodetabek) / Hybrid / Remote</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-cyan-900/40 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] font-mono text-[#abc8e6]/60">
                EMAIL: <span className="text-white font-semibold">refoutomo@gmail.com</span>
              </span>
              <div className="flex items-center gap-3">
                <a
                  href="https://wa.me/6281234567890"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerToast('Membuka WhatsApp Refo...', 'info')}
                  className="px-4 py-2 rounded-full text-xs font-mono tracking-wider uppercase text-cyan-300 bg-[#061433] border border-cyan-500/40 hover:bg-cyan-900/50 transition-colors"
                >
                  WhatsApp Langsung
                </a>
                <a
                  href="#contact"
                  onClick={closeCvModal}
                  className="btn-swiss text-xs py-2 px-4"
                >
                  Schedule Call ▸
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12. TRANSITIONS.DEV TOAST NOTIFICATION (22-toast.md) */}
      <div
        className={`fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-xl border flex items-center gap-3 shadow-2xl backdrop-blur-md select-none t-toast pointer-events-none ${
          toast.show ? 'is-open' : ''
        } ${
          toast.type === 'success'
            ? 'bg-[#061433]/95 border-cyan-400/60 text-cyan-200 shadow-[0_0_30px_rgba(56,189,248,0.35)]'
            : 'bg-[#181126]/95 border-amber-400/60 text-amber-200 shadow-[0_0_30px_rgba(251,146,60,0.35)]'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
        <span className="font-mono text-xs tracking-wide">{toast.message}</span>
      </div>

      {/* 13. CINEMA 3-STAGE STEADY-MEDIA EXPANDING FRAME PORTAL TRANSITION */}
      {zoomingPortal && (
        <div
          className="fixed inset-0 z-50 pointer-events-none overflow-hidden flex items-center justify-center select-none"
          style={{
            backgroundColor:
              zoomingPortal.stage === 'init'
                ? 'rgba(3, 8, 26, 0)'
                : zoomingPortal.stage === 'centered'
                ? 'rgba(3, 8, 26, 0.92)'
                : 'rgba(3, 8, 26, 1)',
            transition: 'background-color 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Expanding Card Frame with Steady Inner Content */}
          <div
            className="overflow-hidden will-change-transform"
            style={{
              position: 'fixed',
              left: zoomingPortal.stage === 'init' ? `${zoomingPortal.x}px` : '50%',
              top: zoomingPortal.stage === 'init' ? `${zoomingPortal.y}px` : '50%',
              width:
                zoomingPortal.stage === 'init'
                  ? `${zoomingPortal.width}px`
                  : zoomingPortal.stage === 'centered'
                  ? 'clamp(320px, 34vw, 480px)'
                  : '100vw',
              height:
                zoomingPortal.stage === 'init'
                  ? `${zoomingPortal.height}px`
                  : zoomingPortal.stage === 'centered'
                  ? 'clamp(440px, 58vh, 640px)'
                  : '100vh',
              transform:
                zoomingPortal.stage === 'init' ? 'translate(0, 0)' : 'translate(-50%, -50%)',
              borderRadius:
                zoomingPortal.stage === 'expanding' ? '0px' : '16px',
              border:
                zoomingPortal.stage === 'expanding'
                  ? 'none'
                  : '1.5px solid rgba(56, 189, 248, 0.95)',
              boxShadow:
                zoomingPortal.stage === 'expanding'
                  ? 'none'
                  : '0 0 65px rgba(56,189,248,0.6), 0 20px 50px rgba(0,0,0,0.85)',
              transition:
                zoomingPortal.stage === 'expanding'
                  ? 'all 0.70s cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'all 0.52s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Inner Content #1 Visual (Steady, Crisp, No Distortion) */}
            <img
              src={zoomingPortal.image}
              alt=""
              className="w-full h-full object-cover will-change-transform"
              style={{
                transform: zoomingPortal.stage === 'expanding' ? 'scale(1.02)' : 'scale(1)',
                transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />

            {/* Subtle Cinematic Vignette Framing */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#020512]/85 via-transparent to-[#020512]/35 pointer-events-none" />

            {/* Metro-Inspired Thin Cyan Progress Bar Line at Bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400/20 pointer-events-none">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-400 origin-left"
                style={{
                  transform: zoomingPortal.stage === 'expanding' ? 'scaleX(1)' : 'scaleX(0)',
                  transition:
                    zoomingPortal.stage === 'expanding'
                      ? 'transform 0.70s cubic-bezier(0.22, 1, 0.36, 1)'
                      : 'none',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
