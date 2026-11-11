"use client";

import { useFormStatus } from "react-dom";

function Botao({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="perigo" disabled={pending}>
      {pending ? "Excluindo..." : texto}
    </button>
  );
}

type BotaoExcluirProps = {
  action: (formData: FormData) => Promise<void>;
  id: number;
  texto?: string;
  confirmacao?: string;
};

export default function BotaoExcluir({
  action,
  id,
  texto = "Excluir lançamento",
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
      <input type="hidden" name="id" value={id} />
      <Botao texto={texto} />
    </form>
  );
}
