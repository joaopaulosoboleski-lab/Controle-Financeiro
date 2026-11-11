import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Página não encontrada</h1>
      <p>Não encontramos o que você procurava.</p>
      <Link href="/">Voltar para o início</Link>
    </main>
  );
}
