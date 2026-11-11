import { notFound } from "next/navigation";
import { FormularioDados, FormularioSenha } from "@/components/FormulariosPerfil";
import { formatarData } from "@/lib/lancamentos";
import { buscarPerfil } from "@/lib/perfil";

export default async function Perfil() {
  const perfil = await buscarPerfil();
  if (!perfil) notFound();

  const periodo =
    perfil.primeiroLancamento && perfil.ultimoLancamento
      ? `${formatarData(perfil.primeiroLancamento)} a ${formatarData(perfil.ultimoLancamento)}`
      : "—";

  return (
    <main>
      <h1>Meu perfil</h1>
      <p>
        Olá, <strong>{perfil.nome}</strong>. Você usa a Caderneta desde {formatarData(perfil.criadoEm)}.
      </p>

      <h2>Resumo</h2>
      <div className="resumo">
        <div>
          <span>Contas</span>
          <span>{perfil.contas}</span>
        </div>
        <div>
          <span>Categorias ativas</span>
          <span>{perfil.categorias}</span>
        </div>
        <div>
          <span>Recorrências</span>
          <span>{perfil.recorrencias}</span>
        </div>
        <div>
          <span>Lançamentos</span>
          <span>{perfil.lancamentos}</span>
        </div>
        <div>
          <span>Período dos lançamentos</span>
          <span>{periodo}</span>
        </div>
      </div>

      <h2>Meus dados</h2>
      <FormularioDados nome={perfil.nome} email={perfil.email} />

      <h2>Trocar senha</h2>
      <FormularioSenha />
    </main>
  );
}
