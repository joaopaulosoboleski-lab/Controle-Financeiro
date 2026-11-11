"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  atualizarPerfil,
  trocarSenha,
  type EstadoPerfil,
  type EstadoSenha,
} from "@/app/(painel)/perfil/actions";

function BotaoEnviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Salvando..." : texto}
    </button>
  );
}

function Mensagem({ erro, sucesso }: { erro?: string; sucesso?: string }) {
  if (erro) {
    return (
      <p className="erro" role="alert">
        {erro}
      </p>
    );
  }
  if (sucesso) {
    return (
      <p className="sucesso" role="status">
        {sucesso}
      </p>
    );
  }
  return null;
}

export function FormularioDados({ nome, email }: { nome: string; email: string }) {
  const [estado, formAction] = useActionState(atualizarPerfil, {} as EstadoPerfil);
  // Depois de enviar, mostra o que foi salvo (ou o que a pessoa digitou, se deu erro).
  const v = estado.valores ?? { nome, email };

  return (
    <form action={formAction} className="formulario">
      <Mensagem erro={estado.erro} sucesso={estado.sucesso} />
      <label>
        Nome
        <input type="text" name="nome" defaultValue={v.nome} maxLength={80} required autoComplete="name" />
      </label>
      <label>
        E-mail
        <input type="email" name="email" defaultValue={v.email} required autoComplete="email" />
      </label>
      <BotaoEnviar texto="Salvar dados" />
    </form>
  );
}

export function FormularioSenha() {
  const [estado, formAction] = useActionState(trocarSenha, {} as EstadoSenha);

  return (
    <form action={formAction} className="formulario">
      <Mensagem erro={estado.erro} sucesso={estado.sucesso} />
      <label>
        Senha atual
        <input type="password" name="atual" required autoComplete="current-password" />
      </label>
      <label>
        Nova senha
        <input type="password" name="nova" required minLength={8} autoComplete="new-password" />
      </label>
      <label>
        Confirme a nova senha
        <input type="password" name="confirmacao" required minLength={8} autoComplete="new-password" />
      </label>
      <BotaoEnviar texto="Trocar senha" />
    </form>
  );
}
