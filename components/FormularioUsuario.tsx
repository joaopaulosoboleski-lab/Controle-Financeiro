"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { EstadoUsuario, ValoresUsuario } from "@/app/(painel)/usuarios/actions";

type FormularioUsuarioProps = {
  action: (estado: EstadoUsuario, formData: FormData) => Promise<EstadoUsuario>;
  iniciais: ValoresUsuario;
  id?: number; // presente na edição
  ehVoceMesmo?: boolean;
  textoBotao: string;
};

function BotaoEnviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Salvando..." : texto}
    </button>
  );
}

export default function FormularioUsuario({ action, iniciais, id, ehVoceMesmo, textoBotao }: FormularioUsuarioProps) {
  const [estado, formAction] = useActionState(action, {} as EstadoUsuario);
  // Depois de um erro, mantém o que foi digitado (o React limpa o formulário após a action).
  const v = estado.valores ?? iniciais;
  const edicao = id !== undefined;

  return (
    <form action={formAction} className="formulario">
      {edicao && <input type="hidden" name="id" value={id} />}

      {estado.erro && (
        <p className="erro" role="alert">
          {estado.erro}
        </p>
      )}

      <label>
        Nome
        <input type="text" name="nome" defaultValue={v.nome} maxLength={80} required autoComplete="off" />
      </label>

      <label>
        E-mail
        <input type="email" name="email" defaultValue={v.email} required autoComplete="off" />
      </label>

      <label>
        {edicao ? "Nova senha (deixe em branco para manter)" : "Senha"}
        <input type="password" name="senha" minLength={8} required={!edicao} autoComplete="new-password" />
      </label>

      <label>
        Confirme a senha
        <input type="password" name="confirmacao" minLength={8} required={!edicao} autoComplete="new-password" />
      </label>

      <label className="opcao">
        <input type="checkbox" name="admin" defaultChecked={v.admin} disabled={ehVoceMesmo} />
        Administrador (pode gerenciar usuários)
      </label>
      {/* Checkbox desabilitado não é enviado: mantém o próprio admin ligado. */}
      {ehVoceMesmo && <input type="hidden" name="admin" value="on" />}

      <BotaoEnviar texto={textoBotao} />
      <Link href="/usuarios">Cancelar</Link>
    </form>
  );
}
