import Link from "next/link";
import FormularioRecorrencia from "@/components/FormularioRecorrencia";
import { listarCategorias, listarContas } from "@/lib/lancamentos";
import { criarRecorrencia } from "../actions";

export default async function NovaRecorrencia() {
  const [contas, categorias] = await Promise.all([listarContas(), listarCategorias()]);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  return (
    <main>
      <h1>Nova recorrência</h1>
      {contas.length === 0 || categorias.length === 0 ? (
        <p>
          Antes, cadastre pelo menos uma <Link href="/contas/nova">conta</Link> e uma{" "}
          <Link href="/categorias/nova">categoria</Link>.
        </p>
      ) : (
        <FormularioRecorrencia
          action={criarRecorrencia}
          contas={contas}
          categorias={categorias}
          iniciais={{
            descricao: "",
            valor: "",
            dia: "5",
            contaId: "",
            categoriaId: "",
            dataInicio: `${hoje.slice(0, 7)}-01`,
            dataFim: "",
          }}
          textoBotao="Salvar"
        />
      )}
    </main>
  );
}
