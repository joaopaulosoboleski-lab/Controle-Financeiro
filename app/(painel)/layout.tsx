import Link from "next/link";
import { sair } from "@/app/login/actions";
import Logo from "@/components/Logo";
import MenuPrincipal from "@/components/MenuPrincipal";
import { ehAdmin } from "@/lib/usuarios";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const admin = await ehAdmin();

  return (
    <>
      <header className="topo">
        <div className="topo-linha">
          <Link href="/lancamentos" className="topo-marca" aria-label="Caderneta da Cláudia: início">
            <Logo tamanho={30} />
          </Link>
          <form action={sair} className="sair">
            <button type="submit">Sair</button>
          </form>
        </div>
        <nav aria-label="Menu principal">
          <MenuPrincipal admin={admin} />
        </nav>
      </header>
      {children}
    </>
  );
}
