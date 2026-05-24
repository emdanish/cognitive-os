import type { Metadata, Viewport } from "next";
import { Inter, Sora, Space_Grotesk, Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { Nav } from "@/components/nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "Cognitive OS — turn information into leverage",
  description:
    "A personal AI-powered self-improvement engine. Turn high-signal content into structured insights, frameworks, and execution.",
  applicationName: "Cognitive OS",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sora.variable} ${spaceGrotesk.variable} ${manrope.variable}`}
    >
      <body className="min-h-screen font-sans antialiased no-tap-highlight">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="relative min-h-screen">
            <div className="pointer-events-none fixed inset-0 -z-10 gradient-mesh" />
            <Nav />
            <main className="container mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
              {children}
            </main>
          </div>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
