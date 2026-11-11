import SeletorMes from "@/components/SeletorMes";
import {
  alertasDeQualidade,
  formatarValor,
  listarMeses,
  resolverMes,
  resumoDoMes,
  saidasPorCategoria,
  saldosDasContas,
} from "@/lib/lancamentos";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesPedido } = await searchParams;
  const mes = await resolverMes(mesPedido);

  if (!mes) {
    return (
      <main>
        <h1>Dashboard</h1>
        <p>Nenhum lançamento cadastrado.</p>
      </main>
    );
  }

  const [meses, resumo, categorias, contas, alertas] = await Promise.all([
    listarMeses(),
    resumoDoMes(mes),
    saidasPorCategoria(mes),
    saldosDasContas(),
    alertasDeQualidade(),
  ]);

  return (
    <main>
      <h1>Dashboard</h1>
      <SeletorMes rota="/dashboard" meses={meses} atual={mes} />

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
      </div>

      <h2>Saídas por categoria</h2>
      <div className="resumo">
        {categorias.map((c) => (
          <div key={c.categoria}>
            <span>
              <i className="cor" style={{ background: c.cor }} /> {c.categoria}
            </span>
            <span>{formatarValor(c.total)}</span>
          </div>
        ))}
      </div>

      <h2>Saldo atual das contas</h2>
      <div className="resumo">
        {contas.map((c) => (
          <div key={c.conta}>
            <span>{c.conta}</span>
            <span>{formatarValor(c.saldo)}</span>
          </div>
        ))}
      </div>

      {alertas.length > 0 && (
        <>
          <h2>Para revisar</h2>
          <ul>
            {alertas.map((a) => (
              <li key={a.motivo}>
                {a.quantidade} lançamento(s): {a.motivo}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
