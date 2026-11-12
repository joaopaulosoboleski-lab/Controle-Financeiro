import Link from "next/link";
import FormularioLancamento from "@/components/FormularioLancamento";
import { listarCategorias, listarContas } from "@/lib/lancamentos";
import { criarLancamento } from "../actions";

export default async function NovoLancamento() {
  const [contas, categorias] = await Promise.all([listarContas(), listarCategorias()]);
  // Data de hoje no fuso do Brasil (formato AAAA-MM-DD).
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  return (
    <main>
      <h1>Novo lançamento</h1>
      {(contas.length === 0 || categorias.length === 0) && (
        <p className="erro" role="alert">
          Antes de lançar, cadastre pelo menos uma <Link href="/contas/nova">conta</Link> e uma{" "}
          <Link href="/categorias/nova">categoria</Link>.
        </p>
      )}
      <FormularioLancamento
        action={criarLancamento}
        contas={contas}
        categorias={categorias}
        iniciais={{ descricao: "", valor: "", tipo: "saida", data: hoje, contaId: "", categoriaId: "" }}
        textoBotao="Salvar"
      />
    </main>
  );
}
