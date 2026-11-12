import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarLancamento, formatarData, formatarValor } from "@/lib/lancamentos";

export default async function DetalheLancamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lancamento = await buscarLancamento(Number(id));

  if (!lancamento) {
    notFound();
  }

  return (
    <main>
      <h1>{lancamento.descricao}</h1>
      <p>Valor: {formatarValor(lancamento.valor)}</p>
      <p>Tipo: {lancamento.tipo === "entrada" ? "Entrada" : "Saída"}</p>
      <p>Categoria: {lancamento.categoria}</p>
      <p>Conta: {lancamento.conta}</p>
      <p>Data: {formatarData(lancamento.data)}</p>
      <p>
        Origem:{" "}
        {lancamento.recorrenciaId ? (
          <>
            recorrência <Link href={`/recorrencias/${lancamento.recorrenciaId}/editar`}>{lancamento.recorrencia}</Link>
          </>
        ) : (
          "avulso"
        )}
      </p>
      <Link href={`/lancamentos/${lancamento.id}/editar`}>Editar</Link>
      {" · "}
      <Link href="/lancamentos">Voltar para a lista</Link>
    </main>
  );
}
