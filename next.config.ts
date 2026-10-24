import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push", "https-proxy-agent", "agent-base"],
};

export default nextConfig;
