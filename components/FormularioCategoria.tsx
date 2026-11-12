"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EstadoCategoria } from "@/app/(painel)/categorias/actions";
import BotaoEnviar from "@/components/BotaoEnviar";
import type { ValoresCategoria } from "@/lib/validacao-cadastros";

type Props = {
  action: (estado: EstadoCategoria, formData: FormData) => Promise<EstadoCategoria>;
  iniciais: ValoresCategoria;
  id?: number; // presente na edição
  tipoTravado?: boolean; // categoria já usada: entrada/saída não muda
  textoBotao: string;
};

export default function FormularioCategoria({ action, iniciais, id, tipoTravado, textoBotao }: Props) {
  const [estado, formAction] = useActionState(action, {} as EstadoCategoria);
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
        <input type="text" name="nome" defaultValue={v.nome} maxLength={40} required placeholder="Ex.: Mercado" />
      </label>

      <label>
        Tipo
        <select name="tipo" defaultValue={v.tipo || "saida"} disabled={tipoTravado}>
          <option value="saida">Saída (gasto)</option>
          <option value="entrada">Entrada (receita)</option>
        </select>
        {tipoTravado && <small>Já usada em lançamentos: o tipo não pode mudar.</small>}
      </label>
      {/* Select desabilitado não é enviado: manda o tipo atual. */}
      {tipoTravado && <input type="hidden" name="tipo" value={v.tipo} />}

      <label>
        Cor
        <input type="color" name="cor" defaultValue={v.cor} required />
      </label>

      {edicao && (
        <label className="opcao">
          <input type="checkbox" name="ativa" defaultChecked={v.ativa} />
          Ativa (desmarque para arquivar: some dos formulários, mas o histórico fica)
        </label>
      )}

      <BotaoEnviar texto={textoBotao} />
      <Link href="/categorias">Cancelar</Link>
    </form>
  );
}
