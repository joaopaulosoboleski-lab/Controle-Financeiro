import { redirect } from "next/navigation";
import { lerUsuarioId } from "@/lib/sessao";
import { entrar } from "./actions";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if ((await lerUsuarioId()) !== undefined) redirect("/lancamentos");
  const { erro } = await searchParams;

  return (
    <main>
      <h1>Entrar</h1>
      {erro === "bloqueado" ? (
        <p className="erro">Muitas tentativas erradas. Espere 15 minutos e tente de novo.</p>
      ) : (
        erro && <p className="erro">E-mail ou senha incorretos.</p>
      )}
      <form action={entrar} className="formulario">
        <label>
          E-mail
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          Senha
          <input type="password" name="senha" required autoComplete="current-password" />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
