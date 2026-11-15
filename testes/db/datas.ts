// Datas relativas a "hoje" no fuso do Brasil (o app calcula "vencido" assim).
export function hoje(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Dia 15 do mês, N meses depois do mês de `data`.
export function diaQuinzeEmMeses(data: string, meses: number): string {
  const d = new Date(`${data.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return `${d.toISOString().slice(0, 7)}-15`;
}

export const mesDe = (data: string) => data.slice(0, 7);
