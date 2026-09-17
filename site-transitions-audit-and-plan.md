# AUDIT: Semua Transisi di `regrid.web.id` (repo `REGRID/Portofolio`) — Rencana "Seamless & Rapi"

> **Cara pakai file ini:** tempel seluruh isi ke Antigravity/AI coding agent sebagai briefing. Semua temuan di bawah ini **sudah diverifikasi langsung dari source code** (bukan tebakan dari tampilan luar), lengkap dengan lokasi file & baris, supaya agent bisa langsung `grep`/buka file yang dimaksud. Dokumen ini melengkapi (bukan menggantikan) spec sebelumnya soal *grid-reveal intro* — lihat bagian 5 untuk keterkaitannya.

---

## 0. Cara kerja audit ini

Dicek dengan membaca langsung (bukan cuma lihat website jadi):
- `src/app/page.tsx` (1761 baris) — homepage, termasuk "Cinema Zoom-In Portal Transition"
- `src/app/work/[category]/page.tsx` (2261 baris) — halaman kategori dengan mode **Grid / Slider / List**
- `src/app/globals.css` (844 baris) — semua `@keyframes`, class `.animate-*`, `.modal-*`, `.bento-*`
- `src/components/SmoothScrollProvider.tsx`, `src/hooks/useScrollReveal.ts`, `src/hooks/useParallax.ts`
- Semua pemakaian `transition-*` / `duration-*` / `ease-*` Tailwind di seluruh `src/app`

Stack animasi yang dipakai project ini: **GSAP 3.15** (+ ScrollTrigger) untuk choreography kompleks, **Motion (Framer Motion) 13** (belum banyak dipakai — cek pemakaian sebelum nambah), **Lenis** untuk smooth-scroll, plus banyak **inline CSS transition** & **Tailwind utility classes** untuk interaksi kecil (hover, tombol, modal).

---

## 1. Ringkasan eksekutif — kenapa transisi terasa "belum seamless"

Bukan karena animasinya jelek satu-satu (banyak yang sudah bagus & detail, misal choreography hero di `page.tsx` baris 396–456). Masalahnya **sistemik**: ada **4–5 sistem animasi berbeda** yang hidup berdampingan tanpa satu sumber kebenaran (*single source of truth*) untuk durasi & easing, sehingga:

1. Transisi besar (portal/hero) terasa "premium", tapi transisi kecil (hover, tombol) pakai default Tailwind yang beda "kepribadian".
2. Satu interaksi (portal transition) **secara teknis terputus di tengah jalan** saat navigasi — ini bukan soal selera, ini bug nyata (lihat #Temuan 1).
3. Timing dikontrol pakai angka `setTimeout` yang di-hardcode terpisah dari durasi animasi CSS/GSAP aslinya → gampang desync kalau salah satu diubah tanpa mengubah yang lain.

**Prioritas perbaikan (urutan pengerjaan yang disarankan):**

| # | Temuan | Severity | Effort |
|---|---|---|---|
| 1 | Portal transition mati saat `router.push` — cut hard, bukan nyambung ke halaman tujuan | 🔴 Kritis (bug, bukan cuma "kurang rapi") | Medium |
| 2 | Tidak ada shared motion-token (durasi & ease di-hardcode berulang di puluhan tempat) | 🟠 Tinggi (akar masalah dari sebagian besar temuan lain) | Medium |
| 3 | Dua varian `cubic-bezier` yang nyaris identik dipakai berdampingan dalam 1 komponen yang sama | 🟡 Sedang | Kecil |
| 4 | `setTimeout` hardcoded tidak sinkron dengan durasi animasi asli | 🟡 Sedang | Kecil–Medium |
| 5 | Tidak ada transisi resmi masuk ke mode Grid (baru: fitur dari spec sebelumnya) | 🟠 Tinggi (fitur belum ada) | Medium |
| 6 | Scroll physics berubah drastis antara `/` (Lenis) dan `/work/*` (native/canvas) | 🟢 Rendah (kemungkinan disengaja, cukup di-review) | — |

---

## 2. Temuan detail (dengan bukti dari kode)

### 🔴 Temuan 1 — Portal transition "Cinema Zoom-In" terputus saat pindah halaman

**Lokasi:** `src/app/page.tsx`, fungsi `handleCardCategoryClick` (baris ~68–116) + render block "CINEMA 3-STAGE STEADY-MEDIA EXPANDING FRAME PORTAL TRANSITION" (baris ~1679–1758).

**Apa yang terjadi:**

```
t=0ms     → stage: 'init'      (card di posisi asli, ukuran asli)
t=~32ms   → stage: 'centered'  (2x requestAnimationFrame, lalu pindah ke tengah layar)
t=750ms   → stage: 'expanding' (mulai transition: all 0.70s cubic-bezier(0.22,1,0.36,1))
t=1450ms  → router.push(`/work/${slug}`)   ← 🔴 DI SINI MASALAHNYA
t=2400ms  → setZoomingPortal(null)          ← cleanup ini TIDAK PERNAH TERCAPAI
```

Masalahnya ada **dua lapis**:

1. **Timing mepet:** stage `'expanding'` butuh 700ms (750ms → 1450ms) untuk selesai visual. `router.push` dipanggil **persis** di t=1450ms — yaitu *pas* di akhir durasi transisi, tanpa margin. Kalau ada frame drop sedikit saja, navigasi terjadi sebelum animasi expand kelar.
2. **Lebih fatal:** `zoomingPortal` adalah **state lokal di komponen `PortfolioPage`** (halaman `/`). Begitu `router.push` dieksekusi, Next.js App Router **meng-unmount seluruh komponen `PortfolioPage`** (termasuk overlay portal-nya) karena route berpindah ke `/work/[category]`. Artinya `cleanupTimer` (yang dijadwalkan di t=2400ms) **tidak akan pernah jalan** — komponennya sudah hilang duluan. Yang user lihat: overlay yang sedang "expanding" tiba-tiba **hilang seketika**, lalu halaman `/work/[category]` muncul dengan animasi entrance-nya sendiri dari nol (`gsap.set(topRowEls, { y: -380, opacity: 0 })`, baris ~1022–1025 di `work/[category]/page.tsx`) — **dua sistem animasi yang sama sekali tidak saling tahu satu sama lain.**

**Kenapa ini penting:** ini justru transisi paling "hero"/menonjol di seluruh site (klik card kategori dari homepage), dan ini yang paling gampang ketahuan patah kalau diperhatikan.

**Rekomendasi perbaikan (pilih salah satu, urut dari paling direkomendasikan):**

- **A. Angkat state portal ke `layout.tsx`** (di luar page component manapun), misal lewat React Context (`TransitionProvider`) yang dipasang di `src/app/layout.tsx`. Dengan begitu overlay portal **tidak ikut ter-unmount** saat route berganti, dan bisa lanjut animasi *sampai benar-benar selesai* + fade-out halus setelah halaman baru siap, baru di-cleanup.
- **B. Next.js View Transitions API** — Next 16 sudah mendukung `experimental.viewTransition` (cek `node_modules/next/dist/docs/` sesuai instruksi di `AGENTS.md` project ini untuk API persis di versi yang dipakai). Ini native browser API buat cross-route transition tanpa perlu portal manual sama sekali — lebih tahan terhadap race condition seperti di atas.
- **C. Minimal fix (kalau waktu terbatas):** tunda `router.push` sampai `onComplete` callback dari animasi expand (bukan `setTimeout` dengan angka tebakan), dan pastikan destination page (`work/[category]/page.tsx`) punya "entry state" yang **menyambung** dari kondisi portal (misal: mulai dari opacity 0 lalu cross-fade *setelah* portal fade-out, bukan mulai dari `y: -380` yang tidak berhubungan sama sekali dengan posisi portal).

---

### 🟠 Temuan 2 — Tidak ada satu sumber kebenaran untuk durasi & easing (motion tokens)

**Bukti jumlah pemakaian (hasil `grep` langsung, bukan estimasi):**

```
Tailwind duration-* di page.tsx           : duration-300 (×16), duration-500 (×5), duration-700 (×2)
Tailwind duration-* di work/[category]    : duration-300 (×3), duration-200 (×3), duration-500 (×2)
Tailwind ease-* dipakai eksplisit         : cuma 5 kali total di SELURUH src/app
Custom cubic-bezier() inline di style{}   : minimal 6 varian berbeda, tersebar di page.tsx & globals.css
GSAP ease string dipakai                  : 'power3.out', 'power3.inOut', 'power2.out' — konsisten di GSAP,
                                             tapi TIDAK PERNAH dipetakan ulang ke CSS cubic-bezier yang setara
```

**Masalahnya:** 53 tempat pakai `transition-*`/`duration-*` Tailwind, tapi cuma 5 yang eksplisit set `ease-*` → sisanya diam-diam pakai default Tailwind (`cubic-bezier(0.4, 0, 0.2, 1)`), yang **berbeda karakter** dari kurva custom yang dipakai di GSAP (`power3.out`) maupun di inline style (`cubic-bezier(0.16, 1, 0.3, 1)` dan `cubic-bezier(0.22, 1, 0.36, 1)`). Efeknya: hover tombol biasa terasa "generik", sementara hero/portal terasa "cinematic" — dua kepribadian berbeda dalam satu situs.

**Rekomendasi:** buat 1 file token terpusat, contoh:

```ts
// src/lib/motion-tokens.ts
export const EASE = {
  // dipetakan 1:1 antara GSAP & CSS supaya "rasa"-nya identik di kedua sistem
  out:    { gsap: 'power3.out',    css: 'cubic-bezier(0.16, 1, 0.3, 1)'  }, // signature curve project ini
  inOut:  { gsap: 'power3.inOut',  css: 'cubic-bezier(0.65, 0, 0.35, 1)' },
  expoInOut: { gsap: 'expo.inOut', css: 'cubic-bezier(0.87, 0, 0.13, 1)' }, // khusus reveal/expand besar
} as const;

export const DURATION = {
  micro: 0.2,   // hover, toggle kecil
  fast:  0.3,   // tombol, tooltip
  base:  0.5,   // card, modal
  slow:  0.8,   // hero elemen
  reveal: 1.2,  // full-viewport reveal/expand
} as const;
```

Lalu **semua** tempat (Tailwind arbitrary value `duration-[var(--d-base)]`, inline `style.transition`, dan `gsap.to({ ease: EASE.out.gsap, duration: DURATION.base })`) mengambil dari sini. Ini pekerjaan mekanis tapi dampaknya besar: sekali ganti "kepribadian" animasi situs, cukup ubah di 1 file.

---

### 🟡 Temuan 3 — Dua kurva easing nyaris identik dipakai berdampingan

**Lokasi:** `src/app/page.tsx` baris ~1690–1750 (portal transition), dan `.btn-swiss` di `globals.css` baris ~40.

- Stage `'centered'` pada portal: `transition: 'all 0.52s cubic-bezier(0.16, 1, 0.3, 1)'`
- Stage `'expanding'` pada portal (component yang **sama**, transisi berikutnya): `transition: 'all 0.70s cubic-bezier(0.22, 1, 0.36, 1)'`

Dua kurva ini secara matematis sangat mirip (sama-sama "ease-out" tajam di awal, landai di akhir) tapi **tidak identik** — kemungkinan besar hasil dari sesi coding AI yang berbeda-beda tanpa cek konvensi yang sudah ada (jejaknya terlihat dari komentar `SIMON SPARKS EXACT ... 1:1 Match to Dribbble Reference` yang berulang dengan gaya berbeda-beda di `globals.css`). Ini detail kecil, tapi di transisi selicin ini, mata cukup sensitif menangkap perbedaan "rasa" antar tahap yang seharusnya terasa satu napas.

**Rekomendasi:** satukan jadi satu curve (`cubic-bezier(0.16, 1, 0.3, 1)` — karena ini yang paling banyak dipakai di komponen lain seperti `.btn-swiss`, `.bento-card-transition`, `.modal-*`) untuk semua tahap portal transition, kecuali memang ada alasan desain spesifik untuk membedakannya (kalau iya, catat alasannya di komentar kode).

---

### 🟡 Temuan 4 — `setTimeout` hardcoded, rawan desync

**Lokasi:** 10 pemakaian `setTimeout` di `page.tsx` + `work/[category]/page.tsx`, termasuk yang di Temuan 1 (`750`, `1450`, `2400`).

Pola seperti ini rapuh karena durasi animasi & durasi timer didefinisikan **terpisah** — kalau salah satu diubah (misal durasi transition CSS diperpanjang jadi 0.9s tapi lupa update angka `1450`), animasi & logic akan langsung desync tanpa ada error di console.

**Rekomendasi:** untuk animasi yang sudah pakai GSAP timeline, ganti `setTimeout` dengan callback `.eventCallback('onComplete', ...)` atau chaining `.call()` di dalam timeline yang sama. Untuk yang masih CSS transition murni, pakai event `onTransitionEnd` di elemen yang relevan, bukan angka independen.

---

### 🟠 Temuan 5 — Transisi masuk ke mode "Grid" (intro/preloader) belum ada

Ini bagian yang sudah dibahas di spec sebelumnya (`grid-reveal-transition-spec.md`) — video referensi `MKI_2026.mp4` menunjukkan sebuah **intro reveal** (kartu kecil → grid full-screen) yang belum diimplementasikan di repo. Yang **sudah ada** dan relevan:

- `work/[category]/page.tsx` **sudah punya** sistem toggle Grid ↔ Slider yang cukup canggih (`transitionDirectionRef.current === 'slider-to-grid'`, baris ~943, ~1213–1450) — ini bukti bahwa fitur "SLIDER | GRID" di video referensi **sudah sebagian dibangun**, tinggal bagian *entrance/intro pertama kali* yang belum ada.

**Rekomendasi:** sambungkan spec grid-reveal sebelumnya sebagai **entry state** dari sistem grid/slider yang sudah ada ini — bukan komponen baru yang berdiri sendiri. Idealnya, animasi reveal itu pakai container/DOM yang sama dengan grid view yang sudah di-render oleh `work/[category]/page.tsx`, bukan grid tiruan terpisah (supaya tidak ada "jahitan" antara animasi intro dan grid sungguhan yang muncul setelahnya).

---

### 🟢 Temuan 6 — Scroll physics berubah total antar route (kemungkinan disengaja)

**Lokasi:** `SmoothScrollProvider.tsx` baris ~24–33.

```ts
if (pathname.startsWith('/work/')) {
  if (lenisRef.current) { lenisRef.current.destroy(); lenisRef.current = null; }
  // "bypass Lenis so native canvas physics have full control"
  return;
}
```

Di `/`, scroll dihaluskan Lenis dengan easing eksponensial custom. Begitu pindah ke `/work/[category]`, Lenis di-`destroy()` total dan halaman itu pakai physics pan/drag custom-nya sendiri (wheel/drag handler manual, terlihat dari `wheelSnapTimeoutRef` dan logic pan di baris ~1500-an). Komentar di kode mengindikasikan ini **disengaja** (canvas custom butuh kontrol penuh atas input), jadi ini bukan bug — tapi tetap berarti **"rasa" scroll berubah drastis** tepat di titik transisi antar halaman yang seharusnya terasa satu alur. Worth di-review: apakah transisi masuk (portal / grid-reveal) bisa dipakai untuk **menutupi** momen switch physics ini (karena selama overlay penuh layar, user tidak sedang scroll, jadi pergantian physics di baliknya jadi tidak terasa) — ini justru alasan tambahan kenapa Temuan 1 & 5 penting diperbaiki dulu.

---

## 3. Rencana kerja untuk agent (urutan disarankan)

1. **Fix Temuan 1** dulu (portal transition putus) — ini bug paling kentara & paling sering dipicu user (setiap klik card kategori dari homepage).
2. **Bangun `motion-tokens.ts`** (Temuan 2) sebelum menyentuh banyak komponen lain — supaya perbaikan selanjutnya (termasuk grid-reveal dari spec sebelumnya) langsung pakai token yang benar, bukan nambah hardcode baru.
3. **Terapkan grid-reveal intro** (Temuan 5, detail lengkap di `grid-reveal-transition-spec.md`), disambungkan ke sistem grid/slider yang sudah ada di `work/[category]/page.tsx`, dan manfaatkan overlay-nya untuk "menutupi" perpindahan scroll physics (Temuan 6).
4. **Rapikan easing** (Temuan 3) & **ganti `setTimeout` jadi callback berbasis animasi asli** (Temuan 4) — best dilakukan sekalian saat menyentuh file yang sama di langkah 1 & 3, tidak perlu PR terpisah.
5. Terakhir: audit ulang seluruh `transition-*`/`duration-*` Tailwind yang belum pakai token dari langkah 2, ganti bertahap (tidak harus sekaligus — prioritaskan elemen yang paling sering dilihat user: nav, tombol utama, card hover).

---

## 4. Checklist verifikasi (dipakai agent setelah selesai coding)

- [ ] Klik card kategori dari `/` → transisi ke `/work/[category]` **tidak ada frame hilang/cut** (rekam layar, cek frame-by-frame kalau perlu)
- [ ] Navigasi cepat berulang (klik card, langsung klik back, klik lagi) tidak membuat overlay portal "nyangkut" atau dobel
- [ ] `prefers-reduced-motion: reduce` → semua transisi baru (portal fix, grid-reveal) punya fallback instan/tanpa animasi, konsisten dengan pola yang sudah ada di `scroll-locked-video-hero.tsx`
- [ ] Tidak ada lagi `cubic-bezier(...)` yang di-hardcode ulang di luar `motion-tokens.ts` untuk transisi baru yang ditulis
- [ ] Grid-reveal intro (dari spec sebelumnya) menyambung mulus ke state grid/slider yang sudah ada — tidak ada "double grid" (grid animasi lalu grid asli muncul terpisah)

---

## 5. Relasi dengan spec sebelumnya

File `grid-reveal-transition-spec.md` (dihasilkan sebelumnya) berisi breakdown teknis detail untuk **satu** transisi spesifik (intro reveal kartu kecil → grid full-screen, dari referensi video `MKI_2026.mp4`), termasuk tabel timing frame-by-frame yang sudah diukur presisi. Dokumen ini (`site-transitions-audit-and-plan.md`) adalah **konteks yang lebih luas**: di mana transisi itu harus "nyambung" ke sistem yang sudah ada, dan masalah-masalah lain di luar transisi itu yang juga perlu dibereskan supaya keseluruhan situs terasa satu alur yang rapi — bukan kumpulan efek terpisah-pisah.
