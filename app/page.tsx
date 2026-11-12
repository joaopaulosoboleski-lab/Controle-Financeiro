import Link from "next/link";
import { redirect } from "next/navigation";
import { lerUsuarioId } from "@/lib/sessao";

export default async function Home() {
  if ((await lerUsuarioId()) !== undefined) redirect("/lancamentos");

  return (
    <main>
      <h1>Caderneta da Cláudia</h1>
      <p>Seu controle financeiro pessoal: anote o que entra e o que sai.</p>
      <Link href="/login">Entrar</Link>
    </main>
  );
}
