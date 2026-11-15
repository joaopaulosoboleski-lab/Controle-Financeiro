import Link from "next/link";
import { notFound } from "next/navigation";
import FormularioConfirmacao from "@/components/FormularioConfirmacao";
import { buscarLancamento, formatarData, formatarValor, hojeEmSaoPaulo, listarContas } from "@/lib/lancamentos";

// Confirmar um lançamento previsto. buscarLancamento filtra pelo usuário da sessão:
// lançamento de outra pessoa (ou inexistente) dá "não encontrado" (R8).
export default async function ConfirmarLancamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lancamento = await buscarLancamento(Number(id));
  if (!lancamento) notFound();

  if (!lancamento.previsto) {
    return (
      <main>
        <h1>Confirmar lançamento</h1>
        <p className="erro" role="alert">
          Este lançamento já foi confirmado.
        </p>
        <Link href={`/lancamentos/${lancamento.id}`}>Ver o lançamento</Link>
      </main>
    );
  }

  const contas = await listarContas();
  const hoje = hojeEmSaoPaulo();
  // Confirmando antes da data prevista, o mais provável é que tenha acontecido hoje.
  const dataSugerida = lancamento.data > hoje ? hoje : lancamento.data;

  return (
    <main>
      <h1>Confirmar lançamento</h1>
      <p>
        <strong>{lancamento.descricao}</strong> · {lancamento.tipo === "entrada" ? "Entrada" : "Saída"} ·{" "}
        {lancamento.categoria}
        <br />
        Previsto: {formatarValor(lancamento.valor)} em {formatarData(lancamento.data)}
        {lancamento.vencido && " (vencido)"}
      </p>
      <p>Ajuste o valor, a data e a conta se o real foi diferente. Ao confirmar, ele passa a contar no saldo.</p>
      <FormularioConfirmacao
        id={lancamento.id}
        contas={contas}
        iniciais={{
          valor: lancamento.valor.toFixed(2).replace(".", ","),
          data: dataSugerida,
          contaId: String(lancamento.contaId),
        }}
      />
    </main>
  );
}
