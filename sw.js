/* =====================================================================
   CODEX — service worker

   Duas estratégias, de propósito:

   1. Arquivos do app (index.html, curso/*.json, ícones)  -> REDE PRIMEIRO
      Assim, tudo que você subir no GitHub aparece na próxima abertura.
      O cache só entra em cena quando não há internet.

   2. Bibliotecas externas (Pyodide, CodeMirror, fontes)  -> CACHE PRIMEIRO
      São endereços com número de versão fixo, então nunca mudam.
      É isto que faz o Python abrir rápido a partir da segunda vez,
      e é o que permite estudar sem conexão.

   Se algum dia o app parecer preso numa versão antiga, troque o número
   do CACHE abaixo (de v1 para v2) e suba o arquivo: isso apaga tudo.
   ===================================================================== */

var CACHE = "codex-v3";

var EXTERNOS = [
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

var ESSENCIAIS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./curso/m01.json",
  "./curso/m02.json",
  "./icone-192.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function(evento){
  evento.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(ESSENCIAIS).catch(function(e){
        console.warn("CODEX sw: nem tudo foi pré-carregado", e);
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(evento){
  evento.waitUntil(
    caches.keys().then(function(nomes){
      return Promise.all(nomes.map(function(n){
        if (n !== CACHE) return caches.delete(n);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(evento){
  var pedido = evento.request;
  if (pedido.method !== "GET") return;

  var url = new URL(pedido.url);

  /* Nunca guardar chamadas ao Supabase */
  if (url.hostname.indexOf("supabase.co") >= 0) return;

  var externo = EXTERNOS.some(function(d){ return url.hostname === d || url.hostname.endsWith("." + d); });

  if (externo){
    /* cache primeiro */
    evento.respondWith(
      caches.match(pedido).then(function(guardado){
        if (guardado) return guardado;
        return fetch(pedido).then(function(resposta){
          if (resposta && (resposta.ok || resposta.type === "opaque")){
            var copia = resposta.clone();
            caches.open(CACHE).then(function(c){ c.put(pedido, copia); });
          }
          return resposta;
        });
      })
    );
    return;
  }

  /* rede primeiro, para os arquivos do próprio app */
  evento.respondWith(
    fetch(pedido).then(function(resposta){
      if (resposta && resposta.ok){
        var copia = resposta.clone();
        caches.open(CACHE).then(function(c){ c.put(pedido, copia); });
      }
      return resposta;
    }).catch(function(){
      return caches.match(pedido).then(function(guardado){
        return guardado || caches.match("./index.html");
      });
    })
  );
});
