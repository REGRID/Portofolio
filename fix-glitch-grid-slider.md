# Fix: Glitch Foto saat Transisi Grid ↔ Slider

**Target:** `regrid.web.id/work/music-video`
**Gejala:** Saat berpindah dari view `grid` ke `slider` (atau sebaliknya), foto kadang muncul glitch/flash sesaat sebelum stabil.

> Catatan: dokumen ini disusun dari analisis struktur HTML halaman (bukan source code asli), karena source React/Next.js komponennya tidak bisa diakses lewat fetch biasa. Gunakan ini sebagai checklist investigasi awal — sesuaikan dengan nama file/komponen asli di project.

---

## Temuan awal dari struktur halaman

Setiap card gambar di halaman ini di-render dengan **2 elemen `<img>`** yang src-nya sama:
- Satu dengan `alt` text (judul karya)
- Satu tanpa `alt` (kemungkinan layer blur-up / placeholder / duplikat untuk efek crossfade)

Pola dua-layer seperti ini adalah penyebab paling umum dari glitch saat transisi state, kalau timing opacity/z-index antar layer tidak disinkronkan dengan benar.

---

## Kemungkinan penyebab, urut dari paling mungkin

### 1. Key prop tidak unik / berubah saat switch view
Kalau komponen `<img>` di grid dan slider menggunakan `key` yang sama antar item, atau tidak pakai `key` sama sekali, React akan **reuse DOM node** lalu memaksa ganti `src`. Browser sempat menampilkan frame lama sebelum gambar baru selesai decode.

**Cek:**
```
grep -rn "map(" src/components --include=*.tsx | grep -i "grid\|slider\|gallery"
```
Pastikan setiap item punya `key={item.id}` yang stabil dan **sama** baik di render grid maupun slider (bukan `key={index}`).

### 2. Gambar slider belum di-preload sebelum transisi jalan
Kalau ukuran/crop gambar di slider beda dari grid, browser harus fetch ulang saat transisi mulai → sempat blank/flicker.

**Fix yang disarankan:**
- Preload gambar aktif + 1 gambar sebelum/sesudahnya begitu `view` berubah, sebelum animasi dimulai.
- Gunakan `<link rel="preload" as="image">` atau `new Image()` di `useEffect` yang trigger saat index slider berubah.

### 3. FLIP / shared-element animation membaca rect sebelum layout settle
Kalau transisi grid→slider berupa "morph" (posisi card meluncur ke posisi slider), animasi biasanya pakai teknik FLIP (`getBoundingClientRect`). Kalau rect diambil sebelum image natural size ter-apply ke layout, hasil animasi "loncat".

**Fix yang disarankan:**
- Ambil `getBoundingClientRect()` setelah `requestAnimationFrame` ganda (`raf(() => raf(() => {...}))`), bukan langsung setelah state berubah.
- Pastikan container gambar punya `aspect-ratio` tetap (CSS) supaya layout tidak shift saat gambar baru selesai load.

### 4. Dua layer gambar (crossfade) tidak sinkron
Sesuai temuan di atas — kalau ada 2 elemen `<img>` bertumpuk untuk efek crossfade/blur-up, cek:
- Apakah opacity layer atas dan bawah transisinya pakai `transition` CSS yang sama durasinya?
- Apakah kedua layer di-mount/unmount bersamaan, atau salah satu telat karena conditional render terpisah?

**Fix yang disarankan:**
- Satukan kontrol opacity kedua layer dalam satu state/variable, jangan dua `useState` terpisah yang bisa update di frame berbeda.

### 5. View switching tidak menunggu animasi keluar (exit) selesai
Kalau grid unmount duluan sebelum slider selesai mount+animasi masuk, ada celah render kosong yang keliatan seperti glitch.

**Fix yang disarankan:**
- Gunakan library seperti `framer-motion` `<AnimatePresence mode="wait">` (atau setara) supaya exit animation grid selesai dulu sebelum slider mulai animasi masuk — atau overlap dengan crossfade yang terkontrol.

---

## Langkah investigasi untuk dijalankan Antigravity CLI

1. Cari komponen yang mengatur state `view` (`grid` | `slider`) — biasanya di halaman `work/[slug].tsx` atau context/provider terpisah.
2. Cari komponen yang me-render `<img>` untuk grid dan slider — cek apakah keduanya share komponen `<ImageCard>` yang sama atau ditulis terpisah.
3. Cek apakah ada dua elemen `<img>` per item (sesuai temuan di atas) dan jelaskan fungsi masing-masing.
4. Cek penggunaan `key` di semua `.map()` yang me-render gambar.
5. Cek apakah ada preload logic untuk gambar sebelum switch view.
6. Cek animasi transisi: native CSS transition, atau library (`framer-motion`, `gsap`, dll)?
7. Terapkan fix sesuai poin 1–5 di atas berdasarkan root cause yang ditemukan.
8. Test manual: toggle grid ↔ slider berkali-kali cepat (rapid click) untuk memastikan tidak ada race condition tersisa.

---

## Prioritas fix (kalau root cause belum jelas)

1. Perbaiki `key` prop dulu — paling sering jadi biang keladi dan paling murah untuk di-fix.
2. Tambahkan preload gambar sebelum transisi.
3. Baru masuk ke tuning animasi (FLIP timing / crossfade sync) kalau glitch masih muncul setelah #1 dan #2.
