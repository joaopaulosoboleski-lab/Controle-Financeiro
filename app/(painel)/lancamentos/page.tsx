import Link from "next/link";
import LancamentoCard from "@/components/LancamentoCard";
import SeletorMes from "@/components/SeletorMes";
import {
  formatarValor,
  listarLancamentos,
  listarMeses,
  resolverMes,
  resumoDoMes,
  resumoPrevistoDoMes,
} from "@/lib/lancamentos";

const AVISOS: Record<string, string> = {
  previsto: "Lançamento previsto salvo. Ele não entra no saldo até você confirmar.",
  confirmado: "Lançamento confirmado. Agora ele conta no saldo.",
};

function Acoes() {
  return (
    <p>
      <Link href="/lancamentos/novo">+ Novo lançamento</Link>
      {" · "}
      <Link href="/lancamentos/comprovante">📷 Entrada por foto</Link>
    </p>
  );
}

export default async function ListaLancamentos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; aviso?: string }>;
}) {
  const { mes: mesPedido, aviso } = await searchParams;
  const mes = await resolverMes(mesPedido);

  if (!mes) {
    return (
      <main>
        <h1>Lançamentos</h1>
        <p>Nenhum lançamento cadastrado.</p>
        <Acoes />
      </main>
    );
  }

  const [meses, realizados, previstos, resumo, previsto] = await Promise.all([
    listarMeses(),
    listarLancamentos(mes),
    listarLancamentos(mes, { previsto: true }),
    resumoDoMes(mes),
    resumoPrevistoDoMes(mes),
  ]);

  return (
    <main>
      <h1>Lançamentos</h1>
      {aviso && AVISOS[aviso] && (
        <p className="sucesso" role="status">
          {AVISOS[aviso]}
        </p>
      )}
      <Acoes />
      <SeletorMes rota="/lancamentos" meses={meses} atual={mes} />

      {/* Totais só do que aconteceu; o previsto aparece à parte. */}
      <div className="resumo">
        <div>
          <span>Entradas</span>
          <span>{formatarValor(resumo.entradas)}</span>
        </div>
        <div>
          <span>Saídas</span>
          <span>{formatarValor(resumo.saidas)}</span>
        </div>
        <div className="saldo">
          <span>Saldo do mês</span>
          <span>{formatarValor(resumo.saldo)}</span>
        </div>
        {previsto.quantidade > 0 && (
          <div className="previsto-resumo">
            <span>Previsto no mês (não incluído)</span>
            <span>
              {previsto.entradas > 0 && `+ ${formatarValor(previsto.entradas)} `}
              {previsto.saidas > 0 && `− ${formatarValor(previsto.saidas)}`}
            </span>
          </div>
        )}
      </div>

      {realizados.length === 0 ? (
        <p>Nenhum lançamento realizado neste mês.</p>
      ) : (
        <ul className="lista">
          {realizados.map((lancamento) => (
            <LancamentoCard key={lancamento.id} lancamento={lancamento} />
          ))}
        </ul>
      )}

      {previstos.length > 0 && (
        <>
          <h2>Previstos (não entram no saldo)</h2>
          <ul className="lista">
            {previstos.map((lancamento) => (
              <LancamentoCard key={lancamento.id} lancamento={lancamento} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
