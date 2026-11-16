import type { NextConfig } from "next";

function getLoopbackProxyTarget(): string | null {
  const raw = process.env.BACKEND_PROXY_TARGET?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    const host = parsed.hostname.toLowerCase();
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1" && host !== "[::1]") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

const nextConfig: NextConfig = {
  async rewrites() {
    const target = getLoopbackProxyTarget();
    if (!target) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${target}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
