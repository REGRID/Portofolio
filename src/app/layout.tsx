import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "lenis/dist/lenis.css";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import { GridTransitionProvider } from "@/components/GridTransitionProvider";

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Refo Ganggawasa Utomo — Video Editor & Videographer | Portfolio",
  description:
    "Portofolio profesional Refo Ganggawasa Utomo — Video Editor & Videografer. Menghadirkan ritme editorial presisi, visual sinematik, dan standar pascaproduksi industri. Terbuka untuk posisi Full-Time, In-House, dan Peran Kunci.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${cormorant.variable} ${plusJakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#050814] text-[#f1f5f9] selection:bg-cyan-500/30 selection:text-cyan-200">
        <SmoothScrollProvider>
          <GridTransitionProvider>
            {children}
          </GridTransitionProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
