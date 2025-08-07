import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Add Next.js config options here if needed */
};

export default nextConfig;

// Enable Cloudflare context in `next dev` when using OpenNext on Cloudflare
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
