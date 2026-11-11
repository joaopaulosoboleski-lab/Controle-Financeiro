// Gráficos da aba Análise: SVG desenhado no servidor, sem biblioteca.
// Regras seguidas: um só eixo Y por gráfico, colunas de no máximo 24px com ponta arredondada,
// linhas de 2px, grade em linha fina sólida, rótulos seletivos e dica em toda marca.
import type { Analise, Categoria, Dia } from "@/lib/analise";
import { formatarCompacto, formatarPercentual, mesCurto, NOMES_DIAS } from "@/lib/analise";
import { quantil, ticksEixo } from "@/lib/estatistica";
import { formatarData, formatarValor } from "@/lib/lancamentos";
import { COR, Legenda, caminhoColuna, dica } from "./base";

const L = 600; // largura do desenho (viewBox)
const M = { topo: 18, direita: 12, baixo: 28, esquerda: 66 };

function Grade({ ticks, y, largura, formato = formatarCompacto }: { ticks: number[]; y: (v: number) => number; largura: number; formato?: (v: number) => string }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line className={t === 0 ? "eixo" : "grade"} x1={M.esquerda} x2={largura - M.direita} y1={y(t)} y2={y(t)} />
          <text className="rotulo-eixo" x={M.esquerda - 8} y={y(t)} dy="0.32em" textAnchor="end">
            {formato(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

// ---------- Entradas × saídas por mês (colunas agrupadas) ----------

export function ColunasMensais({ mensal }: { mensal: Analise["mensal"] }) {
  const A = 260;
  const L = 1100; // fica num painel largo: desenho mais largo para o texto não crescer ao esticar
  const max = Math.max(1, ...mensal.flatMap((m) => [m.entradas, m.saidas]));
  const ticks = ticksEixo(max);
  const topoEscala = ticks[ticks.length - 1];
  const y = (v: number) => A - M.baixo - (v / topoEscala) * (A - M.baixo - M.topo);
  const faixa = (L - M.esquerda - M.direita) / Math.max(1, mensal.length);
  const coluna = Math.min(24, (faixa - 12) / 2);

  return (
    <>
      <Legenda itens={[{ rotulo: "Entradas", cor: COR.entrada }, { rotulo: "Saídas", cor: COR.saida }]} />
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Entradas e saídas por mês">
        <Grade ticks={ticks} y={y} largura={L} />
        {mensal.map((m, i) => {
          const centro = M.esquerda + faixa * i + faixa / 2;
          const base = y(0);
          const titulo = mesCurto(m.mes);
          const linhas: [string, string, string?][] = [
            ["Entradas", formatarValor(m.entradas), COR.entrada],
            ["Saídas", formatarValor(m.saidas), COR.saida],
            ["Resultado", formatarValor(m.resultado)],
          ];
          return (
            <g key={m.mes} className="alvo" tabIndex={0} data-dica={dica(titulo, linhas)} aria-label={`${titulo}: entradas ${formatarValor(m.entradas)}, saídas ${formatarValor(m.saidas)}`}>
              <rect className="area-alvo" x={centro - faixa / 2} y={M.topo} width={faixa} height={A - M.topo - M.baixo} />
              <path className="marca" fill={COR.entrada} d={caminhoColuna(centro - coluna - 1, base, coluna, base - y(m.entradas))} />
              <path className="marca" fill={COR.saida} d={caminhoColuna(centro + 1, base, coluna, base - y(m.saidas))} />
              <text className="rotulo-eixo" x={centro} y={A - 8} textAnchor="middle">
                {titulo}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

// ---------- Resultado do mês (barras divergentes em torno de zero) ----------

export function ResultadoMensal({ mensal }: { mensal: Analise["mensal"] }) {
  const A = 220;
  const maxAbs = Math.max(1, ...mensal.map((m) => Math.abs(m.resultado)));
  const positivos = ticksEixo(maxAbs, 2);
  const lim = positivos[positivos.length - 1];
  const temPositivo = mensal.some((m) => m.resultado > 0);
  const temNegativo = mensal.some((m) => m.resultado < 0);
  const topo = temPositivo ? lim : 0;
  const fundo = temNegativo ? -lim : 0;
  const ticks = [...positivos.filter((t) => t > 0 && temPositivo), 0, ...positivos.filter((t) => t > 0 && temNegativo).map((t) => -t)];
  const y = (v: number) => M.topo + ((topo - v) / (topo - fundo || 1)) * (A - M.topo - M.baixo);
  const faixa = (L - M.esquerda - M.direita) / Math.max(1, mensal.length);
  const coluna = Math.min(24, faixa - 12);
  const melhor = mensal.reduce((a, b) => (b.resultado > a.resultado ? b : a), mensal[0]);
  const pior = mensal.reduce((a, b) => (b.resultado < a.resultado ? b : a), mensal[0]);

  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Resultado (entradas menos saídas) por mês">
      <Grade ticks={ticks} y={y} largura={L} />
      {mensal.map((m, i) => {
        const centro = M.esquerda + faixa * i + faixa / 2;
        const base = y(0);
        const cor = m.resultado >= 0 ? COR.entrada : COR.negativo;
        const destaque = mensal.length > 1 && (m === melhor || m === pior);
        const ponta = y(m.resultado);
        return (
          <g key={m.mes} className="alvo" tabIndex={0} data-dica={dica(mesCurto(m.mes), [["Resultado", formatarValor(m.resultado), cor]])} aria-label={`${mesCurto(m.mes)}: ${formatarValor(m.resultado)}`}>
            <rect className="area-alvo" x={centro - faixa / 2} y={M.topo} width={faixa} height={A - M.topo - M.baixo} />
            <path className="marca" fill={cor} d={caminhoColuna(centro - coluna / 2, base, coluna, base - ponta)} />
            {destaque && (
              <text className="rotulo-valor" x={centro} y={m.resultado >= 0 ? ponta - 6 : ponta + 14} textAnchor="middle">
                {formatarCompacto(m.resultado)}
              </text>
            )}
            <text className="rotulo-eixo" x={centro} y={A - 8} textAnchor="middle">
              {mesCurto(m.mes)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Saídas mensais + tendência linear + previsão (Holt) ----------

export function TendenciaSaidas({ mensal, tendencia }: { mensal: Analise["mensal"]; tendencia: NonNullable<Analise["tendencia"]> }) {
  const A = 260;
  const prev = tendencia.previsao;
  const n = mensal.length + (prev ? 1 : 0);
  const max = Math.max(1, ...mensal.map((m) => m.saidas), prev?.maximo ?? 0);
  const ticks = ticksEixo(max);
  const topoEscala = ticks[ticks.length - 1];
  const y = (v: number) => A - M.baixo - (v / topoEscala) * (A - M.baixo - M.topo);
  const passo = (L - M.esquerda - M.direita) / Math.max(1, n);
  const x = (i: number) => M.esquerda + passo * i + passo / 2;
  const { inclinacao, intercepto } = tendencia.regressao;
  const ultimo = mensal.length - 1;

  const pontos = mensal.map((m, i) => `${x(i)},${y(m.saidas)}`).join(" ");

  return (
    <>
      <Legenda
        itens={[
          { rotulo: "Saídas do mês", cor: COR.saida, forma: "linha" },
          { rotulo: "Tendência linear", cor: "var(--suave)", forma: "linha" },
          ...(prev ? [{ rotulo: "Previsão (faixa de 80%)", cor: "var(--g-saida-lavado)" }] : []),
        ]}
      />
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Saídas por mês com tendência e previsão">
        <Grade ticks={ticks} y={y} largura={L} />
        {prev && (
          <>
            <rect className="faixa-previsao" x={x(mensal.length) - 14} width={28} y={y(prev.maximo)} height={Math.max(1, y(prev.minimo) - y(prev.maximo))} rx={4} />
            <line className="linha-previsao" x1={x(ultimo)} y1={y(mensal[ultimo].saidas)} x2={x(mensal.length)} y2={y(prev.valor)} />
          </>
        )}
        <line className="linha-tendencia" x1={x(0)} y1={y(intercepto)} x2={x(ultimo)} y2={y(intercepto + inclinacao * ultimo)} />
        <polyline className="linha-serie" stroke={COR.saida} points={pontos} />
        {mensal.map((m, i) => (
          <g key={m.mes} className="alvo" tabIndex={0} data-dica={dica(mesCurto(m.mes), [["Saídas", formatarValor(m.saidas), COR.saida], ["Tendência", formatarValor(intercepto + inclinacao * i)]])} aria-label={`${mesCurto(m.mes)}: ${formatarValor(m.saidas)}`}>
            <rect className="area-alvo" x={x(i) - passo / 2} y={M.topo} width={passo} height={A - M.topo - M.baixo} />
            <line className="mira" x1={x(i)} x2={x(i)} y1={M.topo} y2={A - M.baixo} />
            <circle className="ponto" cx={x(i)} cy={y(m.saidas)} r={4} fill={COR.saida} />
            <text className="rotulo-eixo" x={x(i)} y={A - 8} textAnchor="middle">
              {mesCurto(m.mes)}
            </text>
          </g>
        ))}
        {prev && (
          <g className="alvo" tabIndex={0} data-dica={dica(`${mesCurto(prev.mes)} (previsão)`, [["Previsto", formatarValor(prev.valor), COR.saida], ["Faixa de 80%", `${formatarCompacto(prev.minimo)} a ${formatarCompacto(prev.maximo)}`]])} aria-label={`Previsão para ${mesCurto(prev.mes)}: ${formatarValor(prev.valor)}`}>
            <rect className="area-alvo" x={x(mensal.length) - passo / 2} y={M.topo} width={passo} height={A - M.topo - M.baixo} />
            <circle className="ponto vazado" cx={x(mensal.length)} cy={y(prev.valor)} r={4} />
            <text className="rotulo-valor" x={x(mensal.length)} y={y(prev.maximo) - 6} textAnchor="middle">
              {formatarCompacto(prev.valor)}
            </text>
            <text className="rotulo-eixo" x={x(mensal.length)} y={A - 8} textAnchor="middle">
              {mesCurto(prev.mes)}
            </text>
          </g>
        )}
      </svg>
    </>
  );
}

// ---------- Ranking de categorias com Pareto (HTML: o texto não encolhe no celular) ----------

export function RankingCategorias({ categorias, rotulo }: { categorias: Categoria[]; rotulo: string }) {
  const max = Math.max(1, ...categorias.map((c) => c.total));
  return (
    <>
      <Legenda
        itens={[
          { rotulo: "Categorias que somam 80% dos gastos", cor: COR.saida },
          { rotulo: "Demais", cor: "var(--g-neutro)" },
        ]}
      />
      <ol className="ranking" aria-label={rotulo}>
        {categorias.map((c, i) => {
          const essencial = i === 0 || categorias[i - 1].acumulado < 0.8;
          return (
            <li
              key={c.nome}
              className="alvo"
              tabIndex={0}
              data-dica={dica(c.nome, [
                ["Total", formatarValor(c.total), essencial ? COR.saida : "var(--g-neutro)"],
                ["Do total", formatarPercentual(c.participacao)],
                ["Acumulado", formatarPercentual(c.acumulado)],
                ["Lançamentos", String(c.quantidade)],
                ["Mediana", formatarValor(c.mediana)],
              ])}
            >
              <span className="ranking-nome">
                <i className="cor" style={{ background: c.cor }} aria-hidden /> {c.nome}
              </span>
              <span className="ranking-trilho">
                <span className="ranking-barra" style={{ width: `${(c.total / max) * 100}%`, background: essencial ? COR.saida : "var(--g-neutro)" }} />
              </span>
              <span className="ranking-valor">
                {formatarCompacto(c.total)} <small>{formatarPercentual(c.participacao, 0)}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

// ---------- Distribuição dos valores (histograma em faixas 1-2,5-5) ----------

export function Histograma({ distribuicao }: { distribuicao: NonNullable<Analise["distribuicao"]> }) {
  const A = 240;
  const faixas = distribuicao.faixas;
  const max = Math.max(1, ...faixas.map((f) => f.quantidade));
  const ticks = ticksEixo(max);
  const topoEscala = ticks[ticks.length - 1];
  const y = (v: number) => A - M.baixo - (v / topoEscala) * (A - M.baixo - M.topo);
  const faixa = (L - M.esquerda - M.direita) / faixas.length;
  const coluna = Math.min(faixa - 2, 48); // histograma: colunas encostadas, separadas pelo vão de 2px
  const comMediana = faixas.findIndex((f) => distribuicao.mediana >= f.de && (f.ate === null || distribuicao.mediana < f.ate));

  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Quantidade de saídas por faixa de valor">
      <Grade ticks={ticks} y={y} largura={L} formato={(v) => v.toLocaleString("pt-BR")} />
      {faixas.map((f, i) => {
        const centro = M.esquerda + faixa * i + faixa / 2;
        const base = y(0);
        return (
          <g key={f.rotulo} className="alvo" tabIndex={0} data-dica={dica(`R$ ${f.rotulo}`, [["Lançamentos", String(f.quantidade), COR.saida], ["Soma", formatarValor(f.total)], ["Do total de saídas", formatarPercentual(f.quantidade / distribuicao.quantidade)]])} aria-label={`R$ ${f.rotulo}: ${f.quantidade} lançamentos`}>
            <rect className="area-alvo" x={centro - faixa / 2} y={M.topo} width={faixa} height={A - M.topo - M.baixo} />
            <path className="marca" fill={i === comMediana ? COR.saida : "var(--g-saida-suave)"} d={caminhoColuna(centro - coluna / 2, base, coluna, base - y(f.quantidade))} />
            {i === comMediana && (
              // Acima da mais alta entre esta coluna e as vizinhas, para o rótulo não ser cortado por elas.
              <text
                className="rotulo-valor"
                x={centro}
                y={Math.min(...[faixas[i - 1], f, faixas[i + 1]].filter(Boolean).map((v) => y(v!.quantidade))) - 6}
                textAnchor="middle"
              >
                mediana {formatarCompacto(distribuicao.mediana)}
              </text>
            )}
            <text className="rotulo-eixo" x={centro} y={A - 8} textAnchor="middle">
              {f.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Gasto médio por dia da semana (ênfase no maior) ----------

export function DiasDaSemana({ semana }: { semana: Analise["semana"] }) {
  const A = 220;
  const max = Math.max(1, ...semana.map((d) => d.mediaPorDia));
  const ticks = ticksEixo(max, 3);
  const topoEscala = ticks[ticks.length - 1];
  const y = (v: number) => A - M.baixo - (v / topoEscala) * (A - M.baixo - M.topo);
  const faixa = (L - M.esquerda - M.direita) / 7;
  const coluna = 24;
  const maior = semana.reduce((a, b) => (b.mediaPorDia > a.mediaPorDia ? b : a), semana[0]);

  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Gasto médio por dia da semana">
      <Grade ticks={ticks} y={y} largura={L} />
      {semana.map((d, i) => {
        const centro = M.esquerda + faixa * i + faixa / 2;
        const base = y(0);
        const ehMaior = d === maior;
        return (
          <g key={d.nome} className="alvo" tabIndex={0} data-dica={dica(d.nome, [["Média por dia", formatarValor(d.mediaPorDia), ehMaior ? COR.saida : "var(--g-neutro)"], ["Total no período", formatarValor(d.total)], ["Lançamentos", String(d.quantidade)]])} aria-label={`${d.nome}: média ${formatarValor(d.mediaPorDia)}`}>
            <rect className="area-alvo" x={centro - faixa / 2} y={M.topo} width={faixa} height={A - M.topo - M.baixo} />
            <path className="marca" fill={ehMaior ? COR.saida : "var(--g-neutro)"} d={caminhoColuna(centro - coluna / 2, base, coluna, base - y(d.mediaPorDia))} />
            {ehMaior && (
              <text className="rotulo-valor" x={centro} y={y(d.mediaPorDia) - 6} textAnchor="middle">
                {formatarCompacto(d.mediaPorDia)}
              </text>
            )}
            <text className="rotulo-eixo" x={centro} y={A - 8} textAnchor="middle">
              {d.nome}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Calendário de gastos (mapa de calor, escala sequencial de um tom) ----------

export function Calendario({ dias }: { dias: Dia[] }) {
  const celula = 18;
  const vao = 3;
  const esquerda = 30;
  const topo = 20;
  // Colunas = semanas (começando na segunda); linhas = dias da semana.
  const deslocamento = dias[0]?.diaSemana ?? 0;
  const semanas = Math.ceil((dias.length + deslocamento) / 7);
  const largura = esquerda + semanas * (celula + vao) + 4;
  const altura = topo + 7 * (celula + vao) + 4;

  // Classes por quartis dos dias com gasto (zero tem a sua própria cor).
  const positivos = dias.map((d) => d.saidas).filter((v) => v > 0);
  const cortes = [0.25, 0.5, 0.75].map((p) => quantil(positivos, p));
  const classe = (v: number) => (v <= 0 ? 0 : v <= cortes[0] ? 1 : v <= cortes[1] ? 2 : v <= cortes[2] ? 3 : 4);
  const faixasLegenda = ["Sem gasto", `até ${formatarCompacto(cortes[0])}`, `até ${formatarCompacto(cortes[1])}`, `até ${formatarCompacto(cortes[2])}`, `acima de ${formatarCompacto(cortes[2])}`];

  const mesesMarcados = new Set<string>();

  return (
    <>
      <ul className="legenda escala">
        {faixasLegenda.map((r, i) => (
          <li key={r}>
            <i className={`chave-barra seq-${i}`} />
            {r}
          </li>
        ))}
      </ul>
      {/* Nunca maior que o tamanho natural: esticado, os quadrados e o texto ficariam enormes. */}
      <svg viewBox={`0 0 ${largura} ${altura}`} className="calendario" style={{ maxWidth: largura * 1.25 }} role="img" aria-label="Gasto por dia no período">
        {[0, 2, 4].map((d) => (
          <text key={d} className="rotulo-eixo" x={0} y={topo + d * (celula + vao) + celula / 2} dy="0.32em">
            {NOMES_DIAS[d]}
          </text>
        ))}
        {dias.map((d, i) => {
          const pos = i + deslocamento;
          const coluna = Math.floor(pos / 7);
          const cx = esquerda + coluna * (celula + vao);
          const mes = d.data.slice(0, 7);
          const marcarMes = !mesesMarcados.has(mes) && (d.data.endsWith("-01") || i === 0);
          if (marcarMes) mesesMarcados.add(mes);
          return (
            <g key={d.data}>
              {marcarMes && (
                <text className="rotulo-eixo" x={cx} y={12}>
                  {mesCurto(mes)}
                </text>
              )}
              <rect
                className={`celula seq-${classe(d.saidas)}`}
                x={cx}
                y={topo + d.diaSemana * (celula + vao)}
                width={celula}
                height={celula}
                rx={3}
                data-dica={dica(`${NOMES_DIAS[d.diaSemana]}, ${formatarData(d.data)}`, [["Saídas", formatarValor(d.saidas)]])}
              />
            </g>
          );
        })}
      </svg>
    </>
  );
}

// ---------- Custo fixo × variável (barra segmentada alta, 2 partes) ----------

export function FixoVariavel({ fixo }: { fixo: Analise["fixo"] }) {
  const total = fixo.recorrente + fixo.avulso;
  if (!total) return null;
  const partes = [
    { rotulo: "Recorrentes (fixos)", valor: fixo.recorrente, cor: COR.saida, classe: "" },
    { rotulo: "Avulsos (variáveis)", valor: fixo.avulso, cor: "var(--g-neutro)", classe: "neutro" },
  ].filter((p) => p.valor > 0);
  return (
    <>
      <div className="segmentada" role="img" aria-label={partes.map((p) => `${p.rotulo}: ${formatarPercentual(p.valor / total)}`).join("; ")}>
        {partes.map((p) => (
          <span
            key={p.rotulo}
            className={`segmento alvo ${p.classe}`}
            tabIndex={0}
            style={{ flexGrow: p.valor, background: p.cor }}
            data-dica={dica(p.rotulo, [["Valor", formatarValor(p.valor), p.cor], ["Das saídas", formatarPercentual(p.valor / total)]])}
          >
            {p.valor / total >= 0.12 ? formatarPercentual(p.valor / total, 0) : ""}
          </span>
        ))}
      </div>
      <Legenda itens={partes.map((p) => ({ rotulo: p.rotulo, cor: p.cor }))} />
    </>
  );
}
