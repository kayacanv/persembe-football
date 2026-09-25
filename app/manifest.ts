import type { MetadataRoute } from "next"

// Web app manifest (served at /manifest.webmanifest). Together with the service
// worker in public/sw.js it makes the site installable to a phone's home screen,
// where it opens full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Perşembe Halısaha",
    short_name: "Perşembe",
    description: "Perşembe günü halı saha maçı organizasyonu",
    lang: "tr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["sports"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
