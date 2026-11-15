import type { MetadataRoute } from "next";

// Manifest do PWA: permite instalar a Caderneta na tela inicial do celular, abrindo sem a barra do navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caderneta da Cláudia",
    short_name: "Caderneta",
    description: "Controle financeiro pessoal da família: lançamentos, contas, recorrências e análises.",
    lang: "pt-BR",
    start_url: "/lancamentos",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#2f6f5e",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android recorta o ícone em círculo/gota: a versão "maskable" tem margem de segurança.
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Novo lançamento", url: "/lancamentos/novo", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Entrada por foto", url: "/lancamentos/comprovante", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Dashboard", url: "/dashboard", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
    ],
  };
}
