import Link from "next/link";
import LancamentoCard from "@/components/LancamentoCard";
import SeletorMes from "@/components/SeletorMes";
import { listarLancamentos, listarMeses, resolverMes } from "@/lib/lancamentos";

export default async function ListaLancamentos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesPedido } = await searchParams;
  const mes = await resolverMes(mesPedido);

  if (!mes) {
    return (
      <main>
        <h1>Lançamentos</h1>
        <p>Nenhum lançamento cadastrado.</p>
        <p>
          <Link href="/lancamentos/novo">+ Novo lançamento</Link>
        </p>
      </main>
    );
  }

  const [meses, lancamentos] = await Promise.all([listarMeses(), listarLancamentos(mes)]);

  return (
    <main>
      <h1>Lançamentos</h1>
      <p>
        <Link href="/lancamentos/novo">+ Novo lançamento</Link>
      </p>
      <SeletorMes rota="/lancamentos" meses={meses} atual={mes} />
      <ul className="lista">
        {lancamentos.map((lancamento) => (
          <LancamentoCard key={lancamento.id} lancamento={lancamento} />
        ))}
      </ul>
    </main>
  );
}
