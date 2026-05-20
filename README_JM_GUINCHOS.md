# JM Guinchos

Projeto separado para operação de guinchos com Firebase Auth, Firestore, PWA, preparação para APK, integração Tracker por token e evolução de endereço/rotas com Google Maps.

## O que já vem pronto

- Login por e-mail/senha do Firebase Auth.
- Perfil em `users/{uid}` com papéis `admin`, `finance` e `driver`.
- Correção do fluxo gestor: gestor não vira motorista, com proteção `managerAccess/{email}`.
- Frota inicial prevista para `FHA4B30` e `DAJ6J95`.
- Chamados com origem/destino, coordenadas, motorista, veículo, status e valor.
- Endereço do chamado com Google Places Autocomplete e Geocoding quando a chave Google estiver configurada.
- Rota inteligente: usa posição real do tracker + endereço validado + Google Directions quando disponível; se a chave não estiver configurada, usa fallback por distância em linha reta para não quebrar o sistema.
- Link direto para abrir rota no Google Maps no painel gestor e no painel do motorista.
- Painel de motorista para acompanhar chamados, abrir rota, finalizar atendimento e lançar despesas.
- Financeiro com entradas, saídas, despesa pendente/aprovada/reprovada e criação automática de entrada ao finalizar chamado com valor.
- Mapa Leaflet/OpenStreetMap com fallback SVG local para visualização operacional.
- Adaptador Tracker configurável por token em `js/config.firebase.js` ou pelo `superadmin.html`.
- Cloudinary opcional para comprovantes/fotos.
- PWA via `manifest.json` e `service-worker.js`.
- Preparação para APK via Capacitor.

## Configuração obrigatória

1. Crie um projeto Firebase.
2. Ative Authentication com provedor E-mail/Senha.
3. Ative Firestore.
4. Cole as regras de `firestore.rules` no Firebase Console.
5. Edite `js/config.firebase.js` ou use o `superadmin.html`:
   - `firebaseConfig`
   - `auth.adminEmails`
   - `auth.superadminEmails`
   - `tracker.platformUrl`
   - `tracker.endpoint`
   - `tracker.token`
   - `tracker.vehicles.FHA4B30.trackerId`
   - `tracker.vehicles.DAJ6J95.trackerId`
   - `googleMaps.apiKey` para autocomplete, geocodificação e rotas reais.
6. Crie o primeiro usuário no Firebase Auth usando o e-mail cadastrado em `auth.superadminEmails`.
7. Abra `superadmin.html`, faça login como superadmin e clique em `Criar base JM`.

## Google Maps / rotas inteligentes

Para ativar o modo completo, configure uma chave da Google Maps Platform no `superadmin.html`, seção **Google Maps / Rotas inteligentes**.

APIs recomendadas no Google Cloud:

- Maps JavaScript API
- Places API
- Geocoding API
- Directions API, caso sua conta exija habilitação separada para rotas

Também é recomendado restringir a chave por domínio, por exemplo o domínio do GitHub Pages/Vercel usado pelo sistema.

Fluxo novo do chamado:

1. Digite a origem do veículo e selecione a sugestão do Google.
2. Se necessário, clique em `Validar origem no Google`.
3. Digite/valide o destino.
4. Clique em `Traçar rota inteligente`.
5. O sistema recomenda o melhor veículo com base em tracker, distância, tempo e status.
6. Registre o chamado.
7. O motorista recebe o botão `Abrir rota Google`.

## Integração Tracker

O adaptador aceita payloads comuns de rastreamento com campos como:

- `plate`, `placa`, `name`, `vehicle`, `deviceName`
- `lat`, `latitude`
- `lng`, `lon`, `longitude`
- `speed`, `velocidade`
- `timestamp`, `time`, `dataHora`

Se a API da Tracker tiver outro formato, ajuste apenas `js/tracker.js`, função `normalizePosition`.

Por segurança comercial, o ideal final é mover token de tracker e chaves sensíveis para Cloud Functions. Nesta versão, foi mantido o modelo client-side conforme o projeto atual.

## Rodar local

```bash
npm install
npm run serve
```

Acesse `http://127.0.0.1:4177`.

## Gerar APK

```bash
npm install
npm run cap:add:android
npm run cap:sync
npx cap open android
```

No Android Studio, gere o APK ou AAB.

## Teste DevTools

Depois de logar, abra F12 > Console e cole `DEVTOOLS_TEST_JM_GUINCHOS.js`.
