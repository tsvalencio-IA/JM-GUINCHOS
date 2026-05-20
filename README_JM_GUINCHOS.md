# JM Guinchos v13 - gestao, equipe e Trackar/Traccar

Esta versao mantem o sistema em frontend estatico/GitHub Pages, mas separa melhor os papeis:

- Dono/admin do `jm.html`: `jm@jm.com`.
- Superadmin tecnico: `tsvalencio@gmail.com`.
- O superadmin configura integracoes, tracker, Cloudinary e base inicial.
- O admin/dono no `jm.html` cadastra motorista, gerente, atendente e financeiro.
- O token do rastreador nao fica mais hardcoded no `js/config.firebase.js`.

## Publicacao obrigatoria

1. Suba todos os arquivos desta pasta.
2. Publique o conteudo de `firestore.rules` no Firebase Console.
3. Ative login Email/Senha no Firebase Authentication.
4. Abra `superadmin.html?v=jm-driver-login-v15`.
5. Entre/crie o primeiro superadmin com `tsvalencio@gmail.com`.
6. Em Tracker, salve:
   - plataforma: `https://gps2.rafacarrastreadores.com.br`
   - endpoint: `https://gps2.rafacarrastreadores.com.br/api`
   - socket: `wss://gps2.rafacarrastreadores.com.br/api/socket`
   - header: `Authorization`
   - prefixo: `Bearer `
   - polling: `30000` ou maior
7. Em Rastreadores da frota, informe o `deviceId` ou `uniqueId` real do Traccar para a placa correta.
8. Clique em `Criar base JM` e depois em `Sincronizar Tracker`.
9. Abra `jm.html?v=jm-driver-login-v15` e entre com `jm@jm.com`.

## Device Trackar validado

Com o token fornecido, a API respondeu em `GET /api/devices` e `GET /api/positions` usando `Authorization: Bearer`.
O dispositivo retornado pela API tem `deviceId` 81 e `uniqueId` terminando em `70093`.

O sistema agora avisa quando uma posicao foi sincronizada sem vinculo com placa. Nesse caso, coloque `81` ou o `uniqueId` completo no campo da placa correta no superadmin.

## Seguranca

O token informado no chat deve ser considerado exposto. Para operacao profissional, gere outro token na plataforma de rastreamento antes da publicacao.

Como este projeto ainda roda em frontend estatico, qualquer token salvo no app pode ser lido por usuarios autenticados com acesso ao painel. A evolucao profissional correta e mover a chamada ao Trackar para uma Cloud Function ou backend proxy.

## Verificacao local

Execute:

```bash
npm run check:js
```

