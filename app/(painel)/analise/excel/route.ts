import type { NextRequest } from "next/server";
import { carregarAnalise } from "@/lib/analise";
import { buscarPerfil } from "@/lib/perfil";
import { gerarExcel } from "@/lib/relatorios/excel";

// GET /analise/excel?de=AAAA-MM-DD&ate=AAAA-MM-DD — mesmo recorte da tela (só os dados de quem está logado).
export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams;
  const [analise, perfil] = await Promise.all([
    carregarAnalise(busca.get("de") ?? undefined, busca.get("ate") ?? undefined),
    buscarPerfil(),
  ]);
  const arquivo = await gerarExcel(analise, perfil?.nome ?? "");
  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="analise_${analise.de}_${analise.ate}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
