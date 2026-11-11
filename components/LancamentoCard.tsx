import Link from "next/link";
import { formatarData, formatarValor, type Lancamento } from "@/lib/lancamentos";

type LancamentoCardProps = {
  lancamento: Lancamento;
};

export default function LancamentoCard({ lancamento }: LancamentoCardProps) {
  return (
    <li className={`card ${lancamento.tipo}`}>
      <Link href={`/lancamentos/${lancamento.id}`}>
        <strong>{lancamento.descricao}</strong>
        <span>
          {lancamento.tipo === "entrada" ? "+" : "-"} {formatarValor(lancamento.valor)}
        </span>
        <small>
          {formatarData(lancamento.data)} · {lancamento.categoria} · {lancamento.conta}
        </small>
      </Link>
    </li>
  );
}
