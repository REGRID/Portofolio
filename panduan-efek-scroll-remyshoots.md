# Panduan Menduplikasi Efek Scroll ala RemyShoots.co.za

Referensi: https://www.remyshoots.co.za/
Stack terdeteksi (Wappalyzer): **Next.js + React + GSAP + Three.js**, hosting di **Vercel**.

Dokumen ini berisi arahan teknis untuk direplikasi di project portofolio Next.js kamu. Bisa langsung dipakai sebagai prompt/brief untuk Antigravity.

---

## 1. Stack yang dibutuhkan

| Kebutuhan | Tool | Catatan |
|---|---|---|
| Framework | Next.js (App Router) | sudah jadi rencana kamu |
| Animasi scroll | GSAP + `ScrollTrigger` | core engine efeknya |
| Smooth scroll (opsional tapi disarankan) | `Lenis` atau GSAP `ScrollSmoother` | ScrollSmoother berbayar (Club GSAP), Lenis gratis & open-source — lebih masuk akal untuk project mandiri |
| Elemen 3D/WebGL (opsional) | `Three.js` (bisa via `@react-three/fiber` biar lebih mudah di React) | dipakai RemyShoots untuk efek visual seperti toggle "fisheye" |

Install dasar:
```bash
npm install gsap lenis three @react-three/fiber @react-three/drei
```

---

## 2. Struktur efek yang terlihat di RemyShoots

1. **Smooth inertia scroll** — scroll terasa "meluncur", bukan native jump.
2. **Scroll-triggered reveal** — teks/gambar muncul (fade/slide) saat section masuk viewport.
3. **Parallax ringan** — elemen bergerak dengan kecepatan berbeda dari scroll.
4. **View switcher (slider/grid/list)** — transisi antar mode tampilan galeri, kemungkinan pakai GSAP timeline saat state React berubah.
5. **Preloader/intro gate** ("enter with sound" / "enter without") — animasi masuk sebelum konten utama tampil.

---

## 3. Setup smooth scroll (Lenis + GSAP ScrollTrigger)

Buat provider yang menjalankan Lenis dan menyinkronkannya dengan `ScrollTrigger`:

```tsx
// components/SmoothScrollProvider.tsx
'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    lenis.on('scroll', ScrollTrigger.update)

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}
```

Bungkus `layout.tsx` dengan provider ini agar aktif di seluruh situs.

---

## 4. Scroll-triggered reveal per section

```tsx
// hooks/useScrollReveal.ts
'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        y: 60,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      })
    })

    return () => ctx.revert()
  }, [])

  return ref
}
```

Pakai di tiap section:
```tsx
const ref = useScrollReveal()
return <section ref={ref}>...</section>
```

---

## 5. Parallax ringan

```tsx
gsap.to(imageRef.current, {
  yPercent: -20,
  ease: 'none',
  scrollTrigger: {
    trigger: imageRef.current,
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
  },
})
```

`scrub: true` mengikat animasi langsung ke posisi scroll (bukan diputar sekali), ini yang bikin parallax terasa "menempel" ke gerakan mouse/trackpad.

---

## 6. View switcher (slider / grid / list)

Pendekatan: satu state React (`view: 'slider' | 'grid' | 'list'`), lalu gunakan GSAP `flip` plugin (`Flip` dari GSAP) untuk animasi transisi layout otomatis saat class/posisi elemen berubah — ini cara paling ringkas untuk replikasi transisi grid↔list yang mulus tanpa menulis animasi manual per elemen.

```bash
# Flip sudah termasuk dalam paket gsap, tinggal import
```
```tsx
import { Flip } from 'gsap/Flip'
gsap.registerPlugin(Flip)

function switchView(newView: string) {
  const state = Flip.getState('.gallery-item')
  setView(newView) // trigger re-render/re-layout via CSS
  requestAnimationFrame(() => {
    Flip.from(state, { duration: 0.6, ease: 'power2.inOut', stagger: 0.02 })
  })
}
```

---

## 7. Elemen Three.js (opsional, untuk efek "fisheye")

Untuk efek distorsi lensa seperti toggle "fisheye" di RemyShoots, pendekatan paling praktis di React adalah render gambar/video sebagai texture di plane Three.js, lalu distorsi dilakukan lewat custom shader (vertex/fragment shader sederhana) yang di-toggle intensitasnya. Ini bagian paling advance — kalau portofolio kamu tidak butuh efek 3D, bagian ini bisa dilewati; parallax + reveal + smooth scroll di atas sudah menangkap "rasa" utama dari efek situs tersebut.

Rekomendasi: mulai dari poin 1–4 dulu (smooth scroll, reveal, parallax, view switcher), baru eksplorasi Three.js kalau ada waktu/kebutuhan khusus.

---

## 8. Ringkasan prioritas implementasi

1. Smooth scroll (Lenis) — fondasi "rasa" situsnya
2. Scroll-reveal per section — efek paling terlihat & murah biaya dev
3. Parallax ringan di gambar/video hero
4. View switcher dengan GSAP Flip
5. (Opsional, lanjutan) Efek WebGL/Three.js untuk detail seperti fisheye

Catatan: karena kamu meng-host sendiri di VPS (bukan Vercel), pastikan build Next.js tetap dijalankan sebagai SSR/Node server atau static export sesuai kebutuhan video-serving kamu — tidak ada perbedaan khusus untuk GSAP/Lenis di sisi ini, keduanya client-side murni.
