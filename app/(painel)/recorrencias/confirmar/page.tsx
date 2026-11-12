import Link from "next/link";
import BotaoEnviar from "@/components/BotaoEnviar";
import { recorrenciasDoMes } from "@/lib/cadastros";
import { formatarData, formatarMes, formatarValor } from "@/lib/lancamentos";
import { dataNoMes, mesAtual, mesValido, mesVizinho } from "@/lib/validacao-cadastros";
import { confirmarRecorrencia, confirmarTodas } from "../actions";

const AVISOS: Record<string, { texto: string; erro?: boolean }> = {
  confirmada: { texto: "Lançamento confirmado." },
  todas: { texto: "Recorrências pendentes confirmadas." },
  "ja-lancada": { texto: "Essa recorrência já tinha sido lançada neste mês (ou não vale para ele).", erro: true },
  valor: { texto: "Informe um valor válido, maior que zero.", erro: true },
  data: { texto: "A data precisa estar dentro do mês escolhido.", erro: true },
  invalida: { texto: "Recorrência não encontrada.", erro: true },
  falha: { texto: "Não foi possível lançar agora. Tente novamente.", erro: true },
};

export default async function ConfirmarRecorrencias({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; aviso?: string }>;
}) {
  const { mes: mesPedido, aviso } = await searchParams;
  const mes = mesValido(mesPedido) ? mesPedido : mesAtual();
  const itens = await recorrenciasDoMes(mes);
  const pendentes = itens.filter((r) => r.lancamentoId === null);
  const lancadas = itens.filter((r) => r.lancamentoId !== null);
  const avisoAtual = aviso ? AVISOS[aviso] : undefined;
  const primeiroDia = `${mes}-01`;
  const ultimoDia = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);

  return (
    <main>
      <h1>Confirmar recorrências</h1>
      <p className="meses">
        <Link href={`/recorrencias/confirmar?mes=${mesVizinho(mes, -1)}`}>← {formatarMes(mesVizinho(mes, -1))}</Link>
        <strong>{formatarMes(mes)}</strong>
        <Link href={`/recorrencias/confirmar?mes=${mesVizinho(mes, 1)}`}>{formatarMes(mesVizinho(mes, 1))} →</Link>
      </p>

      {avisoAtual && (
        <p className={avisoAtual.erro ? "erro" : "sucesso"} role={avisoAtual.erro ? "alert" : "status"}>
          {avisoAtual.texto}
        </p>
      )}

      {itens.length === 0 && (
        <p>
          Nenhuma recorrência vale para este mês. <Link href="/recorrencias/nova">Cadastrar uma recorrência</Link>.
        </p>
      )}

      {pendentes.length > 0 && (
        <>
          <h2>A confirmar ({pendentes.length})</h2>
          <p>Ajuste o valor e a data se o real foi diferente do previsto, e confirme.</p>
          <ul className="lista confirmacao">
            {pendentes.map((r) => (
              <li key={r.id} className={`card ${r.tipo}`}>
                <form action={confirmarRecorrencia}>
                  <input type="hidden" name="recorrenciaId" value={r.id} />
                  <input type="hidden" name="mes" value={mes} />
                  <strong>{r.descricao}</strong>
                  <small>
                    {r.tipo === "entrada" ? "Entrada" : "Saída"} · {r.categoria} · {r.conta} · previsto{" "}
                    {formatarValor(r.valor)}
                  </small>
                  <label>
                    Valor (R$)
                    <input
                      type="text"
                      name="valor"
                      inputMode="decimal"
                      defaultValue={r.valor.toFixed(2).replace(".", ",")}
                      required
                    />
                  </label>
                  <label>
                    Data
                    <input
                      type="date"
                      name="data"
                      defaultValue={dataNoMes(mes, r.dia)}
                      min={primeiroDia}
                      max={ultimoDia}
                      required
                    />
                  </label>
                  <BotaoEnviar texto="Confirmar" enviando="Lançando..." />
                </form>
              </li>
            ))}
          </ul>
          {pendentes.length > 1 && (
            <form action={confirmarTodas} className="formulario">
              <input type="hidden" name="mes" value={mes} />
              <BotaoEnviar texto={`Confirmar todas as ${pendentes.length} com o valor previsto`} enviando="Lançando..." />
            </form>
          )}
        </>
      )}

      {lancadas.length > 0 && (
        <>
          <h2>Já lançadas ({lancadas.length})</h2>
          <ul className="lista">
            {lancadas.map((r) => (
              <li key={r.id} className={`card ${r.tipo}`}>
                <Link href={`/lancamentos/${r.lancamentoId}`}>
                  <strong>{r.descricao}</strong>
                  <span>
                    {r.tipo === "entrada" ? "+" : "-"} {formatarValor(r.valorLancado ?? 0)}
                  </span>
                  <small>
                    {formatarData(r.dataLancada ?? "")} · {r.categoria} · {r.conta}
                    {r.valorLancado !== r.valor && ` · previsto ${formatarValor(r.valor)}`}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <p>
        <Link href="/recorrencias">Ver todas as recorrências</Link>
      </p>
    </main>
  );
}
