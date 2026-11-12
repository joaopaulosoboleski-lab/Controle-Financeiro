import FormularioConta from "@/components/FormularioConta";
import { exigirUsuario } from "@/lib/sessao";
import { criarConta } from "../actions";

export default async function NovaConta() {
  await exigirUsuario();
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  return (
    <main>
      <h1>Nova conta</h1>
      <FormularioConta
        action={criarConta}
        iniciais={{ nome: "", tipo: "corrente", saldoInicial: "0,00", dataAbertura: hoje }}
        textoBotao="Salvar"
      />
    </main>
  );
}
