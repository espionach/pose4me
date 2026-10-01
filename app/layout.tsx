import type { Metadata, Viewport } from "next";
import { Caveat, Figtree, Young_Serif } from "next/font/google";
import { Suspense } from "react";
import { DevTools } from "@/components/DevTools";
import { StorageErrorBanner } from "@/components/StorageErrorBanner";
import { NavTracker } from "@/lib/nav";
import { ProfileProvider } from "@/lib/profile";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const youngSerif = Young_Serif({ weight: "400", subsets: ["latin"], variable: "--font-young-serif" });
const figtree = Figtree({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-figtree" });
const caveat = Caveat({ weight: "700", subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Shoot Planner",
  description: "Turn inspiration photos into a photoshoot plan.",
  appleWebApp: { capable: true, title: "Shoot Planner", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF8F3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${youngSerif.variable} ${figtree.variable} ${caveat.variable}`}>
      <body>
        <Suspense fallback={null}>
          <NavTracker />
        </Suspense>
        <ProfileProvider>
          <StoreProvider>
            <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-x-clip">{children}</div>
          </StoreProvider>
        </ProfileProvider>
        <StorageErrorBanner />
        <DevTools />
      </body>
    </html>
  );
}
