import FormularioCategoria from "@/components/FormularioCategoria";
import { exigirUsuario } from "@/lib/sessao";
import { criarCategoria } from "../actions";

export default async function NovaCategoria() {
  await exigirUsuario();
  return (
    <main>
      <h1>Nova categoria</h1>
      <FormularioCategoria
        action={criarCategoria}
        iniciais={{ nome: "", tipo: "saida", cor: "#2A78D6", ativa: true }}
        textoBotao="Salvar"
      />
    </main>
  );
}
