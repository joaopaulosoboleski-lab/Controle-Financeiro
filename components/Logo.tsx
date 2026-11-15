// Logo da Caderneta: a caderneta com "R$" (o mesmo desenho do ícone do app) + o nome.
// Com `dono`, vira "Caderneta de <dono>" (a pessoa logada); sem ele (login, início), só "Caderneta".
// O símbolo usa as cores fixas da marca, para ficar igual ao ícone instalado; o nome segue o tema.

type LogoProps = {
  tamanho?: number; // altura do símbolo, em px
  comNome?: boolean;
  className?: string;
  dono?: string;
};

export function SimboloCaderneta({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect width="100" height="100" rx="22" fill="#2f6f5e" />
      <rect x="24" y="16" width="52" height="68" rx="6" fill="#ffffff" />
      <rect x="24" y="16" width="10" height="68" rx="4" fill="#d7e8e2" />
      <g fill="#2f6f5e">
        <circle cx="29" cy="28" r="2.2" />
        <circle cx="29" cy="40" r="2.2" />
        <circle cx="29" cy="52" r="2.2" />
        <circle cx="29" cy="64" r="2.2" />
        <circle cx="29" cy="76" r="2.2" />
      </g>
      <text
        x="56"
        y="61"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="30"
        fill="#2f6f5e"
      >
        R$
      </text>
    </svg>
  );
}

export default function Logo({ tamanho = 32, comNome = true, className, dono }: LogoProps) {
  return (
    <span className={["logo", className].filter(Boolean).join(" ")}>
      <SimboloCaderneta tamanho={tamanho} />
      {comNome && (
        <span className="logo-nome">
          Caderneta{dono && <span> de {dono}</span>}
        </span>
      )}
    </span>
  );
}
