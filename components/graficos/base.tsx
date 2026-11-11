// Peças compartilhadas dos gráficos SVG (renderizados no servidor).
import type { ReactNode } from "react";

export const COR = {
  entrada: "var(--g-entrada)",
  saida: "var(--g-saida)",
  negativo: "var(--g-negativo)",
} as const;

// Monta o atributo data-dica lido pelo componente <Dicas />.
export function dica(titulo: string, linhas: [string, string, string?][]): string {
  return JSON.stringify({ titulo, linhas });
}

// Coluna com a ponta de dados arredondada (4px) e a base reta, crescendo a partir da linha de base.
// Para valores negativos (barra para baixo), a ponta arredondada fica embaixo.
export function caminhoColuna(x: number, base: number, largura: number, altura: number): string {
  if (Math.abs(altura) < 0.5) return "";
  const r = Math.min(4, largura / 2, Math.abs(altura));
  if (altura > 0) {
    const topo = base - altura;
    return `M${x},${base}V${topo + r}Q${x},${topo} ${x + r},${topo}H${x + largura - r}Q${x + largura},${topo} ${x + largura},${topo + r}V${base}Z`;
  }
  const fundo = base - altura;
  return `M${x},${base}V${fundo - r}Q${x},${fundo} ${x + r},${fundo}H${x + largura - r}Q${x + largura},${fundo} ${x + largura},${fundo - r}V${base}Z`;
}

export function Legenda({ itens }: { itens: { rotulo: string; cor: string; forma?: "barra" | "linha" }[] }) {
  return (
    <ul className="legenda">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <i className={i.forma === "linha" ? "chave-linha" : "chave-barra"} style={{ background: i.cor }} />
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}

// Moldura de cada gráfico: título, subtítulo, o desenho e a tabela com os mesmos números.
export function Painel({
  titulo,
  subtitulo,
  children,
  tabela,
  largo,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  children: ReactNode;
  tabela?: ReactNode;
  largo?: boolean;
}) {
  return (
    <figure className={`painel${largo ? " largo" : ""}`}>
      <figcaption>
        <h3>{titulo}</h3>
        {subtitulo && <p>{subtitulo}</p>}
      </figcaption>
      <div className="grafico">{children}</div>
      {tabela && (
        <details className="ver-tabela">
          <summary>Ver tabela</summary>
          <div className="tabela-rolagem">{tabela}</div>
        </details>
      )}
    </figure>
  );
}
