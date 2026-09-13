# Rencana Desain — Portofolio Refo Ganggawasa Utomo

## 1. Ringkasan Proyek

| Item | Detail |
|---|---|
| Nama | Refo Ganggawasa Utomo |
| Profesi | Video Editor & Videografer |
| Usaha sampingan | Perkara Kopi (cafe) |
| Tujuan situs | Portofolio profesional untuk menampilkan hasil kerja video |
| Tech stack | Next.js, database sendiri, hosting di VPS pribadi |
| Tools desain/coding | Antigravity (LLM coding agent) + Taste Skill (design-taste-frontend) |

## 2. Konsep Besar: "Galeri Gelap untuk Karya Ceria"

Situs berperan sebagai **shell/galeri sinematik gelap** yang membingkai portofolio video yang secara alami berwarna dan ceria — mirip museum berdinding netral gelap yang membuat karya berwarna lebih menonjol.

- **Shell (wadah situs):** dark, cinematic, elegan, profesional
- **Isi (thumbnail/video):** dibiarkan tampil dengan warna asli yang ceria/fun
- **Prinsip:** kontras ini disengaja, bukan inkonsistensi — dibingkai sebagai identitas ("tenang di luar, penuh warna di dalam")

## 3. Arah Visual (Mood & Style)

- **Warna dasar:** hitam/abu sangat gelap (hindari pure black), bukan `#000000`
- **Aksen warna:** satu warna signature (emas tua / tembaga) untuk elemen UI (tombol, garis, hover) — bukan dari isi video
- **Tipografi:** serif elegan untuk judul (kesan editorial-premium) + sans-serif bersih untuk body text
- **Framing thumbnail:** padding/border gelap tipis di sekitar tiap thumbnail video agar warna ceria "terbingkai", tidak liar
- **Motion:** transisi halus (fade, zoom ringan saat hover), overlay gelap yang memudar sebelum video/preview warna muncul penuh
- **Referensi mood untuk brief ke Antigravity:** *cinematic dark portfolio, editorial serif typography, gold/copper accent, minimalist gallery frame, contrast-driven color reveal*

## 4. Struktur Halaman (Homepage)

1. **Hero**
   - Nama besar (serif) + tagline profesional
   - Background video muted looping atau foto sinematik gelap

2. **Showreel**
   - Satu video showreel utama, full-width, jadi centerpiece pertama

3. **Galeri Project**
   - Grid thumbnail video dengan hover effect (zoom halus + judul muncul)
   - Filter kategori (wedding, komersial, dokumenter, musik, dll)
   - Klik → halaman detail `/project/[slug]` (video, deskripsi, klien, tahun)

4. **Tentang**
   - Narasi personal perjalanan sebagai videografer
   - Selipkan **Perkara Kopi** sebagai bagian identitas — bukan iklan cafe, tapi cerita "visual, rasa, dan cerita bertemu"

5. **Kontak/Booking**
   - Form (nama, email, jenis project, pesan)
   - CTA elegan + link sosial media/WhatsApp

## 5. Cara Menyatukan Tema Gelap dengan Konten Ceria

| Elemen | Perlakuan |
|---|---|
| Background, navigasi, whitespace | Tetap gelap & elegan |
| Thumbnail & preview video | Warna asli dibiarkan tampil (tidak di-dark-mode-kan) |
| Border/frame di sekitar thumbnail | Netral gelap, jadi "bingkai galeri" |
| Aksen UI (tombol, highlight) | Ambil 1–2 warna dominan dari portofolio sebagai aksen kecil |
| Copywriting hero/tentang | Bingkai kontras sebagai kekuatan personal brand |

## 6. Catatan untuk Brief ke Antigravity (Taste Skill sudah terpasang)

Brief singkat yang bisa dipakai:

> "Portofolio videografer profesional (Refo Ganggawasa Utomo). Tema dark cinematic-elegan sebagai shell/galeri situs, tetapi konten video di dalamnya berwarna ceria/fun. Desain harus membingkai kontras ini secara sengaja — dark UI sebagai galeri premium yang membuat karya berwarna menonjol, bukan menyeragamkan semua jadi gelap. Terapkan dark mode protocol untuk kontras & hierarki yang konsisten. Sertakan bagian showreel utama, galeri project dengan filter kategori, dan bagian tentang yang menyelipkan cerita usaha cafe (Perkara Kopi) sebagai bagian identitas personal."

## 7. Langkah Selanjutnya (belum dibahas detail)

- [ ] Arsitektur folder Next.js (App Router, komponen, lib)
- [ ] Skema database untuk data video (tabel projects, dsb)
- [ ] Strategi penyimpanan file video (VPS folder / object storage)
- [ ] Setup environment VPS (Node.js, database, Nginx, PM2)
- [ ] Alur deployment (Git → VPS)
