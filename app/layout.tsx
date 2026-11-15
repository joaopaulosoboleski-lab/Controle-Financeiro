import type { Metadata, Viewport } from "next";
import RegistrarServiceWorker from "@/components/RegistrarServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Caderneta da Cláudia", template: "%s · Caderneta da Cláudia" },
  description: "Controle financeiro pessoal da família",
  applicationName: "Caderneta",
  // iPhone: ao adicionar à tela inicial, abre como app (sem a barra do Safari).
  appleWebApp: { capable: true, title: "Caderneta", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Ocupa a tela toda no celular com recorte/barra de gestos; o CSS usa env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2f6f5e" },
    { media: "(prefers-color-scheme: dark)", color: "#14181c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
