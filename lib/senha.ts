import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Formato guardado em senha_hash: scrypt$<sal em hex>$<hash em hex>
function derivar(senha: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(senha, sal, 64, (erro, chave) => (erro ? reject(erro) : resolve(chave))),
  );
}

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const chave = await derivar(senha, sal);
  return `scrypt$${sal.toString("hex")}$${chave.toString("hex")}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [esquema, salHex, chaveHex] = guardado.split("$");
  if (esquema !== "scrypt" || !salHex || !chaveHex) return false;
  const esperado = Buffer.from(chaveHex, "hex");
  const obtido = await derivar(senha, Buffer.from(salHex, "hex"));
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}
