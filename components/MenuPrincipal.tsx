"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; rotulo: string };

// Menu do painel. No celular é uma faixa que rola de lado (uma linha só); a página atual fica marcada.
// No app instalado (PWA) não há botão "voltar" do navegador: o menu é o caminho entre as telas.
export default function MenuPrincipal({ admin }: { admin: boolean }) {
  const caminho = usePathname();
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

  return (
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
  );
}
