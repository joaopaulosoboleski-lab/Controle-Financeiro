import { notFound } from "next/navigation";
import BotaoExcluir from "@/components/BotaoExcluir";
import FormularioLancamento from "@/components/FormularioLancamento";
import { buscarLancamento, listarCategorias, listarContas } from "@/lib/lancamentos";
import { atualizarLancamento, excluirLancamento } from "../../actions";

export default async function EditarLancamento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;

  const lancamento = await buscarLancamento(Number(id));
  if (!lancamento) notFound();

  const [contas, categorias] = await Promise.all([
    listarContas(),
    listarCategorias(lancamento.categoriaId),
  ]);

  return (
    <main>
      <h1>Editar lançamento</h1>
      <FormularioLancamento
        action={atualizarLancamento}
        contas={contas}
        categorias={categorias}
        id={lancamento.id}
        iniciais={{
          descricao: lancamento.descricao === "(sem descrição)" ? "" : lancamento.descricao,
          valor: lancamento.valor.toFixed(2).replace(".", ","),
          tipo: lancamento.tipo,
          data: lancamento.data,
          contaId: String(lancamento.contaId),
          categoriaId: String(lancamento.categoriaId),
        }}
        textoBotao="Salvar alterações"
      />

      <h2>Excluir</h2>
      {erro === "exclusao" && (
        <p className="erro" role="alert">
          Não foi possível excluir agora. Tente novamente.
        </p>
      )}
      <BotaoExcluir action={excluirLancamento} id={lancamento.id} />
    </main>
  );
}
