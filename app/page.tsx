import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Caderneta da Claudia</h1>
      <p>Seu controle financeiro pessoal: anote o que entra e o que sai.</p>
      <Link href="/lancamentos">Ver lançamentos</Link>
      {" · "}
      <Link href="/login">Entrar</Link>
    </main>
  );
}
