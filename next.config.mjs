/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Browsers must always re-check the service worker so a new deploy's
        // worker is picked up on the next visit.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ]
  },
  webpack: (config) => {
    // @imgly/background-removal runs in the browser (WASM/ONNX); its bundle references
    // the Node-only `sharp` package, which we never use. Stub it so builds don't warn.
    config.resolve = config.resolve || {}
    config.resolve.fallback = { ...(config.resolve.fallback || {}), sharp: false }
    return config
  },
}

export default nextConfig
