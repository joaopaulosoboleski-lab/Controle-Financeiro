import { notFound } from "next/navigation";
import BotaoExcluir from "@/components/BotaoExcluir";
import FormularioRecorrencia from "@/components/FormularioRecorrencia";
import { buscarRecorrencia } from "@/lib/cadastros";
import { listarCategorias, listarContas } from "@/lib/lancamentos";
import { atualizarRecorrencia, excluirRecorrencia } from "../../actions";

const ERROS: Record<string, string> = {
  "em-uso": "Esta recorrência já gerou lançamentos e não pode ser excluída. Preencha “Termina em” para encerrá-la.",
  falha: "Não foi possível excluir agora. Tente novamente.",
};

export default async function EditarRecorrencia({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const recorrencia = await buscarRecorrencia(Number(id));
  if (!recorrencia) notFound();

  const [contas, categorias] = await Promise.all([listarContas(), listarCategorias(recorrencia.categoriaId)]);

  return (
    <main>
      <h1>Editar recorrência</h1>
      <p>Mudar aqui vale para os próximos meses: os lançamentos já confirmados continuam como estão.</p>
      <FormularioRecorrencia
        action={atualizarRecorrencia}
        id={recorrencia.id}
        contas={contas}
        categorias={categorias}
        iniciais={{
          descricao: recorrencia.descricao,
          valor: recorrencia.valor.toFixed(2).replace(".", ","),
          dia: String(recorrencia.dia),
          contaId: String(recorrencia.contaId),
          categoriaId: String(recorrencia.categoriaId),
          dataInicio: recorrencia.dataInicio,
          dataFim: recorrencia.dataFim ?? "",
        }}
        textoBotao="Salvar alterações"
      />

      <h2>Excluir</h2>
      {erro && ERROS[erro] && (
        <p className="erro" role="alert">
          {ERROS[erro]}
        </p>
      )}
      {recorrencia.lancamentos > 0 ? (
        <p>
          Não é possível excluir: ela já gerou {recorrencia.lancamentos} lançamento(s), que perderiam a origem. Para
          parar de aparecer na confirmação, preencha “Termina em”.
        </p>
      ) : (
        <BotaoExcluir
          action={excluirRecorrencia}
          id={recorrencia.id}
          texto="Excluir recorrência"
          confirmacao={`Excluir a recorrência ${recorrencia.descricao}? Essa ação não pode ser desfeita.`}
        />
      )}
    </main>
  );
}
