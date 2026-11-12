"use client";

import { useFormStatus } from "react-dom";

// Botão de envio que se desabilita enquanto a action roda (evita salvar duas vezes).
export default function BotaoEnviar({ texto, enviando = "Salvando..." }: { texto: string; enviando?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? enviando : texto}
    </button>
  );
}
