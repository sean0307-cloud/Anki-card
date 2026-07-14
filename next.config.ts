import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Anki-card",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
