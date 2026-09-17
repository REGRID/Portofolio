# SPEC: "Grid Reveal" Intro Transition — untuk AI Coding Agent

> **Cara pakai file ini:** tempel seluruh isi file ini sebagai prompt/context ke Antigravity (atau AI coding agent lain). File ini murni berisi *logika* (breakdown visual + rencana implementasi), bukan komponen jadi — agent yang menulis kode final di dalam repo `REGRID/Portofolio`.

---

## 0. Konteks project (sudah dicek langsung dari repo `REGRID/Portofolio`)

Sebelum menulis kode apa pun, **agent wajib membaca dulu** hal-hal berikut supaya tidak membangun sistem yang duplikat/bentrok dengan yang sudah ada:

| Area | Temuan | Implikasi |
|---|---|---|
| Stack | Next.js 16 (App Router) + React 19 + Tailwind v4 + **GSAP 3.15** + **Motion (Framer Motion) 13** + Lenis | Jangan tambah library animasi baru. Pakai GSAP timeline (pola yang sudah dipakai di `src/app/page.tsx`) atau Motion, bukan CSS `@keyframes` polos untuk timeline kompleks. |
| `src/app/page.tsx` | Sudah ada **"Cinema Zoom-In Portal Transition"** — state machine `stage: 'init' \| 'centered' \| 'expanding'`, mengambil `getBoundingClientRect()` dari card yang diklik, lalu meng-animate sebuah portal `position: fixed` dari ukuran+posisi card asli menuju full-viewport, dengan tahapan `setTimeout` (750ms pause di tengah, 1450ms trigger navigasi, 2400ms cleanup). | **Pola paling dekat** dengan efek di video referensi. Transisi baru ini sebaiknya reuse struktur state-machine yang sama (3 tahap: init → hold → expand), bukan bikin state machine baru dari nol. |
| `src/app/globals.css` | Ada blok choreography lain: `--hero-opacity`, `--hero-ring-y`, dst — didokumentasikan sebagai *"1:1 Match to Dribbble Reference `original-8bb2193fbab4f9b1cac096f86b611e99.mp4` frames 68–120"*. Ada juga class util `.gsap-gpu-layer` / `[data-gsap]` / `.will-change-transform` untuk force GPU compositing. | Video referensi baru (`MKI_2026.mp4`) kemungkinan besar adalah **potongan lain dari video Dribbble yang sama** ("Portfolio / Animation" oleh Mike | Creative Mints, `dribbble.com/shots/24003762`) — kemungkinan scene "Grid" yang belum diimplementasikan. Pakai konvensi penamaan & GPU-layer class yang sama supaya konsisten. |
| `extracted_frames/pngs/` | Berisi frame dari video Dribbble sumber (scene hero 3D ring "SIMON SPARKS"), bukan scene grid. | Scene grid di video baru **belum ada breakdown-nya** di repo → breakdown di bawah ini yang jadi rujukan utama. |
| `scratch/dribbble_shot_full.md` | Konfirmasi video sumber referensi & kreator aslinya. | Sekadar attribusi, tidak perlu direplikasi 1:1 aset visualnya (pakai foto/produk milik Refo sendiri). |

**Kesimpulan konteks:** ini bukan fitur yang berdiri sendiri — ini kemungkinan besar *scene lanjutan* dari sistem transisi hero yang sedang dibangun bertahap di project ini. Sebelum coding, agent harus grep `stage:`, `zoomingPortal`, dan `--hp` / `--wp` di `page.tsx` & `globals.css` untuk memastikan penamaan baru nyambung dengan yang lama.

---

## 1. Apa yang terjadi di video referensi (`MKI_2026.mp4`, 1920×1080, 30fps, 5 detik)

Video menunjukkan **preloader/intro hero** yang membuka jadi grid portofolio penuh layar. Urutan visualnya:

1. **Frame diam** — sebuah kartu vertikal kecil (rasio potret ~3:4), background merah solid, berisi 1 foto produk, dengan `border-radius` besar (kartu "membulat"), diam **di tengah layar hitam polos**.
2. Tiba-tiba kartu itu **tumbuh** (lebar & tinggi membesar), dan begitu ukurannya membesar, area di sekitarnya mulai menyingkap sebuah **mosaic grid foto B&W (grayscale)** yang sebelumnya tersembunyi di baliknya — kartu merah tadi ternyata adalah **1 sel/cell** dari grid tersebut (posisinya persis di tengah grid).
3. Grid terus melebar sampai memenuhi seluruh viewport. Sel-sel foto lain (semua grayscale, kecuali sel tengah yang tetap merah/berwarna) ikut ter-reveal seiring container membesar.
4. Begitu full-screen, muncul UI chrome: logo "RG" kiri-atas, tagline kecil, toggle **"SLIDER | GRID"** (state "GRID" aktif/bold), tombol **"← BACK"** kanan-atas, teks hint **"GESTURES : HOLD DRAG & WHEEL SCROLL"** di tengah-bawah sel merah, dan tombol bulat kecil kiri-bawah.
5. Sisa durasi video = kondisi diam (grid sudah full, siap di-drag/scroll oleh user).

**Insight paling penting:** ini **bukan** satu foto yang di-scale (background-nya bukan blur/zoom dari 1 gambar). Ini adalah **grid mosaic ukuran penuh yang sudah "ada" sejak awal**, tapi ter-mask/tersembunyi — yang bergerak hanyalah **jendela (mask/viewport) yang membesar**, sehingga sel-sel di sekitarnya "muncul" karena kena buka, bukan karena mereka sendiri fade-in/scale-in satu-satu.

---

## 2. Data terukur (hasil ekstraksi frame video, jadi ini bukan tebakan)

### 2.1 Fase waktu

| Fase | Rentang waktu | Durasi | Apa yang terjadi |
|---|---|---|---|
| **A. Idle hold** | 0.00s → 0.53s | 0.53s | Kartu diam, ukuran ~292×380px relatif terhadap kanvas 1920px (≈ **15% lebar viewport**, aspek potret ~3:4). Radius sudut besar & jelas terlihat. |
| **B. Expand** | 0.53s → 1.67s (lebar) & → ~2.07s (tinggi) | ~1.1–1.5s | Container membesar dari ukuran kartu kecil ke full-viewport. **Lebar mencapai 100% lebih cepat daripada tinggi** (lebar selesai duluan di ~1.67s, tinggi masih menyusul sampai ~2.07s) → beri kesan "unfurl" organik, bukan scale seragam. |
| **C. Settle / UI fade-in** | ~2.0s → ~2.3s | ~0.3s | Header, toggle, tombol back, hint text fade-in (muncul setelah grid selesai membuka, bukan bersamaan). |
| **D. Static hold** | ~2.3s → 5.0s (akhir klip) | ~2.7s | Kondisi akhir, grid diam penuh layar. |

### 2.2 Kurva easing pada fase Expand (diukur per-frame, bukan estimasi)

Progress lebar container (0% = ukuran kartu awal, 100% = full width) terhadap waktu:

```
t=0.53s → 0%      (mulai)
t=1.10s → 17.7%    ← masih pelan, hampir flat
t=1.20s → 28.5%
t=1.30s → 62.4%    ← lonjakan tajam di tengah (34% progress dalam 0.1 detik!)
t=1.40s → 83.7%
t=1.50s → 92.4%
t=1.60s → 97.7%
t=1.667s → 100%    ← mendarat halus
```

Bentuk kurva ini = **flat di awal → meledak di tengah → mendarat halus di akhir**. Ini **bukan** `ease-in-out` cubic biasa (yang lebih simetris landai). Ini pola khas **`expo.inOut` atau `circ.inOut`** (istilah GSAP), atau kalau mau pakai CSS `cubic-bezier`, aproksimasi paling dekat: `cubic-bezier(0.87, 0, 0.13, 1)`.

**Rekomendasi konkret:** pakai GSAP ease `"expo.inOut"` (karena GSAP sudah jadi dependency), duration ≈ `1.15s` untuk properti lebar, dan ease yang sama untuk tinggi tapi dengan duration sedikit lebih panjang (≈ `1.35–1.5s`) atau delay tambahan ~0.1–0.15s — supaya tinggi "menyusul" lebar persis seperti di video, bukan selesai bersamaan.

### 2.3 Border-radius — insight yang menyederhanakan implementasi

Radius sudut kartu **terlihat mengecil** seiring animasi berjalan, TAPI setelah diperiksa, ini kemungkinan besar **ilusi optik**, bukan radius yang benar-benar di-animasikan terpisah:

- Radius kartu awal ≈ 24px, pada container lebar 292px → radius terlihat besar/menonjol (≈8% dari lebar).
- Radius yang sama (24px) pada container lebar 1920px → radius jadi nyaris tidak terlihat (≈1.2% dari lebar), terkesan "hilang" padahal angkanya sama.

**Rekomendasi: JANGAN animasikan `border-radius` secara terpisah.** Cukup set `border-radius: 24px` (fixed) di container dari awal sampai akhir. Efek "radius mengecil" akan muncul otomatis secara visual karena proporsi ukurannya berubah. Ini menghemat 1 properti animasi dan menghindari GSAP harus meng-interpolate radius secara manual (yang biasanya bikin animasi kurang smooth kalau di-mix dengan `transform`).

---

## 3. Pilihan pendekatan teknis (pilih salah satu — rekomendasi: **Opsi A**)

### Opsi A — Fixed full-grid + animated mask/window (SESUAI VIDEO ASLI) ✅ direkomendasikan

Grid mosaic dirender **penuh & langsung ada di DOM sejak awal**, `position: fixed; inset: 0`, tidak pernah pindah/scale. Yang di-animasikan adalah sebuah **wrapper/mask container** yang membungkus grid tsb, mulai dari ukuran kartu kecil (posisi center) → membesar ke `100vw` × `100dvh`, dengan `overflow: hidden` di wrapper itu sehingga bagian grid yang di luar wrapper otomatis tersembunyi.

- **Kelebihan:** 1:1 sama seperti video (grid "muncul" bukan "scale-in"), gampang dikontrol dengan GSAP `.to(wrapperEl, {width, height, ease: 'expo.inOut'})`.
- **Kelemahan:** harus render semua gambar grid di awal (pakai `loading="eager"` untuk beberapa yang di tengah viewport, `lazy` untuk sisanya) supaya tidak nge-lag saat reveal.

Struktur DOM (skeleton, Tailwind v4):

```tsx
// GridRevealIntro.tsx
<div className="fixed inset-0 z-[60] bg-black flex items-center justify-center pointer-events-none">
  {/* WRAPPER = elemen yang di-animate width/height-nya via GSAP */}
  <div
    ref={wrapperRef}
    className="relative overflow-hidden rounded-[24px] will-change-transform"
    style={{ width: 292, height: 380 }} // nilai awal (idle), lalu di-override GSAP
  >
    {/* GRID = full-size, TIDAK PERNAH berubah ukuran, cuma "kepotong" oleh wrapper di atas */}
    <div
      ref={gridRef}
      className="absolute grid grid-cols-6 grid-rows-3"
      style={{
        width: '100vw',
        height: '100dvh',
        // posisikan grid supaya sel tengah (index ke-11 dari 18, kolom 3 baris 2)
        // selalu berada persis di tengah viewport, terlepas dari ukuran wrapper
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      }}
    >
      {gridImages.map((img, i) => (
        <div key={i} className={i === CENTER_INDEX ? 'bg-red-600' : ''}>
          <img src={img.src} className={i === CENTER_INDEX ? '' : 'grayscale'} />
        </div>
      ))}
    </div>
  </div>
</div>
```

GSAP timeline logic (pseudocode, adaptasi dari pola `stage` yang sudah ada di `page.tsx`):

```ts
const tl = gsap.timeline({ defaults: { ease: 'expo.inOut' } });

tl.set(wrapperRef.current, { width: 292, height: 380 })      // Fase A: idle
  .to({}, { duration: 0.53 })                                 // hold, tidak ngapa-ngapain
  .to(wrapperRef.current, { width: '100vw', duration: 1.15 }, '>')      // Fase B — lebar
  .to(wrapperRef.current, { height: '100dvh', duration: 1.35 }, '<0.1') // Fase B — tinggi, mulai 0.1s setelah lebar & durasi lebih panjang → efek "menyusul"
  .to(uiChromeRef.current, { autoAlpha: 1, duration: 0.3 }, '-=0.2');   // Fase C — UI fade-in, overlap dikit sebelum expand kelar
```

Catatan: `width: '100vw'` dari state awal fixed-px berjalan mulus di GSAP karena GSAP bisa tween ke unit CSS berbeda (px → vw) — cukup pastikan wrapper *tidak* pakai Tailwind `w-*` class yang bentrok dengan inline style yang di-drive GSAP (pilih salah satu sumber kebenaran ukuran).

### Opsi B — `clip-path: inset()` alih-alih width/height

Sama seperti Opsi A, tapi wrapper full-size dari awal (`position: fixed; inset: 0`), dan yang di-animate adalah `clip-path: inset(Ytop Yright Ybottom Yleft round 24px)` dari nilai besar (misal `inset(45% 42% 45% 42% round 24px)`) ke `inset(0 0 0 0 round 24px)`.

- **Kelebihan:** tidak perlu reflow layout (clip-path murni compositing/GPU), lebih ramah performa di device rendah.
- **Kelemahan:** GSAP tidak native tween `clip-path inset()` dengan mudah (butuh plugin `CSSRulePlugin` atau manual string interpolation / pakai Motion's `clipPath` yang lebih mendukung ini secara langsung). Kalau tim mau pakai **Motion (Framer Motion)** yang juga sudah ter-install, `clip-path` string interpolation didukung out of the box dan ini jadi opsi yang lebih simpel dari Opsi A untuk kasus itu.

**Rekomendasi akhir:** pakai **Opsi A + GSAP**, karena polanya paling konsisten dengan "Cinema Zoom-In Portal Transition" yang sudah ada di `page.tsx` (yang juga animasikan width/height/position, bukan clip-path), jadi lebih gampang di-maintain sebagai satu keluarga transisi yang konsisten.

---

## 4. Hal lain yang perlu diperhatikan agent

- **`prefers-reduced-motion`**: kalau aktif, skip Fase A+B, langsung set wrapper ke ukuran full & UI chrome `autoAlpha: 1` tanpa animasi (pola ini konsisten dengan cek `reduceMotion` yang sudah dilakukan di `scroll-locked-video-hero.tsx`).
- **Responsif mobile**: rasio grid 6 kolom × 3 baris di video adalah untuk desktop landscape. Di mobile, pertimbangkan grid lebih sempit (misal 3 kolom) atau tetap 6 kolom tapi dengan sel lebih kecil — ukuran idle-card tetap proporsional relatif (`~15vw`, bukan px fixed) supaya nyaman di semua breakpoint.
- **Preload gambar sel tengah** (gambar yang ada di dalam kartu idle) harus sudah fully loaded *sebelum* Fase A dimulai, supaya tidak ada flash/pop-in saat kartu pertama kali muncul.
- **Trigger transisi ini**: di video, ini terlihat seperti intro/preloader saat pertama kali masuk halaman "Work" atau saat toggle ke mode "Grid" (ada toggle "SLIDER | GRID" di UI). Konfirmasikan ke Refo apakah ini dipakai sebagai **preloader saat page-load pertama** (jalan sekali, lalu tidak lagi) atau **transisi setiap kali user pindah dari Slider-view ke Grid-view** di halaman `/work/[category]` — ini menentukan apakah animasi perlu logic "hanya sekali per session" (pakai `sessionStorage` flag) atau bisa di-replay berkali-kali.
- **Teks UI chrome** ("GESTURES: HOLD DRAG & WHEEL SCROLL", toggle SLIDER/GRID, dst) di video adalah placeholder dari referensi Dribbble — sesuaikan copy-nya dengan konten portofolio Refo sendiri (kategori: COMMERCIAL / NARRATIVE / MUSIC VIDEO / EVENT & REEL, sesuai `CATEGORY_DATA` yang sudah ada).

---

## 5. Ringkasan angka siap pakai

```
Idle card       : ~15vw wide, aspect ~3:4, border-radius: 24px (fixed, tidak dianimasikan)
Hold sebelum expand : 0.53s
Expand width    : 1.15s, ease: expo.inOut, mulai setelah hold
Expand height   : 1.35s, ease: expo.inOut, mulai 0.1s setelah width mulai (overlap, "<0.1" di GSAP)
UI chrome fade-in : 0.3s, mulai ~0.2s sebelum expand kelar (overlap)
Total durasi transisi : ~2.0–2.3s dari trigger sampai settle
```
