// Service worker da Caderneta da Cláudia.
// Faz uma coisa só: sem internet, mostra a página "Você está sem internet" em vez do erro do navegador.
// NÃO guarda páginas nem dados financeiros: o celular pode ser compartilhado, e o que aparece na tela
// tem de vir sempre do servidor, já filtrado pela pessoa logada.

const CACHE = "caderneta-offline-v3";
const OFFLINE = "/offline.html";
// A página offline é autossuficiente (estilos e ícone embutidos): basta guardar ela.
const ARQUIVOS = [OFFLINE];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Um por vez, com put (que sobrescreve). O addAll falha com "Entry already exists" quando duas
      // instalações rodam juntas, e uma falha nele descarta o service worker inteiro.
      for (const url of ARQUIVOS) {
        try {
          const resposta = await fetch(url, { cache: "reload" });
          if (resposta.ok) await cache.put(url, resposta);
        } catch {
          // Sem a página offline o app funciona igual; tenta de novo na próxima instalação.
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  // Apaga caches de versões antigas deste arquivo.
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((nome) => nome !== CACHE).map((nome) => caches.delete(nome))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  // Só abrir uma página (GET). O resto (dados, Server Actions, arquivos) segue direto para a rede.
  if (pedido.mode !== "navigate" || pedido.method !== "GET") return;
  evento.respondWith(
    fetch(pedido).catch(async () => {
      // ignoreVary: a página foi guardada com "Vary: Accept-Encoding"; sem isso a busca pode não achá-la.
      const offline = await caches.match(OFFLINE, { ignoreVary: true });
      return offline ?? new Response("Sem internet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }),
  );
});
