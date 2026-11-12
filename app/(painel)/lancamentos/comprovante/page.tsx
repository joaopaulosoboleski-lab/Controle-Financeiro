import Link from "next/link";
import LeitorComprovante from "@/components/LeitorComprovante";
import { listarCategorias, listarContas } from "@/lib/lancamentos";
import { criarLancamento } from "../actions";

// Entrada por foto: o celular lê o comprovante e preenche o formulário; quem salva é a mesma
// action do "Novo lançamento" (mesma validação e mesma regra de dono, R8).
export default async function EntradaPorFoto() {
  const [contas, categorias] = await Promise.all([listarContas(), listarCategorias()]);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  return (
    <main>
      <h1>Entrada por foto</h1>
      {contas.length === 0 || !categorias.some((c) => c.tipo === "entrada") ? (
        <p className="erro" role="alert">
          Antes, cadastre pelo menos uma <Link href="/contas/nova">conta</Link> e uma{" "}
          <Link href="/categorias/nova">categoria de entrada</Link>.
        </p>
      ) : (
        <LeitorComprovante action={criarLancamento} contas={contas} categorias={categorias} hoje={hoje} />
      )}
    </main>
  );
}
