import { notFound } from "next/navigation";
import BotaoExcluir from "@/components/BotaoExcluir";
import FormularioCategoria from "@/components/FormularioCategoria";
import { buscarCategoria } from "@/lib/cadastros";
import { atualizarCategoria, excluirCategoria } from "../../actions";

const ERROS: Record<string, string> = {
  "em-uso": "Esta categoria já foi usada e não pode ser excluída. Desmarque “Ativa” para arquivá-la.",
  falha: "Não foi possível excluir agora. Tente novamente.",
};

export default async function EditarCategoria({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const categoria = await buscarCategoria(Number(id));
  if (!categoria) notFound();
  const emUso = categoria.lancamentos + categoria.recorrencias > 0;

  return (
    <main>
      <h1>Editar categoria</h1>
      <FormularioCategoria
        action={atualizarCategoria}
        id={categoria.id}
        tipoTravado={emUso}
        iniciais={{ nome: categoria.nome, tipo: categoria.tipo, cor: categoria.cor, ativa: categoria.ativa }}
        textoBotao="Salvar alterações"
      />

      <h2>Excluir</h2>
      {erro && ERROS[erro] && (
        <p className="erro" role="alert">
          {ERROS[erro]}
        </p>
      )}
      {emUso ? (
        <p>
          Não é possível excluir: a categoria está em {categoria.lancamentos} lançamento(s) e {categoria.recorrencias}{" "}
          recorrência(s). Para tirá-la dos formulários sem perder o histórico, desmarque “Ativa” acima.
        </p>
      ) : (
        <BotaoExcluir
          action={excluirCategoria}
          id={categoria.id}
          texto="Excluir categoria"
          confirmacao={`Excluir a categoria ${categoria.nome}? Essa ação não pode ser desfeita.`}
        />
      )}
    </main>
  );
}
