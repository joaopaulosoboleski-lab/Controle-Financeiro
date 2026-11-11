import type { NextRequest } from "next/server";
import { carregarAnalise } from "@/lib/analise";
import { buscarPerfil } from "@/lib/perfil";
import { gerarPdf } from "@/lib/relatorios/pdf";

// GET /analise/pdf?de=AAAA-MM-DD&ate=AAAA-MM-DD — mesmo recorte da tela (só os dados de quem está logado).
export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams;
  const [analise, perfil] = await Promise.all([
    carregarAnalise(busca.get("de") ?? undefined, busca.get("ate") ?? undefined),
    buscarPerfil(),
  ]);
  const arquivo = await gerarPdf(analise, perfil?.nome ?? "");
  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="analise_${analise.de}_${analise.ate}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
