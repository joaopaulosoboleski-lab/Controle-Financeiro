import Link from "next/link";
import { sair } from "@/app/login/actions";
import Logo from "@/components/Logo";
import MenuPrincipal from "@/components/MenuPrincipal";
import { primeiroNome } from "@/lib/perfil";
import { ehAdmin } from "@/lib/usuarios";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const [admin, nome] = await Promise.all([ehAdmin(), primeiroNome()]);

  return (
    <>
      <header className="topo">
        <div className="topo-linha">
          <Link href="/lancamentos" className="topo-marca" aria-label="Início">
            <Logo tamanho={30} dono={nome} />
          </Link>
          {/* O menu (botão ☰ + gaveta) é cliente; o "Sair" é Server Action e entra pronto no rodapé dele. */}
          <MenuPrincipal
            admin={admin}
            rodape={
              <form action={sair} className="sair">
                <button type="submit">Sair</button>
              </form>
            }
          />
        </div>
      </header>
      {children}
    </>
  );
}
