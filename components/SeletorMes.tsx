import Link from "next/link";
import { formatarMes } from "@/lib/lancamentos";

type SeletorMesProps = {
  rota: string;
  meses: string[];
  atual: string;
};

export default function SeletorMes({ rota, meses, atual }: SeletorMesProps) {
  return (
    <div className="meses">
      {meses.map((mes) =>
        mes === atual ? (
          <strong key={mes}>{formatarMes(mes)}</strong>
        ) : (
          <Link key={mes} href={`${rota}?mes=${mes}`}>
            {formatarMes(mes)}
          </Link>
        ),
      )}
    </div>
  );
}
