"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmarLancamento } from "@/app/(painel)/lancamentos/actions";
import BotaoEnviar from "@/components/BotaoEnviar";
import type { EstadoConfirmacao, ValoresConfirmacao } from "@/lib/formulario";
import type { OpcaoConta } from "@/lib/lancamentos";

type Props = {
  id: number;
  contas: OpcaoConta[];
  iniciais: ValoresConfirmacao;
};

// Confirmar um previsto: ajusta valor, data e conta se o real foi diferente do previsto.
export default function FormularioConfirmacao({ id, contas, iniciais }: Props) {
  const [estado, formAction] = useActionState(confirmarLancamento, {} as EstadoConfirmacao);
  // Depois de um erro, mantém o que foi digitado (o React limpa o formulário após a action).
  const v = estado.valores ?? iniciais;

  return (
    <form action={formAction} className="formulario">
      <input type="hidden" name="id" value={id} />
      {estado.erro && (
        <p className="erro" role="alert">
          {estado.erro}
        </p>
      )}

      <label>
        Valor (R$)
        <input type="text" name="valor" inputMode="decimal" defaultValue={v.valor} required />
      </label>

      <label>
        Data
        <input type="date" name="data" defaultValue={v.data} required />
      </label>

      <label>
        Conta
        <select name="contaId" defaultValue={v.contaId} required>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <BotaoEnviar texto="Confirmar lançamento" enviando="Confirmando..." />
      <Link href={`/lancamentos/${id}`}>Cancelar</Link>
    </form>
  );
}
