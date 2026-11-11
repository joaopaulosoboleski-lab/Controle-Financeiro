import Link from "next/link";
import Dicas from "@/components/graficos/Dicas";
import { Painel } from "@/components/graficos/base";
import {
  Calendario,
  ColunasMensais,
  DiasDaSemana,
  FixoVariavel,
  Histograma,
  RankingCategorias,
  ResultadoMensal,
  TendenciaSaidas,
} from "@/components/graficos/Graficos";
import {
  atalhosDePeriodo,
  carregarAnalise,
  conclusoes,
  formatarCompacto,
  formatarPercentual,
  lerAssimetria,
  lerTendencia,
  mesCurto,
} from "@/lib/analise";
import { formatarData, formatarValor } from "@/lib/lancamentos";
import "./analise.css";

function Variacao({ valor, maiorEhMelhor }: { valor: number | null; maiorEhMelhor: boolean }) {
  if (valor === null || !Number.isFinite(valor)) return null;
  const subiu = valor > 0;
  const bom = subiu === maiorEhMelhor;
  return (
    <span className={`delta ${Math.abs(valor) < 0.005 ? "" : bom ? "bom" : "ruim"}`}>
      {subiu ? "▲" : "▼"} {formatarPercentual(Math.abs(valor))} vs mês anterior
    </span>
  );
}

export default async function PaginaAnalise({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const { de, ate } = await searchParams;
  const a = await carregarAnalise(de, ate);
  const consulta = `de=${a.de}&ate=${a.ate}`;

  if (!a.limites) {
    return (
      <main className="analise">
        <h1>Análise</h1>
        <p>Ainda não há lançamentos para analisar.</p>
        <Link href="/lancamentos/novo">+ Novo lançamento</Link>
      </main>
    );
  }

  const atalhos = atalhosDePeriodo(a.limites);
  const { resumo, distribuicao } = a;

  return (
    <main className="analise">
      <h1>Análise dos lançamentos</h1>
      <p className="subtitulo">
        {formatarData(a.de)} a {formatarData(a.ate)} · {resumo.quantidade} lançamentos · {resumo.meses} {resumo.meses === 1 ? "mês" : "meses"}
      </p>

      {/* Filtros: uma linha acima de tudo; valem para todos os números, gráficos e exportações. */}
      <div className="filtros">
        <nav className="atalhos" aria-label="Período">
          {atalhos.map((p) => {
            const ativo = p.de === a.de && p.ate === a.ate;
            return (
              <Link key={p.rotulo} href={`/analise?de=${p.de}&ate=${p.ate}`} aria-current={ativo ? "true" : undefined} className={ativo ? "ativo" : ""}>
                {ativo && "✓ "}
                {p.rotulo}
              </Link>
            );
          })}
        </nav>
        <form className="periodo" action="/analise">
          <label>
            De <input type="date" name="de" defaultValue={a.de} min={a.limites.de} max={a.limites.ate} />
          </label>
          <label>
            Até <input type="date" name="ate" defaultValue={a.ate} min={a.limites.de} max={a.limites.ate} />
          </label>
          <button type="submit">Aplicar</button>
        </form>
        <div className="exportar">
          <a href={`/analise/excel?${consulta}`} download>
            Baixar Excel
          </a>
          <a href={`/analise/pdf?${consulta}`} download>
            Baixar PDF
          </a>
        </div>
      </div>

      {resumo.quantidade === 0 ? (
        <p>Nenhum lançamento neste período.</p>
      ) : (
        <>
          <section className="kpis" aria-label="Indicadores do período">
            <div className="kpi">
              <span>Entradas</span>
              <strong>{formatarValor(resumo.entradas)}</strong>
              <small>média {formatarCompacto(resumo.mediaMensalEntradas)}/mês</small>
            </div>
            <div className="kpi">
              <span>Saídas</span>
              <strong>{formatarValor(resumo.saidas)}</strong>
              <small>média {formatarCompacto(resumo.mediaMensalSaidas)}/mês</small>
            </div>
            <div className="kpi">
              <span>Resultado</span>
              <strong>{formatarValor(resumo.resultado)}</strong>
              <small>entradas − saídas</small>
            </div>
            <div className="kpi">
              <span>Taxa de poupança</span>
              <strong>{resumo.taxaPoupanca === null ? "—" : formatarPercentual(resumo.taxaPoupanca)}</strong>
              <small>resultado ÷ entradas</small>
            </div>
            {a.ultimoMes && (
              <div className="kpi">
                <span>Saídas em {mesCurto(a.ultimoMes.mes)}</span>
                <strong>{formatarValor(a.ultimoMes.saidas)}</strong>
                <Variacao valor={a.ultimoMes.variacao} maiorEhMelhor={false} />
              </div>
            )}
          </section>

          <section className="conclusoes">
            <h2>Principais conclusões</h2>
            <ul>
              {conclusoes(a).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>

          <div className="paineis">
            <Painel
              largo
              titulo="Entradas e saídas por mês"
              tabela={
                <table>
                  <thead>
                    <tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Resultado</th><th>Lançamentos</th></tr>
                  </thead>
                  <tbody>
                    {a.mensal.map((m) => (
                      <tr key={m.mes}>
                        <td>{mesCurto(m.mes)}</td><td>{formatarValor(m.entradas)}</td><td>{formatarValor(m.saidas)}</td><td>{formatarValor(m.resultado)}</td><td>{m.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <ColunasMensais mensal={a.mensal} />
            </Painel>

            <Painel titulo="Resultado de cada mês" subtitulo="Entradas menos saídas. Abaixo de zero, o mês fechou no vermelho.">
              <ResultadoMensal mensal={a.mensal} />
            </Painel>

            {a.tendencia ? (
              <Painel
                titulo="Tendência e previsão das saídas"
                subtitulo={
                  <>
                    {lerTendencia(a.tendencia)} Previsão por suavização exponencial de Holt
                    {a.tendencia.previsao && ` (α = ${a.tendencia.previsao.alfa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, β = ${a.tendencia.previsao.beta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`}.
                  </>
                }
              >
                <TendenciaSaidas mensal={a.mensal} tendencia={a.tendencia} />
              </Painel>
            ) : (
              <Painel titulo="Tendência e previsão das saídas">
                <p className="aviso">São necessários pelo menos 3 meses no período para estimar tendência e previsão.</p>
              </Painel>
            )}

            <Painel
              largo
              titulo="Para onde vai o dinheiro"
              subtitulo={`Saídas por categoria, da maior para a menor. ${a.pareto80} categoria(s) somam 80% do total (princípio de Pareto).`}
              tabela={
                <table>
                  <thead>
                    <tr><th>Categoria</th><th>Total</th><th>Do total</th><th>Acumulado</th></tr>
                  </thead>
                  <tbody>
                    {a.saidasPorCategoria.map((c) => (
                      <tr key={c.nome}>
                        <td>{c.nome}</td><td>{formatarValor(c.total)}</td><td>{formatarPercentual(c.participacao)}</td><td>{formatarPercentual(c.acumulado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <RankingCategorias categorias={a.saidasPorCategoria} rotulo="Saídas por categoria" />
            </Painel>

            {distribuicao && (
              <Painel
                titulo="Distribuição dos valores das saídas"
                subtitulo={`Quantos gastos caem em cada faixa de valor (R$). A distribuição é ${lerAssimetria(distribuicao.assimetria)}.`}
                tabela={
                  <table>
                    <thead>
                      <tr><th>Faixa (R$)</th><th>Lançamentos</th><th>Soma</th></tr>
                    </thead>
                    <tbody>
                      {distribuicao.faixas.map((f) => (
                        <tr key={f.rotulo}>
                          <td>{f.rotulo}</td><td>{f.quantidade}</td><td>{formatarValor(f.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              >
                <Histograma distribuicao={distribuicao} />
                <dl className="estatisticas">
                  <div><dt>Média</dt><dd>{formatarValor(distribuicao.media)}</dd></div>
                  <div><dt>Mediana</dt><dd>{formatarValor(distribuicao.mediana)}</dd></div>
                  <div><dt>Desvio padrão</dt><dd>{formatarValor(distribuicao.desvio)}</dd></div>
                  <div><dt>Coef. de variação</dt><dd>{formatarPercentual(distribuicao.cv, 0)}</dd></div>
                  <div><dt>1º quartil</dt><dd>{formatarValor(distribuicao.q1)}</dd></div>
                  <div><dt>3º quartil</dt><dd>{formatarValor(distribuicao.q3)}</dd></div>
                  <div><dt>90º percentil</dt><dd>{formatarValor(distribuicao.p90)}</dd></div>
                  <div><dt>Assimetria</dt><dd>{distribuicao.assimetria.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</dd></div>
                </dl>
              </Painel>
            )}

            <Painel
              titulo="Gasto médio por dia da semana"
              subtitulo="Total de saídas de cada dia da semana dividido por quantos desses dias o período tem."
              tabela={
                <table>
                  <thead>
                    <tr><th>Dia</th><th>Média por dia</th><th>Total</th><th>Lançamentos</th></tr>
                  </thead>
                  <tbody>
                    {a.semana.map((d) => (
                      <tr key={d.nome}>
                        <td>{d.nome}</td><td>{formatarValor(d.mediaPorDia)}</td><td>{formatarValor(d.total)}</td><td>{d.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <DiasDaSemana semana={a.semana} />
            </Painel>

            <Painel titulo="Custos fixos e variáveis" subtitulo="Saídas que vieram de uma recorrência (aluguel, escola, contas) contra as avulsas.">
              <FixoVariavel fixo={a.fixo} />
            </Painel>

            <Painel
              largo
              titulo="Calendário de gastos"
              subtitulo="Cada quadrado é um dia; quanto mais escuro, mais se gastou. As cores dividem os dias com gasto em quatro partes iguais (quartis)."
              tabela={
                <table>
                  <thead>
                    <tr><th>Dia</th><th>Saídas</th></tr>
                  </thead>
                  <tbody>
                    {a.dias.filter((d) => d.saidas > 0).map((d) => (
                      <tr key={d.data}>
                        <td>{formatarData(d.data)}</td><td>{formatarValor(d.saidas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <Calendario dias={a.dias} />
            </Painel>
          </div>

          <section>
            <h2>Estatísticas por categoria (saídas)</h2>
            <p className="nota">
              Coeficiente de variação (CV) = desvio ÷ média: quanto maior, mais imprevisível é o gasto. Tendência = variação média do total mensal por mês (regressão linear).
            </p>
            <div className="tabela-rolagem">
              <table className="tabela-dados">
                <thead>
                  <tr>
                    <th>Categoria</th><th>Lanç.</th><th>Total</th><th>Média</th><th>Mediana</th><th>Desvio</th><th>CV</th><th>Mín.</th><th>Máx.</th><th>Tendência/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {a.saidasPorCategoria.map((c) => (
                    <tr key={c.nome}>
                      <td><i className="cor" style={{ background: c.cor }} aria-hidden /> {c.nome}</td>
                      <td>{c.quantidade}</td>
                      <td>{formatarValor(c.total)}</td>
                      <td>{formatarValor(c.media)}</td>
                      <td>{formatarValor(c.mediana)}</td>
                      <td>{formatarValor(c.desvio)}</td>
                      <td>{formatarPercentual(c.cv, 0)}</td>
                      <td>{formatarValor(c.minimo)}</td>
                      <td>{formatarValor(c.maximo)}</td>
                      <td>{c.tendenciaMensal === null ? "—" : `${c.tendenciaMensal > 0 ? "▲" : "▼"} ${formatarPercentual(Math.abs(c.tendenciaMensal))}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2>Gastos atípicos</h2>
            <p className="nota">
              Gastos avulsos muito acima do normal da própria categoria, pelo escore z modificado (mediana e desvio absoluto mediano), acima de 3,5. É um método robusto: os próprios valores extremos não distorcem a régua.
            </p>
            {a.atipicos.length === 0 ? (
              <p>Nenhum gasto atípico no período.</p>
            ) : (
              <div className="tabela-rolagem">
                <table className="tabela-dados">
                  <thead>
                    <tr><th>Data</th><th className="texto">Descrição</th><th className="texto">Categoria</th><th>Valor</th><th>Normal da categoria</th><th>Escore z</th></tr>
                  </thead>
                  <tbody>
                    {a.atipicos.slice(0, 20).map((l) => (
                      <tr key={l.id}>
                        <td>{formatarData(l.data)}</td>
                        <td className="texto"><Link href={`/lancamentos/${l.id}`}>{l.descricao}</Link></td>
                        <td className="texto">{l.categoria}</td>
                        <td>{formatarValor(l.valor)}</td>
                        <td>{formatarValor(l.medianaCategoria)}</td>
                        <td>{l.z.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2>Contas</h2>
            <div className="tabela-rolagem">
              <table className="tabela-dados">
                <thead>
                  <tr><th>Conta</th><th>Entradas no período</th><th>Saídas no período</th><th>Movimento líquido</th><th>Saldo atual</th></tr>
                </thead>
                <tbody>
                  {a.contas.map((c) => (
                    <tr key={c.nome}>
                      <td>{c.nome}</td><td>{formatarValor(c.entradas)}</td><td>{formatarValor(c.saidas)}</td><td>{formatarValor(c.liquido)}</td><td>{formatarValor(c.saldoAtual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <details className="metodologia">
            <summary>Metodologia</summary>
            <ul>
              <li><strong>Quartis e percentis</strong>: interpolação linear (o mesmo método do QUARTIL.INC do Excel).</li>
              <li><strong>Desvio padrão</strong>: amostral (n − 1). <strong>Assimetria</strong>: coeficiente de Fisher-Pearson ajustado (DISTORÇÃO do Excel).</li>
              <li><strong>Tendência</strong>: regressão linear por mínimos quadrados sobre o total mensal; o R² diz quanto da variação a reta explica (0 a 1).</li>
              <li><strong>Previsão</strong>: suavização exponencial de Holt (nível + tendência), com α e β escolhidos pelo menor erro de previsão um mês à frente. A faixa de 80% usa esse erro. Com poucos meses, a previsão é indicativa.</li>
              <li><strong>Gastos atípicos</strong>: escore z modificado de Iglewicz e Hoaglin, por categoria com pelo menos 5 lançamentos avulsos. Os recorrentes (aluguel, escola) ficam de fora: são previstos, não anomalias.</li>
              <li><strong>Concentração</strong>: índice de Herfindahl-Hirschman (IHH) das participações das categorias; abaixo de 1.500 é bem distribuído, acima de 2.500 é concentrado.</li>
              <li>Meses incompletos no início ou no fim do período entram com o que tiverem: eles puxam a média e a tendência para baixo.</li>
            </ul>
          </details>
        </>
      )}

      <Dicas />
    </main>
  );
}
