/**
 * Centralized Motion Design Tokens
 * 1:1 Synchronization between GSAP Animation Engine and CSS / Tailwind
 * Reference: site-transitions-audit-and-plan.md & transitions-polish
 */

export const EASE = {
  // Signature primary curve (smooth-out with sharp initial response and long graceful decel)
  smoothOut: {
    gsap: 'power3.out',
    css: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  // Reversible symmetric ease for two-way state transitions
  inOut: {
    gsap: 'power3.inOut',
    css: 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
  // High-ceremony cinematic curves for full-viewport portal expansion
  expoInOut: {
    gsap: 'expo.inOut',
    css: 'cubic-bezier(0.87, 0, 0.13, 1)',
  },
  expoOut: {
    gsap: 'expo.out',
    css: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  // Bouncy overshoot for pop-in badges & playful accents
  bounce: {
    gsap: 'back.out(1.5)',
    css: 'cubic-bezier(0.34, 1.36, 0.64, 1)',
  },
  // Strong spring recoil for hover-out settle
  bounceStrong: {
    gsap: 'back.out(3.5)',
    css: 'cubic-bezier(0.34, 3.85, 0.64, 1)',
  },
  linear: {
    gsap: 'none',
    css: 'linear',
  },
} as const;

export const DURATION = {
  stagger: 0.04,     // 40ms per item
  micro: 0.08,       // 80ms intent delay, tooltips
  quick: 0.15,       // 150ms modal/dropdown close, exit states
  fast: 0.25,        // 250ms modal/dropdown open, card hover lift
  medium: 0.35,      // 350ms toasts, side panels
  slow: 0.45,        // 450ms content reveal
  verySlow: 0.50,    // 500ms emphasis moments
  hold: 0.53,        // 530ms portal idle hold before expansion
  revealWidth: 1.15, // 1150ms portal width expansion
  revealHeight: 1.35,// 1350ms portal height expansion
  mix: 0.45,         // 450ms portal cross-dissolve effect mix
} as const;

export const DISTANCE = {
  micro: '4px',
  small: '6px',
  base: '8px',
  medium: '12px',
  large: '30px',
} as const;

export const SCALE = {
  tiny: 0.99,
  small: 0.98,
  medium: 0.97,
  large: 0.96,
} as const;

export const BLUR = {
  small: '2px',
  medium: '3px',
  large: '8px',
} as const;
