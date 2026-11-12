import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
