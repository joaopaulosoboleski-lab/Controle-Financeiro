"use client";

import { useEffect } from "react";

// Registra o service worker (public/sw.js), que só mostra a página "sem internet" quando não há conexão.
// Em desenvolvimento não registra: um service worker atrapalharia o recarregamento automático do next dev.
export default function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sem service worker o app funciona igual; só perde a página offline.
    });
  }, []);
  return null;
}
