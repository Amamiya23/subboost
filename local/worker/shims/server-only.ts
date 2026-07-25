// Shim for the `server-only` package, which is a Next.js build-time marker.
// Under Wrangler bundling there is no React Server Components boundary to enforce,
// so we replace it with an empty module.
export {};
