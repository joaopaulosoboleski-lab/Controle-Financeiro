import Link from "next/link";
import { sair } from "@/app/login/actions";
import { ehAdmin } from "@/lib/usuarios";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const admin = await ehAdmin();

  return (
    <>
      <nav>
        <Link href="/lancamentos">Lançamentos</Link>
        <Link href="/recorrencias">Recorrências</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/analise">Análise</Link>
        <Link href="/contas">Contas</Link>
        <Link href="/categorias">Categorias</Link>
        <Link href="/perfil">Meu perfil</Link>
        {admin && <Link href="/usuarios">Usuários</Link>}
        <form action={sair} className="sair">
          <button type="submit">Sair</button>
        </form>
      </nav>
      {children}
    </>
  );
}
