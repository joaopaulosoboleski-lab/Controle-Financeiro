import FormularioUsuario from "@/components/FormularioUsuario";
import { exigirAdmin } from "@/lib/usuarios";
import { criarUsuario } from "../actions";

export default async function NovoUsuario() {
  await exigirAdmin();

  return (
    <main>
      <h1>Novo usuário</h1>
      <FormularioUsuario
        action={criarUsuario}
        iniciais={{ nome: "", email: "", admin: false }}
        textoBotao="Cadastrar"
      />
    </main>
  );
}
