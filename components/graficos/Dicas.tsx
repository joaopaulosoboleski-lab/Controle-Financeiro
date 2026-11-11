"use client";

import { useEffect, useRef } from "react";

// Uma única dica flutuante para todos os gráficos da página.
// Qualquer elemento com data-dica='{"titulo": "...", "linhas": [["rótulo","valor","cor"?], ...]}'
// mostra a dica ao passar o mouse ou receber foco pelo teclado.
// O texto entra com textContent (os nomes vêm de dados digitados pelas pessoas).
type Dica = { titulo: string; linhas: [string, string, string?][] };

export default function Dicas() {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;

    function alvo(evento: Event): HTMLElement | null {
      return (evento.target as Element | null)?.closest?.("[data-dica]") ?? null;
    }

    function preencher(dados: Dica) {
      if (!el) return;
      el.replaceChildren();
      const titulo = document.createElement("div");
      titulo.className = "dica-titulo";
      titulo.textContent = dados.titulo;
      el.append(titulo);
      for (const [rotulo, valor, cor] of dados.linhas) {
        const linha = document.createElement("div");
        linha.className = "dica-linha";
        if (cor) {
          const chave = document.createElement("i");
          chave.style.background = cor;
          linha.append(chave);
        }
        const v = document.createElement("strong");
        v.textContent = valor;
        const r = document.createElement("span");
        r.textContent = rotulo;
        linha.append(v, r);
        el.append(linha);
      }
    }

    function posicionar(x: number, y: number) {
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      const margem = 12;
      let esquerda = x + margem;
      let topo = y + margem;
      if (esquerda + width > window.innerWidth - 8) esquerda = x - width - margem;
      if (topo + height > window.innerHeight - 8) topo = y - height - margem;
      el.style.transform = `translate(${Math.max(8, esquerda)}px, ${Math.max(8, topo)}px)`;
    }

    function mostrar(origem: HTMLElement, x?: number, y?: number) {
      if (!el) return;
      try {
        preencher(JSON.parse(origem.dataset.dica ?? "") as Dica);
      } catch {
        return;
      }
      el.hidden = false;
      if (x === undefined || y === undefined) {
        const r = origem.getBoundingClientRect();
        posicionar(r.left + r.width / 2, r.top);
      } else {
        posicionar(x, y);
      }
    }

    function esconder() {
      if (el) el.hidden = true;
    }

    const aoMover = (e: PointerEvent) => {
      const a = alvo(e);
      if (a) mostrar(a, e.clientX, e.clientY);
      else esconder();
    };
    const aoFocar = (e: FocusEvent) => {
      const a = alvo(e);
      if (a) mostrar(a);
    };

    document.addEventListener("pointermove", aoMover);
    document.addEventListener("focusin", aoFocar);
    document.addEventListener("focusout", esconder);
    window.addEventListener("scroll", esconder, { passive: true });
    return () => {
      document.removeEventListener("pointermove", aoMover);
      document.removeEventListener("focusin", aoFocar);
      document.removeEventListener("focusout", esconder);
      window.removeEventListener("scroll", esconder);
    };
  }, []);

  return <div ref={caixa} className="dica" role="tooltip" hidden />;
}
