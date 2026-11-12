"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EstadoConta } from "@/app/(painel)/contas/actions";
import BotaoEnviar from "@/components/BotaoEnviar";
import { TIPOS_CONTA, type ValoresConta } from "@/lib/validacao-cadastros";

type Props = {
  action: (estado: EstadoConta, formData: FormData) => Promise<EstadoConta>;
  iniciais: ValoresConta;
  id?: number;
  textoBotao: string;
};

export default function FormularioConta({ action, iniciais, id, textoBotao }: Props) {
  const [estado, formAction] = useActionState(action, {} as EstadoConta);
  // Depois de um erro, mantém o que foi digitado (o React limpa o formulário após a action).
  const v = estado.valores ?? iniciais;

  return (
    <form action={formAction} className="formulario">
      {id !== undefined && <input type="hidden" name="id" value={id} />}
      {estado.erro && (
        <p className="erro" role="alert">
          {estado.erro}
        </p>
      )}

      <label>
        Nome
        <input type="text" name="nome" defaultValue={v.nome} maxLength={60} required placeholder="Ex.: Conta Corrente Itaú" />
      </label>

      <label>
        Tipo
        <select name="tipo" defaultValue={v.tipo || "corrente"}>
          {Object.entries(TIPOS_CONTA).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </label>

      <label>
        Saldo inicial (R$)
        <input type="text" name="saldoInicial" inputMode="decimal" defaultValue={v.saldoInicial} placeholder="0,00" required />
        <small>Quanto havia na conta na data de abertura. Pode ser 0 ou negativo.</small>
      </label>

      <label>
        Data de abertura
        <input type="date" name="dataAbertura" defaultValue={v.dataAbertura} required />
      </label>

      <BotaoEnviar texto={textoBotao} />
      <Link href="/contas">Cancelar</Link>
    </form>
  );
}
