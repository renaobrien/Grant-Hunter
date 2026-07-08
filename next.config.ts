import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Feedback screenshots (base64 PNG) are posted through a Server Action and
    // routinely exceed the 1 MB default body limit.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
