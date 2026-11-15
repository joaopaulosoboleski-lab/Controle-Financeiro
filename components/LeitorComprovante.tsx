"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import FormularioLancamento from "@/components/FormularioLancamento";
import type { EstadoFormulario } from "@/lib/formulario";
import type { OpcaoCategoria, OpcaoConta } from "@/lib/lancamentos";
import { interpretarComprovante, NOMES_COMPROVANTE, sugerirCategoria, type LeituraEntrada } from "@/lib/ocr-entrada";

type Props = {
  action: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  contas: OpcaoConta[];
  categorias: OpcaoCategoria[];
  hoje: string; // YYYY-MM-DD no fuso do Brasil
};

type Fase =
  | { nome: "escolher" }
  | { nome: "lendo"; etapa: string; progresso: number }
  | { nome: "pronto"; leitura: LeituraEntrada; texto: string }
  | { nome: "erro"; mensagem: string };

const LADO_MAXIMO = 1800; // px: foto de celular (4000px) reduzida fica bem mais rápida e lê igual

// Reduz, corrige a orientação (EXIF) e passa para tons de cinza com mais contraste:
// o Tesseract lê melhor e muito mais rápido no celular.
async function prepararImagem(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const imagem = ctx.getImageData(0, 0, largura, altura);
  const p = imagem.data;
  for (let i = 0; i < p.length; i += 4) {
    const cinza = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    const contraste = Math.max(0, Math.min(255, (cinza - 128) * 1.4 + 128));
    p[i] = p[i + 1] = p[i + 2] = contraste;
  }
  ctx.putImageData(imagem, 0, 0);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("falha ao gerar imagem"))), "image/png"),
  );
}

const ETAPAS: Record<string, string> = {
  "loading tesseract core": "Preparando o leitor...",
  "initializing tesseract": "Preparando o leitor...",
  "loading language traineddata": "Baixando o português (só no 1º uso)...",
  "initializing api": "Preparando o leitor...",
  "recognizing text": "Lendo o comprovante...",
};

export default function LeitorComprovante({ action, contas, categorias, hoje }: Props) {
  const [fase, setFase] = useState<Fase>({ nome: "escolher" });
  const [versao, setVersao] = useState(0);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  async function ler(arquivo: File | undefined) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      setFase({ nome: "erro", mensagem: "Escolha uma foto ou print (imagem)." });
      return;
    }
    setFase({ nome: "lendo", etapa: "Preparando a foto...", progresso: 0 });
    let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | undefined;
    try {
      const imagem = await prepararImagem(arquivo);
      // O motor pesado (núcleo WebAssembly + português, ~4 MB, da CDN jsDelivr) só é baixado aqui,
      // e fica em cache no navegador. A camada de API do tesseract.js (~11 KB) vai junto com a página.
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("por", 1, {
        logger: (m: { status: string; progress: number }) =>
          setFase({ nome: "lendo", etapa: ETAPAS[m.status] ?? "Lendo o comprovante...", progresso: m.progress }),
      });
      const { data } = await worker.recognize(imagem);
      setFase({ nome: "pronto", leitura: interpretarComprovante(data.text), texto: data.text });
      setVersao((v) => v + 1); // remonta o formulário com os valores novos
    } catch {
      setFase({
        nome: "erro",
        mensagem: "Não foi possível ler a foto. Verifique a internet (no 1º uso o leitor é baixado) e tente de novo.",
      });
    } finally {
      await worker?.terminate();
      // Permite escolher a mesma foto de novo.
      if (camera.current) camera.current.value = "";
      if (galeria.current) galeria.current.value = "";
    }
  }

  const lendo = fase.nome === "lendo";

  return (
    <>
      <section className="leitor" aria-busy={lendo}>
        <p>Fotografe o comprovante de PIX/TED, o holerite ou o recibo. A foto é lida no seu celular e não é guardada.</p>
        <div className="leitor-botoes">
          <button type="button" onClick={() => camera.current?.click()} disabled={lendo}>
            📷 Tirar foto
          </button>
          <button type="button" className="secundario" onClick={() => galeria.current?.click()} disabled={lendo}>
            🖼️ Escolher da galeria
          </button>
        </div>
        {/* capture="environment" abre direto a câmera traseira no celular. */}
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => ler(e.target.files?.[0])} />
        <input ref={galeria} type="file" accept="image/*" hidden onChange={(e) => ler(e.target.files?.[0])} />

        {fase.nome === "lendo" && (
          <div role="status">
            <p>{fase.etapa}</p>
            <progress value={fase.progresso} max={1} aria-label="Progresso da leitura" />
          </div>
        )}

        {fase.nome === "erro" && (
          <p className="erro" role="alert">
            {fase.mensagem}
          </p>
        )}

        {fase.nome === "pronto" && (
          <div role="status">
            <p className="sucesso">
              Lido: <strong>{NOMES_COMPROVANTE[fase.leitura.tipo]}</strong>. Confira os campos antes de salvar.
            </p>
            {fase.leitura.avisos.length > 0 && (
              <ul className="avisos">
                {fase.leitura.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            <details>
              <summary>Ver o texto lido</summary>
              <pre>{fase.texto.trim() || "(nenhum texto encontrado)"}</pre>
            </details>
          </div>
        )}
      </section>

      {fase.nome === "pronto" ? (
        <FormularioLancamento
          key={versao}
          action={action}
          contas={contas}
          categorias={categorias}
          iniciais={{
            descricao: fase.leitura.descricao,
            valor: fase.leitura.valor ?? "",
            tipo: "entrada",
            data: fase.leitura.data ?? hoje,
            // Com uma conta só, já vem escolhida.
            contaId: contas.length === 1 ? String(contas[0].id) : "",
            categoriaId: String(sugerirCategoria(fase.leitura.tipo, categorias) ?? ""),
          }}
          textoBotao="Salvar entrada"
          permitirPrevisto
        />
      ) : (
        <p>
          Prefere digitar? <Link href="/lancamentos/novo">Lançar à mão</Link>.
        </p>
      )}
    </>
  );
}
