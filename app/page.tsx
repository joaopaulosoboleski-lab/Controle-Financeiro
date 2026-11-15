import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { lerUsuarioId } from "@/lib/sessao";

export default async function Home() {
  if ((await lerUsuarioId()) !== undefined) redirect("/lancamentos");

  return (
    <main className="entrada">
      <h1 className="titulo-logo">
        <Logo tamanho={72} className="logo-grande" />
      </h1>
      <p>Seu controle financeiro pessoal: anote o que entra e o que sai.</p>
      <Link href="/login">Entrar</Link>
    </main>
  );
}
