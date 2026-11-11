import Link from "next/link";
import { formatarData } from "@/lib/lancamentos";
import { exigirAdmin, listarUsuarios } from "@/lib/usuarios";

export default async function ListaUsuarios() {
  const adminId = await exigirAdmin();
  const usuarios = await listarUsuarios();

  return (
    <main>
      <h1>Usuários</h1>
      <p>
        <Link href="/usuarios/novo">+ Novo usuário</Link>
      </p>
      <ul className="lista">
        {usuarios.map((u) => (
          <li key={u.id} className="card usuario">
            <Link href={`/usuarios/${u.id}/editar`}>
              <strong>
                {u.nome}
                {u.id === adminId && " (você)"}
              </strong>
              <span>{u.admin ? "Administrador" : ""}</span>
              <small>
                {u.email} · desde {formatarData(u.criadoEm)} ·{" "}
                {u.registros === 0 ? "sem dados" : `${u.registros} registro(s)`}
              </small>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
