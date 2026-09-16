# Fix: Posisi Elemen `fixed` Berubah Setelah Keluar dari Page Detail Work

**Target:** `regrid.web.id/work` → masuk ke salah satu project (misal `/work/music-video`) → kembali ke `/work`
**Gejala:** Posisi elemen yang seharusnya `position: fixed` (section/nav/kontrol) berubah setelah balik dari halaman detail, tidak sama seperti kondisi saat halaman `/work` di-refresh langsung.

---

## Root cause paling mungkin: `position: fixed` di dalam ancestor ber-`transform`

Menurut spesifikasi CSS, `position: fixed` seharusnya selalu relatif ke **viewport**. Tapi ada pengecualian: kalau ada **ancestor** (parent/leluhur) dari elemen itu yang punya salah satu dari properti berikut **aktif**:

- `transform` (termasuk `translateX/Y`, `scale`, dll — bukan cuma `transform: none`)
- `filter`
- `perspective`
- `will-change: transform`

...maka elemen `fixed` di dalamnya berubah jadi relatif ke ancestor tersebut, bukan viewport lagi (ancestor itu jadi "containing block" baru).

### Kenapa baru kelihatan setelah masuk-keluar page detail?
Page-transition (misalnya `framer-motion` `AnimatePresence`, atau custom animated route wrapper di Next.js) hampir selalu memakai `transform` di wrapper halaman untuk animasi slide/fade masuk-keluar. Kalau elemen `fixed` itu **nested di dalam** wrapper transisi ini (bukan ditaruh di root layout, di luar animasi):

1. Saat pertama kali refresh di `/work`, wrapper belum pernah di-animate → belum ada `transform` aktif → posisi `fixed` normal, relatif ke viewport.
2. Saat masuk ke page detail, wrapper animasi jalan (transform diterapkan untuk transisi keluar/masuk).
3. Balik ke `/work` lagi — kalau transform di wrapper **tidak benar-benar direset ke `none`** (bukan cuma `translateX(0)`, karena itu tetap membuat containing block baru), elemen `fixed` di dalamnya tetap "nyangkut" relatif ke wrapper tsb → posisinya jadi beda dari kondisi refresh murni.

---

## Kemungkinan penyebab tambahan (sering bareng root cause di atas)

### Scroll position tidak direset saat navigasi
Next.js App Router (atau router lain) kadang tidak scroll-to-top otomatis, atau ada logic manual restore scroll yang salah timing. Ini bisa bikin section keliatan "geser" padahal sebenarnya cuma scroll offset yang beda dari saat refresh (yang selalu mulai dari atas).

### `will-change: transform` yang ditinggal aktif
Kalau animasi library set `will-change: transform` untuk optimasi performa lalu tidak di-cleanup setelah animasi selesai, elemen itu tetap jadi containing block untuk `fixed` di dalamnya — walau secara visual sudah tidak ada transform yang terlihat berjalan.

---

## Langkah investigasi untuk dijalankan Antigravity CLI

1. Cari elemen dengan `position: fixed` di codebase (CSS/Tailwind `fixed`) yang terkait section/nav/kontrol yang dimaksud:
   ```
   grep -rn "position:\s*fixed\|className=.*\bfixed\b" src
   ```
2. Untuk tiap hasil, telusuri **semua ancestor**-nya (parent komponen) sampai ke root layout — cek apakah ada salah satu yang:
   - Dibungkus `motion.div`, `AnimatePresence`, atau custom page-transition wrapper.
   - Punya `transform`, `filter`, `perspective`, atau `will-change: transform` di CSS/inline style/className.
3. Kalau ketemu, cek apakah wrapper transisi tsb benar-benar reset transform ke `none` (hilang total dari computed style) setelah animasi selesai — bukan cuma `translate(0,0)`.
4. Cek konfigurasi scroll restoration di router (manual `scrollTo(0,0)` saat route change, atau `scrollRestoration` setting).
5. Bandingkan computed style elemen `fixed` tsb via DevTools:
   - Kondisi A: refresh langsung di `/work`.
   - Kondisi B: masuk ke page detail lalu kembali ke `/work`.
   - Diff `top`/`left`/`transform`/containing block-nya di dua kondisi ini untuk konfirmasi root cause.

---

## Fix yang disarankan (urut prioritas)

1. **Pindahkan elemen `fixed` ke root layout**, di luar komponen yang dibungkus page-transition wrapper — ini fix paling reliable karena elemen jadi benar-benar tidak pernah berada di dalam ancestor yang kena transform.
2. Kalau tidak bisa dipindah (misal butuh unmount/remount sesuai halaman), pastikan wrapper animasi:
   - Set transform balik ke `none` sepenuhnya setelah transisi selesai (via `onAnimationComplete` / `onExitComplete`), atau
   - Ganti strategi animasi dari `transform` ke kombinasi `opacity` + `position`/`inset` yang tidak memicu containing block baru.
3. Tambahkan reset scroll eksplisit (`window.scrollTo(0, 0)` atau setara) saat navigasi balik ke halaman list, supaya kondisi visual konsisten dengan refresh murni.
4. Pastikan `will-change: transform` di-cleanup (dihapus dari style) setelah animasi selesai, bukan dibiarkan permanen.
