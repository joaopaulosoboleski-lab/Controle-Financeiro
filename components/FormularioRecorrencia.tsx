"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EstadoRecorrencia } from "@/app/(painel)/recorrencias/actions";
import BotaoEnviar from "@/components/BotaoEnviar";
import type { OpcaoCategoria, OpcaoConta } from "@/lib/lancamentos";
import type { ValoresRecorrencia } from "@/lib/validacao-cadastros";

type Props = {
  action: (estado: EstadoRecorrencia, formData: FormData) => Promise<EstadoRecorrencia>;
  contas: OpcaoConta[];
  categorias: OpcaoCategoria[];
  iniciais: ValoresRecorrencia;
  id?: number;
  textoBotao: string;
};

export default function FormularioRecorrencia({ action, contas, categorias, iniciais, id, textoBotao }: Props) {
  const [estado, formAction] = useActionState(action, {} as EstadoRecorrencia);
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
        <input type="text" name="descricao" defaultValue={v.descricao} maxLength={100} required placeholder="Ex.: Aluguel" />
      </label>

      <label>
        Valor previsto (R$)
        <input type="text" name="valor" inputMode="decimal" defaultValue={v.valor} placeholder="0,00" required />
      </label>

      <label>
        Dia do mês
        <input type="number" name="dia" min={1} max={28} defaultValue={v.dia} required />
        <small>De 1 a 28, para caber em qualquer mês.</small>
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
        <small>O tipo (entrada ou saída) vem da categoria.</small>
      </label>

      <label>
        Começa em
        <input type="date" name="dataInicio" defaultValue={v.dataInicio} required />
      </label>

      <label>
        Termina em (opcional)
        <input type="date" name="dataFim" defaultValue={v.dataFim} />
      </label>

      <BotaoEnviar texto={textoBotao} />
      <Link href="/recorrencias">Cancelar</Link>
    </form>
  );
}
