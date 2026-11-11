"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { EstadoFormulario, ValoresFormulario } from "@/lib/formulario";
import type { OpcaoCategoria, OpcaoConta } from "@/lib/lancamentos";

type FormularioLancamentoProps = {
  action: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  contas: OpcaoConta[];
  categorias: OpcaoCategoria[];
  iniciais: ValoresFormulario;
  id?: number;
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

export default function FormularioLancamento({
  action,
  contas,
  categorias,
  iniciais,
  id,
  textoBotao,
}: FormularioLancamentoProps) {
  const [estado, formAction] = useActionState(action, {} as EstadoFormulario);
  // Depois de um erro, mantém o que a pessoa digitou (o React limpa o formulário após a action).
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
        Descrição
        <input type="text" name="descricao" defaultValue={v.descricao} maxLength={100} required />
      </label>

      <label>
        Valor (R$)
        <input type="text" name="valor" inputMode="decimal" defaultValue={v.valor} placeholder="0,00" required />
      </label>

      <label>
        Tipo
        <select name="tipo" defaultValue={v.tipo || "saida"}>
          <option value="saida">Saída</option>
          <option value="entrada">Entrada</option>
        </select>
      </label>

      <label>
        Data
        <input type="date" name="data" defaultValue={v.data} required />
      </label>

      <label>
        Conta
        <select name="contaId" defaultValue={v.contaId} required>
          <option value="" disabled>
            Escolha a conta
          </option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Categoria
        <select name="categoriaId" defaultValue={v.categoriaId} required>
          <option value="" disabled>
            Escolha a categoria
          </option>
          {(["saida", "entrada"] as const).map((tipo) => (
            <optgroup key={tipo} label={tipo === "saida" ? "Saídas" : "Entradas"}>
              {categorias
                .filter((c) => c.tipo === tipo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <BotaoEnviar texto={textoBotao} />
      <Link href="/lancamentos">Cancelar</Link>
    </form>
  );
}
