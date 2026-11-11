import { notFound } from "next/navigation";
import BotaoExcluir from "@/components/BotaoExcluir";
import FormularioUsuario from "@/components/FormularioUsuario";
import { formatarData } from "@/lib/lancamentos";
import { buscarUsuario, exigirAdmin } from "@/lib/usuarios";
import { atualizarUsuario, excluirUsuario } from "../../actions";

const ERROS_EXCLUSAO: Record<string, string> = {
  proprio: "Você não pode excluir o seu próprio usuário.",
  "com-dados": "Este usuário tem dados cadastrados e não pode ser excluído.",
  falha: "Não foi possível excluir agora. Tente novamente.",
};

export default async function EditarUsuario({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const adminId = await exigirAdmin();
  const { id } = await params;
  const { erro } = await searchParams;

  const usuario = await buscarUsuario(Number(id));
  if (!usuario) notFound();
  const ehVoceMesmo = usuario.id === adminId;

  return (
    <main>
      <h1>Editar usuário</h1>
      <p>Cadastrado em {formatarData(usuario.criadoEm)}.</p>

      <FormularioUsuario
        action={atualizarUsuario}
        id={usuario.id}
        ehVoceMesmo={ehVoceMesmo}
        iniciais={{ nome: usuario.nome, email: usuario.email, admin: usuario.admin }}
        textoBotao="Salvar alterações"
      />

      <h2>Excluir</h2>
      {erro && ERROS_EXCLUSAO[erro] && (
        <p className="erro" role="alert">
          {ERROS_EXCLUSAO[erro]}
        </p>
      )}
      {ehVoceMesmo ? (
        <p>Você não pode excluir o seu próprio usuário.</p>
      ) : usuario.registros > 0 ? (
        <p>
          Não é possível excluir: este usuário tem {usuario.contas} conta(s), {usuario.categorias} categoria(s),{" "}
          {usuario.recorrencias} recorrência(s) e {usuario.lancamentos} lançamento(s). Excluir apagaria o histórico.
        </p>
      ) : (
        <BotaoExcluir
          action={excluirUsuario}
          id={usuario.id}
          texto="Excluir usuário"
          confirmacao={`Excluir o usuário ${usuario.nome}? Essa ação não pode ser desfeita.`}
        />
      )}
    </main>
  );
}
