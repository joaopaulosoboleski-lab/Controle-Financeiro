"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { href: string; rotulo: string };

// Menu do painel. Celular/tablet: botão ☰ que abre uma gaveta lateral (fecha com Esc, toque fora,
// botão ✕ ou ao trocar de página). Computador (>= 900px): a mesma lista fica sempre visível, em linha.
// No app instalado (PWA) não há botão "voltar" do navegador: o menu é o caminho entre as telas.
// `rodape` recebe o formulário "Sair" (Server Action), que vem pronto do layout do servidor.
export default function MenuPrincipal({ admin, rodape }: { admin: boolean; rodape?: React.ReactNode }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const botaoAbrir = useRef<HTMLButtonElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const gaveta = useRef<HTMLElement>(null);

  const itens: Item[] = [
    { href: "/lancamentos", rotulo: "Lançamentos" },
    { href: "/recorrencias", rotulo: "Recorrências" },
    { href: "/dashboard", rotulo: "Dashboard" },
    { href: "/analise", rotulo: "Análise" },
    { href: "/contas", rotulo: "Contas" },
    { href: "/categorias", rotulo: "Categorias" },
    { href: "/perfil", rotulo: "Meu perfil" },
    ...(admin ? [{ href: "/usuarios", rotulo: "Usuários" }] : []),
  ];

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) botaoAbrir.current?.focus();
  }, []);

  // Trocou de página (inclusive pelo próprio menu): fecha sem roubar o foco da página nova.
  // Padrão do React para "ajustar estado quando uma prop muda", sem efeito.
  const [caminhoAnterior, setCaminhoAnterior] = useState(caminho);
  if (caminho !== caminhoAnterior) {
    setCaminhoAnterior(caminho);
    setAberto(false);
  }

  // Aberta: foco no ✕, página de trás sem rolar, Esc fecha e o Tab fica preso dentro da gaveta.
  useEffect(() => {
    if (!aberto) return;
    botaoFechar.current?.focus();
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar();
        return;
      }
      if (e.key !== "Tab" || !gaveta.current) return;
      const focaveis = gaveta.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    // Se a tela crescer até o layout de computador com a gaveta aberta, desfaz o estado de "aberta".
    const largo = window.matchMedia("(min-width: 900px)");
    function aoMudarLargura() {
      if (largo.matches) fechar(false);
    }

    document.addEventListener("keydown", aoTeclar);
    largo.addEventListener("change", aoMudarLargura);
    return () => {
      document.body.style.overflow = overflowAntes;
      document.removeEventListener("keydown", aoTeclar);
      largo.removeEventListener("change", aoMudarLargura);
    };
  }, [aberto, fechar]);

  return (
    <>
      <button
        ref={botaoAbrir}
        type="button"
        className="menu-botao"
        aria-expanded={aberto}
        aria-controls="menu-gaveta"
        onClick={() => setAberto(true)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="so-leitor">Abrir menu</span>
      </button>

      <div className="menu-fundo" data-aberto={aberto || undefined} onClick={() => fechar()} aria-hidden="true" />

      <nav
        ref={gaveta}
        id="menu-gaveta"
        className="menu-gaveta"
        data-aberto={aberto || undefined}
        aria-label="Menu principal"
      >
        <div className="gaveta-topo">
          <strong>Menu</strong>
          <button ref={botaoFechar} type="button" className="menu-fechar" onClick={() => fechar()}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="so-leitor">Fechar menu</span>
          </button>
        </div>
        <div className="menu-itens">
          {itens.map((item) => {
            const atual = caminho === item.href || caminho.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} aria-current={atual ? "page" : undefined}>
                {item.rotulo}
              </Link>
            );
          })}
        </div>
        {rodape && <div className="gaveta-rodape">{rodape}</div>}
      </nav>
    </>
  );
}
