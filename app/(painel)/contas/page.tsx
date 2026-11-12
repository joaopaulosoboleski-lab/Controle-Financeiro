import Link from "next/link";
import { listarContasCompletas } from "@/lib/cadastros";
import { formatarValor } from "@/lib/lancamentos";
import { TIPOS_CONTA } from "@/lib/validacao-cadastros";

export default async function ListaContas() {
  const contas = await listarContasCompletas();
  const total = contas.reduce((s, c) => s + c.saldoAtual, 0);

  return (
    <main>
      <h1>Contas</h1>
      <p>
        <Link href="/contas/nova">+ Nova conta</Link>
      </p>

      {contas.length === 0 ? (
        <p>Nenhuma conta cadastrada. Cadastre a primeira para começar a lançar.</p>
      ) : (
        <>
          <ul className="lista">
            {contas.map((c) => (
              <li key={c.id} className={`card ${c.saldoAtual < 0 ? "saida" : "entrada"}`}>
                <Link href={`/contas/${c.id}/editar`}>
                  <strong>{c.nome}</strong>
                  <span>{formatarValor(c.saldoAtual)}</span>
                  <small>
                    {TIPOS_CONTA[c.tipo]} · saldo inicial {formatarValor(c.saldoInicial)} · {c.lancamentos} lançamento(s)
                  </small>
                </Link>
              </li>
            ))}
          </ul>
          <div className="resumo">
            <div className="saldo">
              <span>Total nas contas</span>
              <span>{formatarValor(total)}</span>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
