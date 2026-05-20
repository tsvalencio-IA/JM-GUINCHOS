# JM Guinchos v12 — Tracker RAFA + mapa gratuito + rotas inteligentes

Esta versão mantém o sistema em frontend estático/GitHub Pages, sem Google Maps API paga.

## O que mudou

- `jm.html` aceita origem/destino por:
  - coordenada direta: `-20.851076,-49.398946`
  - link compartilhado com coordenadas visíveis do Google Maps/Waze
  - localização atual do aparelho para origem
- O mapa continua gratuito com Leaflet/OpenStreetMap.
- O algoritmo de rota inteligente escolhe o veículo mais próximo usando:
  - posição real do Tracker RAFA salva nos veículos
  - status do veículo
  - distância estimada por coordenadas
  - tempo estimado por velocidade média
- O gestor pode abrir a rota no Maps por link externo gratuito.
- O `superadmin.html` cadastra gestor, gerente, auxiliar, financeiro e motorista.
- O `jm.html` também cadastra equipe com perfil correto.
- O Tracker RAFA agora tem configuração padrão:
  - platformUrl
  - endpoint `/api`
  - socketUrl
  - token
  - header Authorization Bearer
  - polling de 30 segundos

## Fluxo recomendado

1. Suba todos os arquivos no GitHub.
2. Publique o conteúdo de `firestore.rules` no Firebase Console.
3. Abra `superadmin.html?v=jm-free-tracker-v12`.
4. Clique em **Criar base JM**.
5. Confira o Tracker e clique em **Salvar Tracker**.
6. Clique em **Sincronizar Tracker**.
7. Abra `jm.html?v=jm-free-tracker-v12`.
8. Em Chamados, cole a origem no formato `-20.851076,-49.398946` ou link do mapa.
9. Clique em **Ler origem do link/coordenada**.
10. Clique em **Traçar rota inteligente**.
11. Registre o chamado.

## Observação importante sobre segurança

Este projeto é 100% frontend. Qualquer token colocado em `js/config.firebase.js` ou salvo em configuração lida pelo navegador pode ficar visível para quem tiver acesso ao app publicado. Para operação profissional, o ideal é um backend/proxy seguro. Como a decisão atual é não pagar API/servidor, restrinja o token no fornecedor do rastreador e troque o token se houver exposição.

## Arquivos principais alterados

- `jm.html`
- `superadmin.html`
- `motorista.html`
- `js/app.js`
- `js/superadmin.js`
- `js/motorista.js`
- `js/tracker.js`
- `js/google-maps.js` — agora funciona como roteirizador gratuito, mantendo compatibilidade do nome
- `js/mapa.js`
- `js/config.firebase.js`
- `firestore.rules`
- `service-worker.js`
