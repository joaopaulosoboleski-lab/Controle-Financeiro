import { notFound } from "next/navigation";
import BotaoExcluir from "@/components/BotaoExcluir";
import FormularioConta from "@/components/FormularioConta";
import { buscarConta } from "@/lib/cadastros";
import { formatarValor } from "@/lib/lancamentos";
import { atualizarConta, excluirConta } from "../../actions";

const ERROS: Record<string, string> = {
  "em-uso": "Esta conta tem lançamentos ou recorrências e não pode ser excluída.",
  falha: "Não foi possível excluir agora. Tente novamente.",
};

export default async function EditarConta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const conta = await buscarConta(Number(id));
  if (!conta) notFound();

  return (
    <main>
      <h1>Editar conta</h1>
      <p>
        Saldo atual: <strong>{formatarValor(conta.saldoAtual)}</strong> (saldo inicial + entradas − saídas).
      </p>
      <FormularioConta
        action={atualizarConta}
        id={conta.id}
        iniciais={{
          nome: conta.nome,
          tipo: conta.tipo,
          saldoInicial: conta.saldoInicial.toFixed(2).replace(".", ","),
          dataAbertura: conta.dataAbertura,
        }}
        textoBotao="Salvar alterações"
      />

      <h2>Excluir</h2>
      {erro && ERROS[erro] && (
        <p className="erro" role="alert">
          {ERROS[erro]}
        </p>
      )}
      {conta.lancamentos + conta.recorrencias > 0 ? (
        <p>
          Não é possível excluir: a conta tem {conta.lancamentos} lançamento(s) e {conta.recorrencias} recorrência(s).
          Excluir apagaria o histórico.
        </p>
      ) : (
        <BotaoExcluir
          action={excluirConta}
          id={conta.id}
          texto="Excluir conta"
          confirmacao={`Excluir a conta ${conta.nome}? Essa ação não pode ser desfeita.`}
        />
      )}
    </main>
  );
}
