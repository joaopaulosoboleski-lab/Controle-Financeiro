import Link from "next/link";
import { formatarData, formatarValor, type Lancamento } from "@/lib/lancamentos";

type LancamentoCardProps = {
  lancamento: Lancamento;
};

export default function LancamentoCard({ lancamento }: LancamentoCardProps) {
  const classes = ["card", lancamento.tipo, lancamento.previsto && "previsto", lancamento.vencido && "vencido"]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={classes}>
      <Link href={`/lancamentos/${lancamento.id}`}>
        <strong>
          {/* Selo em texto: a borda tracejada e a cor só reforçam (acessibilidade). */}
          {lancamento.previsto && <span className="selo">{lancamento.vencido ? "VENCIDO" : "PREVISTO"}</span>}
          {lancamento.descricao}
        </strong>
        <span>
          {lancamento.tipo === "entrada" ? "+" : "-"} {formatarValor(lancamento.valor)}
        </span>
        <small>
          {lancamento.vencido ? `Venceu em ${formatarData(lancamento.data)}` : formatarData(lancamento.data)} ·{" "}
          {lancamento.categoria} · {lancamento.conta}
        </small>
      </Link>
      {lancamento.previsto && (
        <Link
          href={`/lancamentos/${lancamento.id}/confirmar`}
          className="botao-confirmar"
          aria-label={`Confirmar ${lancamento.descricao}`}
        >
          Confirmar
        </Link>
      )}
    </li>
  );
}
