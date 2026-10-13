import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Business logos are up to 2 MB; leave room for the multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
