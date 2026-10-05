import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the whole app is plain files in out/, which Capacitor packages into the iOS app.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
