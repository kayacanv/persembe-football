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
  webpack: (config) => {
    // @imgly/background-removal runs in the browser (WASM/ONNX); its bundle references
    // the Node-only `sharp` package, which we never use. Stub it so builds don't warn.
    config.resolve = config.resolve || {}
    config.resolve.fallback = { ...(config.resolve.fallback || {}), sharp: false }
    return config
  },
}

export default nextConfig
