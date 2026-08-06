import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/**
 * One family, two widths.
 *
 * Geist carries everything — interface, headings, and the wordmark. It is a
 * neutral grotesque drawn for screens, with the tight apertures and even colour
 * that keep dense UI legible, and it takes optical tracking at heading sizes
 * without falling apart. Deliberately a single family: the earlier build paired
 * a serif display face against the UI sans, which read as editorial. An
 * engineered product should look like it was set by one hand.
 *
 * Geist Mono handles tool payloads and money, where tabular figures and an
 * unambiguous 0/O matter more than character. Same skeleton as the sans, so
 * a JSON payload sits inside the interface instead of interrupting it.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bookly Support",
  description: "A conversational AI support agent for the Bookly online bookstore.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e11" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // next-themes writes the class before paint; React must not object to it.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
