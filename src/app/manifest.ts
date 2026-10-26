import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Booked",
    short_name: "Booked",
    description: "Your weekly marketing routine: what to post, enquiries and reviews.",
    start_url: "/home",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#0f766e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
