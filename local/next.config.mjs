import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  transpilePackages: ["@subboost/core", "@subboost/server-core", "@subboost/ui", "@subboost/config"],
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(process.cwd(), "src");
    config.resolve.alias["@local"] = path.resolve(process.cwd(), "src");
    config.resolve.modules = [
      path.resolve(process.cwd(), "node_modules"),
      ...(config.resolve.modules || []),
    ];
    return config;
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cache-Control", value: "no-store, no-cache, max-age=0, must-revalidate" },
    ];
    return [
      { source: "/:path*", headers },
    ];
  },
};

export default nextConfig;
