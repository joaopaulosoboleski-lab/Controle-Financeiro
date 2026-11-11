import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit lê as fontes padrão (.afm) do próprio pacote em node_modules; exceljs também usa recursos do Node.
  // Fora do bundle, eles carregam com o require normal do Node.
  serverExternalPackages: ["pdfkit", "exceljs"],
};

export default nextConfig;
