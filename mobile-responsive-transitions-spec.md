# SPEC: Responsivitas Handphone untuk Semua Transisi — untuk AI Coding Agent

> **Cara pakai file ini:** tempel ke Antigravity sebagai lanjutan dari 2 file sebelumnya (`grid-reveal-transition-spec.md` dan `site-transitions-audit-and-plan.md`). Isinya: audit konkret bagian mana dari sistem transisi yang **belum jalan/pecah di HP**, plus penyesuaian yang perlu dibuat — bukan bikin sistem terpisah, tapi mengadaptasi yang sudah ada & yang direncanakan di 2 file sebelumnya.

---

## 0. Ringkasan: apa yang sudah aman di HP, apa yang belum

| Bagian | Status di HP | Bukti |
|---|---|---|
| Bento card kategori di homepage (`page.tsx`) | ✅ Sudah responsif | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, banyak `sm:` variant (74 pemakaian breakpoint di file ini) |
| Portal transition — stage `'centered'` | 🟡 Sebagian aman | Sudah pakai `clamp(320px, 34vw, 480px)` — relatif, tapi belum dicek di layar sangat sempit (lihat Temuan 3) |
| Portal transition — stage `'expanding'` | 🔴 Berpotensi glitch di HP | Pakai `100vh` literal, bukan `100dvh` (Temuan 1) |
| Preview "unroll" saat hover card kategori | 🔴 Tidak pernah muncul di HP | Trigger-nya cuma `onMouseEnter`, tidak ada fallback sentuh (Temuan 2) |
| Canvas Grid/Slider di `work/[category]/page.tsx` | 🔴 Didesain murni untuk desktop | `TILE_WIDTH/HEIGHT` & `SLIDER_CARD_WIDTH/HEIGHT` adalah **angka px tetap**, cuma 6 pemakaian breakpoint di file 2261 baris (Temuan 4) |
| Semua `@keyframes`/`.animate-*`/`.modal-*`/`.bento-*` di `globals.css` | 🔴 Nol penyesuaian mobile | Cuma **1** `@media` di seluruh file (844 baris), dan itu untuk `prefers-reduced-motion`, bukan breakpoint ukuran layar (Temuan 5) |
| Grid-reveal intro (rencana dari spec sebelumnya) | ⚠️ Perlu disesuaikan sebelum dibangun | Direncanakan 6 kolom × 3 baris untuk layar lebar — belum ada versi mobile (Temuan 6) |
| Safe-area (notch / home-indicator iPhone) | 🔴 Belum ditangani sama sekali | Nol pemakaian `env(safe-area-inset-*)` di seluruh project (Temuan 7) |

---

## 1. Temuan & perbaikan detail

### 🔴 Temuan 1 — `100vh` bikin address bar browser mobile "loncat"

**Lokasi:** `src/app/page.tsx` baris ~1710, stage `'expanding'` pada portal transition (`height: zoomingPortal.stage === 'expanding' ? ... : '100vh'`).

**Masalah:** di Safari iOS / Chrome Android, `100vh` dihitung dari tinggi viewport **termasuk** area di belakang address bar, bukan tinggi yang benar-benar terlihat. Begitu address bar collapse/expand saat scroll (perilaku default browser mobile), elemen dengan `height: 100vh` bisa terlihat "loncat" atau menyisakan celah hitam di bawah.

**Perbaikan:** ganti `100vh` → **`100dvh`** (dynamic viewport height, sudah didukung semua browser modern & sudah direkomendasikan juga di `grid-reveal-transition-spec.md` untuk komponen barunya — jadi tinggal disamakan di sini juga supaya konsisten satu project).

```diff
- height: zoomingPortal.stage === 'expanding' ? '100vh' : ...
+ height: zoomingPortal.stage === 'expanding' ? '100dvh' : ...
```

---

### 🔴 Temuan 2 — Preview "unroll" card kategori tidak pernah muncul di HP

**Lokasi:** `src/app/page.tsx` baris ~1061 — `onMouseEnter={() => setActiveCardIndex(card.id)}`.

**Masalah:** state `isActive` (yang mengontrol animasi unroll artwork, perubahan `min-height` card, fade monogram) **hanya** dipicu oleh `onMouseEnter`. Di layar sentuh, event ini tidak pernah terjadi — jadi seluruh animasi `.bento-card-transition` / `.bento-artwork-slider` / `.bento-monogram-slider` (yang sudah dibuat cukup detail di `globals.css`) **mati total di HP**, dan user langsung lompat ke navigasi begitu tap (lewat `onClick={handleCardCategoryClick}`) tanpa pernah melihat preview-nya.

**Ini bukan otomatis "salah"** — tap-langsung-navigasi itu wajar untuk mobile. Tapi perlu **keputusan sadar**, bukan default browser yang kebetulan begitu:

**Rekomendasi (pilih A, lebih simpel & standar untuk portofolio mobile):**
- **A. Biarkan tap = langsung navigasi** (skip preview di HP secara sengaja), tapi tambahkan guard `@media (hover: hover) and (pointer: fine)` di CSS supaya style `hover:` tidak ninggalin residu "sticky hover" di iOS Safari (bug umum: setelah tap, elemen kadang "nyangkut" di state hover sampai user tap di tempat lain). Contoh guard di `globals.css`:

```css
@media (hover: hover) and (pointer: fine) {
  .bento-anim-card:hover { /* style hover yang sekarang cuma pakai .hover\: Tailwind */ }
}
```

  Untuk Tailwind, cara paling praktis: pastikan semua `hover:` state yang berhubungan dengan card ini idealnya dikontrol lewat `isActive` (state React), bukan CSS `:hover` murni — karena `isActive` sudah dites secara eksplisit lewat `onMouseEnter`, sehingga otomatis "netral" di HP (tidak pernah true) tanpa perlu media query tambahan. Cek dulu apakah ada `hover:` class lain di card yang sama yang TIDAK lewat `isActive` (murni CSS `:hover`) — itu yang paling berisiko sticky-hover.

- **B. (Kalau preview dianggap konten penting)** first-tap = preview, second-tap = navigasi. **Tidak disarankan** untuk kartu navigasi utama — pola ini butuh instruksi visual tambahan ("tap again to open") yang bikin interaksi berat sebelah dibanding versi desktop.

---

### 🔴 Temuan 4 — Canvas Grid/Slider di halaman Work murni didesain untuk desktop

**Lokasi:** `src/app/work/[category]/page.tsx` baris ~83–92.

```ts
const TILE_WIDTH = 345;
const TILE_HEIGHT = 475;
const SLIDER_CARD_WIDTH = 450;
const SLIDER_CARD_HEIGHT = 620;
```

**Masalah:** ini angka px **tetap**, tidak dihitung dari lebar viewport. Di iPhone SE (layar 375px lebar):
- Mode **Slider**: 1 card lebar 450px **lebih lebar dari layar itu sendiri** → card kepotong / tidak pernah terlihat utuh.
- Mode **Grid**: tile 345px hampir memenuhi seluruh lebar layar (375px) sendirian → user cuma bisa lihat < 1.1 kolom sekaligus, terasa seperti scroll horizontal sempit yang aneh, bukan "grid" yang sebenarnya.

File ini juga cuma punya 6 pemakaian breakpoint Tailwind di 2261 baris — nyaris semua ukuran & posisi dihitung manual lewat matematika `STEP_X`/`STEP_Y`/`SLIDER_STRIDE` (bukan CSS responsif), jadi perbaikannya **tidak cukup** cuma nambah `sm:`/`md:` class — konstanta-konstanta ini sendiri perlu jadi dinamis.

**Rekomendasi:**

```ts
// Ganti konstanta tetap dengan hook yang baca lebar viewport & recalculate saat resize
function useResponsiveTileSize() {
  const [size, setSize] = useState(() => getTileSizeForWidth(
    typeof window !== 'undefined' ? window.innerWidth : 1440
  ));

  useEffect(() => {
    const onResize = () => setSize(getTileSizeForWidth(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

function getTileSizeForWidth(vw: number) {
  if (vw < 480)  return { tile: { w: 260, h: 358 }, slider: { w: 300, h: 413 } }; // HP kecil
  if (vw < 768)  return { tile: { w: 300, h: 413 }, slider: { w: 340, h: 468 } }; // HP besar/phablet
  if (vw < 1024) return { tile: { w: 320, h: 440 }, slider: { w: 400, h: 551 } }; // tablet
  return          { tile: { w: 345, h: 475 }, slider: { w: 450, h: 620 } };        // desktop (nilai asli, tidak berubah)
}
```

Aspek rasio (345:475 ≈ 450:620 ≈ 0.726) **dipertahankan** di semua ukuran supaya foto tidak gepeng/melar — cuma skalanya yang turun. Konstanta `TILE_GAP = 0` (mosaic edge-to-edge) bisa tetap 0 di semua ukuran, itu bukan masalah mobile.

Setelah tile size jadi dinamis, semua turunannya (`STEP_X`, `STEP_Y`, `BLOCK_WIDTH`, `BLOCK_HEIGHT`, `SLIDER_STRIDE`) otomatis ikut menyesuaikan karena sudah dihitung dari konstanta ini (baris ~86–92, ~354–356) — jadi tidak perlu menyentuh logic pan/snap/infinite-wrap-nya sama sekali, cukup ganti sumber angkanya.

**Catatan bagus:** logic drag/pan-nya sendiri (`onPointerDown`/`onPointerMove`/`onPointerUp`, baris ~1460–1605) **sudah** pakai Pointer Events API, yang otomatis cross-device (mouse **dan** sentuhan) — bagian ini tidak perlu diubah, cuma ukurannya yang perlu jadi responsif.

---

### 🔴 Temuan 5 — Animasi CSS di `globals.css` tidak punya penyesuaian breakpoint sama sekali

**Bukti:** dari 844 baris `globals.css` dengan belasan `@keyframes` (`ring-progress-fill`, `bentoBottomBarGlow`, `modalCardSlideIn`, `t-shimmer`, dll), cuma **satu** `@media` query di seluruh file — untuk `prefers-reduced-motion`. Tidak ada satupun penyesuaian untuk layar sempit.

**Kenapa ini penting:** beberapa animasi didesain dengan jarak gerak (`translateY`, ukuran shadow/glow) yang dikalibrasi untuk elemen desktop yang lebih besar. Di layar HP yang lebih kecil, jarak gerak yang sama bisa terasa "berlebihan" relatif terhadap ukuran elemen (misal card lebih kecil tapi translateY tetap 380px seperti terlihat di `gsap.set(topRowEls, { y: -380 })` — proporsinya jadi tidak sama).

**Rekomendasi (tidak perlu ubah semua sekaligus):**
1. Untuk animasi CSS murni (`@keyframes` di atas): cek satu-satu mana yang pakai jarak absolut besar (px), pertimbangkan ganti ke unit relatif (`%`, `em`) atau breakpoint-kan nilainya.
2. Untuk animasi GSAP (`gsap.set`/`gsap.to` dengan `y: -380` dkk di `page.tsx`/`work/[category]/page.tsx`): jarak gerak bisa dihitung dari ukuran elemen aslinya (`el.offsetHeight`) alih-alih angka tetap, supaya otomatis proporsional di semua ukuran layar tanpa perlu breakpoint manual sama sekali — ini pendekatan yang lebih tahan lama daripada nulis ulang angka per breakpoint.

---

### ⚠️ Temuan 6 — Grid-reveal intro (spec sebelumnya) perlu versi mobile

Spec `grid-reveal-transition-spec.md` merekomendasikan grid **6 kolom × 3 baris** dengan idle card ~15vw, berdasarkan video referensi yang direkam di kanvas 1920×1080 (desktop landscape). Ini **perlu disesuaikan** untuk HP:

- **6 kolom di layar 375px lebar** = tiap sel cuma ~62px — foto jadi terlalu kecil untuk terlihat jelas, dan teks/detail di dalamnya (kalau ada) tidak terbaca.
- **Rekomendasi kolom per breakpoint** (pola umum untuk grid mosaic responsif):

```
< 480px (HP kecil)   : 3 kolom × 5 baris  (tetap 15 sel biar totalnya mirip, cuma re-flow)
480–768px (HP besar) : 4 kolom × 4 baris
768–1024px (tablet)  : 5 kolom × 3 baris
≥ 1024px (desktop)   : 6 kolom × 3 baris  (sesuai video referensi asli, tidak berubah)
```

- **Idle card (kartu kecil sebelum expand):** tetap pakai satuan relatif (`~15vw` seperti di spec awal) supaya otomatis proporsional, TAPI beri `min-width`/`min-height` px supaya di layar sangat sempit kartu tidak jadi terlalu kecil untuk dilihat jelas — misal `width: clamp(140px, 15vw, 400px)`.
- **Timing animasi (durasi 1.15s/1.35s dari spec awal):** boleh **dipercepat sedikit** di HP (misal ×0.85, jadi ~1.0s/1.15s) — karena jarak tempuh piksel yang harus di-cover lebih pendek di layar kecil, durasi yang sama akan terasa lebih "lambat" secara relatif kalau tidak disesuaikan. Gunakan `matchMedia('(max-width: 768px)')` untuk pilih preset durasi mobile vs desktop di GSAP timeline yang sama.

---

### 🔴 Temuan 7 — Safe-area (notch / home indicator) belum ditangani

**Bukti:** nol pemakaian `env(safe-area-inset-top/bottom/left/right)` di seluruh project.

**Masalah:** elemen UI chrome full-screen (header "RG"/logo, tombol "← BACK", toggle "SLIDER | GRID" dari grid-reveal intro, dan portal transition yang full-viewport) berisiko **ketutup notch/dynamic island** di bagian atas, atau **ketutup home-indicator bar** di bagian bawah, pada iPhone modern (X ke atas) saat dibuka tanpa browser chrome (misal ditambahkan ke Home Screen sebagai PWA, atau di beberapa mode fullscreen browser).

**Rekomendasi:** tambahkan padding via `env()` pada elemen UI chrome yang menempel di tepi layar:

```css
.ui-chrome-top {
  padding-top: max(1rem, env(safe-area-inset-top));
}
.ui-chrome-bottom {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

Dan pastikan `<meta name="viewport" content="viewport-fit=cover">` sudah ada di `layout.tsx` (cek dulu — kalau belum, `env()` di atas tidak akan aktif sama sekali karena browser masih pakai layout mode lama).

---

## 2. Touch target & interaksi — checklist tambahan

- **Ukuran target sentuh minimum 44×44px** (standar Apple HIG / Material Design) untuk semua tombol kecil yang sebelumnya didesain untuk mouse — cek terutama tombol "← BACK" dan toggle "SLIDER | GRID" dari grid-reveal intro, serta tombol bulat kecil kiri-bawah yang terlihat di video referensi (Temuan ini menyambung ke `grid-reveal-transition-spec.md` bagian 4).
- **Gesture hint text** ("GESTURES: HOLD DRAG & WHEEL SCROLL" dari video referensi) — teks ini asumsi input desktop (wheel scroll). Untuk HP, ganti copy-nya jadi instruksi sentuh yang sesuai (misal "SWIPE TO EXPLORE"), jangan tampilkan teks yang mengasumsikan mouse/wheel.
- **`pointer: coarse` vs `pointer: fine`:** untuk elemen yang perilakunya perlu benar-benar berbeda antara sentuh & mouse (bukan cuma ukuran), pakai media feature ini, bukan deteksi lebar layar — karena tablet dengan stylus/trackpad tetap punya `pointer: fine` meski layar lebar "terasa mobile".

---

## 3. Ringkasan rencana kerja (urutan disarankan, menyambung ke `site-transitions-audit-and-plan.md`)

1. Fix cepat, dampak langsung: `100vh` → `100dvh` (Temuan 1), tambah `viewport-fit=cover` + `env(safe-area-inset-*)` (Temuan 7). Kerjakan bareng saat memperbaiki Temuan 1 di audit sebelumnya (sama-sama menyentuh blok portal transition).
2. Putuskan & implementasikan perilaku card kategori di HP (Temuan 2) — pilih Opsi A (tap langsung navigasi, guard sticky-hover).
3. Buat `getTileSizeForWidth()` + `useResponsiveTileSize()` untuk canvas Grid/Slider (Temuan 4) — ini pekerjaan paling besar tapi paling penting, karena tanpa ini halaman `/work/[category]` secara fungsional rusak di HP, bukan cuma "kurang rapi".
4. Bangun grid-reveal intro (dari spec pertama) **langsung dengan** breakpoint kolom responsif (Temuan 6) — jangan bangun versi desktop dulu baru di-retrofit, supaya struktur datanya dari awal fleksibel jumlah kolom.
5. Terakhir, sisir `globals.css` (Temuan 5) — prioritaskan animasi yang paling sering dilihat (bento card, modal) dulu, sisanya bertahap.

---

## 4. Checklist verifikasi (tambahan khusus mobile)

- [ ] Test di lebar viewport 375px (iPhone SE), 390px (iPhone standar), dan 360px (Android umum) — bukan cuma resize browser desktop, idealnya device emulation DevTools dengan touch simulation aktif
- [ ] Portal transition & grid-reveal intro dites dengan address bar Safari iOS dalam kondisi *expanded* maupun *collapsed* (scroll dulu sebelum trigger) — pastikan tidak ada celah/jump
- [ ] Tap cepat berulang pada card kategori di HP tidak memicu sisa state `hover`/`isActive` yang nyangkut
- [ ] Mode Slider & Grid di `/work/[category]` menampilkan tile utuh (tidak terpotong tepi layar) di lebar 375px
- [ ] Semua tombol/toggle UI chrome ≥ 44×44px area sentuh, dan tidak tertutup notch/home-indicator di iPhone 14/15 Pro
- [ ] `prefers-reduced-motion` **dan** ukuran layar kecil bisa aktif bersamaan tanpa konflik (reduced-motion tetap prioritas tertinggi, menimpa preset durasi mobile manapun)
