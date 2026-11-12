"use client";

import { useFormStatus } from "react-dom";

function Botao({ texto, enviando }: { texto: string; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="perigo" disabled={pending}>
      {pending ? enviando : texto}
    </button>
  );
}

type BotaoExcluirProps = {
  action: (formData: FormData) => Promise<void>;
  id?: number; // ausente em ações que não miram um registro (ex.: sair de todos os aparelhos)
  texto?: string;
  enviando?: string;
  confirmacao?: string;
};

export default function BotaoExcluir({
  action,
  id,
  texto = "Excluir lançamento",
  enviando = "Excluindo...",
  confirmacao = "Excluir este lançamento? Essa ação não pode ser desfeita.",
}: BotaoExcluirProps) {
  return (
    <form
      action={action}
      onSubmit={(evento) => {
        if (!window.confirm(confirmacao)) {
          evento.preventDefault();
        }
      }}
    >
      {id !== undefined && <input type="hidden" name="id" value={id} />}
      <Botao texto={texto} enviando={enviando} />
    </form>
  );
}
