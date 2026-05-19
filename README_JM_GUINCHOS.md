# JM Guinchos

Projeto separado para operação de guinchos com Firebase Auth, Firestore, PWA, preparação para APK, mapa sem Google Maps e integração Tracker por token.

## O que já vem pronto

- Login por e-mail/senha do Firebase Auth.
- Perfil em `users/{uid}` com papéis `admin`, `finance` e `driver`.
- Frota inicial prevista para `FHA4B30` e `DAJ6J95`.
- Chamados com origem/destino por coordenadas, motorista, veículo, status e valor.
- Painel de motorista para acompanhar chamados, finalizar atendimento e lançar despesas.
- Financeiro com entradas, saídas, despesa pendente/aprovada/reprovada e criação automática de entrada ao finalizar chamado com valor.
- Mapa Leaflet/OpenStreetMap com fallback SVG local. Não usa Google Maps.
- Adaptador Tracker configurável por token em `js/config.firebase.js`.
- Cloudinary opcional para comprovantes/fotos.
- PWA via `manifest.json` e `service-worker.js`.
- Preparação para APK via Capacitor.

## Configuração obrigatória

1. Crie um projeto Firebase.
2. Ative Authentication com provedor E-mail/Senha.
3. Ative Firestore.
4. Cole as regras de `firestore.rules` no Firebase Console.
5. Edite `js/config.firebase.js`:
   - `firebaseConfig`
   - `auth.adminEmails`
   - `tracker.platformUrl`
   - `tracker.endpoint`
   - `tracker.token`
   - `tracker.vehicles.FHA4B30.trackerId`
   - `tracker.vehicles.DAJ6J95.trackerId`
6. Crie o primeiro usuário no Firebase Auth usando o e-mail cadastrado em `auth.adminEmails`.
7. Abra o sistema, faça login e clique em `Criar base JM`.

## Integração Tracker

O adaptador aceita payloads comuns de rastreamento com campos como:

- `plate`, `placa`, `name`, `vehicle`, `deviceName`
- `lat`, `latitude`
- `lng`, `lon`, `longitude`
- `speed`, `velocidade`
- `timestamp`, `time`, `dataHora`

Se a API da Tracker tiver outro formato, ajuste apenas `js/tracker.js`, função `normalizePosition`.

Por segurança comercial, o ideal final é mover o token para uma Cloud Function. Nesta versão, foi seguido o requisito de cadastrar o token diretamente no `config.firebase.js`.

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

## Observação sobre os áudios

Os áudios enviados não foram transcritos automaticamente neste pacote porque o ambiente atual não trouxe um transcritor local confiável. A estrutura foi montada a partir do pedido escrito. Quando houver transcrição, as regras específicas do cliente podem entrar como ajustes de fluxo sem refazer a base.
