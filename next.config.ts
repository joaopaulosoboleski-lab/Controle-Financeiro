import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pasta do build: por padrão ".next". NEXT_DIST_DIR permite um build paralelo (ex.: verificação
  // local enquanto os testes e2e usam o .next), sem um atrapalhar o outro.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // pdfkit lê as fontes padrão (.afm) do próprio pacote em node_modules; exceljs também usa recursos do Node.
  // Fora do bundle, eles carregam com o require normal do Node.
  serverExternalPackages: ["pdfkit", "exceljs"],
  // lib/db.ts lê o certificado do Supabase em tempo de execução: na Vercel ele precisa ir junto com as funções.
  outputFileTracingIncludes: {
    "/*": ["./certs/**/*"],
    "/**/*": ["./certs/**/*"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Ninguém pode embutir a Caderneta num iframe (evita clique enganado em "Excluir").
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        // Service worker do PWA: nunca em cache (versão nova vale na hora) e só scripts da própria origem.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
