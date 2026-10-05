import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
