import Link from "next/link";
import { listarCategoriasCompletas, type Categoria } from "@/lib/cadastros";

function Grupo({ titulo, categorias }: { titulo: string; categorias: Categoria[] }) {
  if (categorias.length === 0) return null;
  return (
    <>
      <h2>{titulo}</h2>
      <ul className="lista">
        {categorias.map((c) => (
          <li key={c.id} className={`card categoria${c.ativa ? "" : " arquivada"}`} style={{ "--cor-categoria": c.cor } as React.CSSProperties}>
            <Link href={`/categorias/${c.id}/editar`}>
              <strong>
                <span className="cor" style={{ background: c.cor }} aria-hidden="true" /> {c.nome}
              </strong>
              <span>{c.ativa ? "" : "Arquivada"}</span>
              <small>
                {c.lancamentos === 0 && c.recorrencias === 0
                  ? "Sem uso"
                  : `${c.lancamentos} lançamento(s) · ${c.recorrencias} recorrência(s)`}
              </small>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function ListaCategorias() {
  const categorias = await listarCategoriasCompletas();
  const ativas = categorias.filter((c) => c.ativa);

  return (
    <main>
      <h1>Categorias</h1>
      <p>
        <Link href="/categorias/nova">+ Nova categoria</Link>
      </p>
      {categorias.length === 0 && <p>Nenhuma categoria cadastrada.</p>}
      <Grupo titulo="Saídas" categorias={ativas.filter((c) => c.tipo === "saida")} />
      <Grupo titulo="Entradas" categorias={ativas.filter((c) => c.tipo === "entrada")} />
      <Grupo titulo="Arquivadas" categorias={categorias.filter((c) => !c.ativa)} />
    </main>
  );
}
