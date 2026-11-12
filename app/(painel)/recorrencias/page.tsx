import Link from "next/link";
import { listarRecorrencias, type Recorrencia } from "@/lib/cadastros";
import { formatarData, formatarValor } from "@/lib/lancamentos";

function vigencia(r: Recorrencia): string {
  return r.dataFim
    ? `de ${formatarData(r.dataInicio)} a ${formatarData(r.dataFim)}`
    : `desde ${formatarData(r.dataInicio)}`;
}

export default async function ListaRecorrencias() {
  const recorrencias = await listarRecorrencias();
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const ativas = recorrencias.filter((r) => !r.dataFim || r.dataFim >= hoje);
  const encerradas = recorrencias.filter((r) => r.dataFim && r.dataFim < hoje);

  const lista = (itens: Recorrencia[]) => (
    <ul className="lista">
      {itens.map((r) => (
        <li key={r.id} className={`card ${r.tipo}`}>
          <Link href={`/recorrencias/${r.id}/editar`}>
            <strong>{r.descricao}</strong>
            <span>
              {r.tipo === "entrada" ? "+" : "-"} {formatarValor(r.valor)}
            </span>
            <small>
              Todo dia {r.dia} · {r.categoria} · {r.conta} · {vigencia(r)} · {r.lancamentos} lançamento(s)
            </small>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <main>
      <h1>Recorrências</h1>
      <p>
        <Link href="/recorrencias/confirmar">
          <strong>Confirmar as recorrências do mês</strong>
        </Link>
        {" · "}
        <Link href="/recorrencias/nova">+ Nova recorrência</Link>
      </p>
      <p>Gastos e entradas que se repetem todo mês. A Caderneta não lança sozinha: você confirma a cada mês.</p>

      {recorrencias.length === 0 && <p>Nenhuma recorrência cadastrada.</p>}
      {ativas.length > 0 && lista(ativas)}
      {encerradas.length > 0 && (
        <>
          <h2>Encerradas</h2>
          {lista(encerradas)}
        </>
      )}
    </main>
  );
}
