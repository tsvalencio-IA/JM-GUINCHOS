# JM Guinchos v16 - gestão, equipe e Trackar/Traccar

Esta versão mantém o sistema em frontend estático/GitHub Pages, mas separa melhor os papéis:

- Dono/admin do `jm.html`: `jm@jm.com`.
- Superadmin técnico: `tsvalencio@gmail.com`.
- O superadmin configura integrações, tracker, Cloudinary e base inicial.
- O admin/dono no `jm.html` cadastra, edita e remove motorista, gerente, atendente e financeiro.
- O admin/dono pode editar e excluir chamados.
- O token do rastreador não fica mais hardcoded no `js/config.firebase.js`.

## Publicação Obrigatória

1. Suba todos os arquivos desta pasta.
2. Publique o conteúdo de `firestore.rules` no Firebase Console.
3. Ative login Email/Senha no Firebase Authentication.
4. Abra `superadmin.html?v=jm-admin-actions-v16`.
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
9. Abra `jm.html?v=jm-admin-actions-v16` e entre com `jm@jm.com`.

## Device Trackar Validado

Com o token fornecido, a API respondeu em `GET /api/devices` e `GET /api/positions` usando `Authorization: Bearer`.
O dispositivo retornado pela API tem `deviceId` 81 e `uniqueId` terminando em `70093`.

O sistema agora avisa quando uma posição foi sincronizada sem vínculo com placa. Nesse caso, coloque `81` ou o `uniqueId` completo no campo da placa correta no superadmin.

## Segurança

O token informado no chat deve ser considerado exposto. Para operação profissional, gere outro token na plataforma de rastreamento antes da publicação.

Como este projeto ainda roda em frontend estático, qualquer token salvo no app pode ser lido por usuários autenticados com acesso ao painel. A evolução profissional correta é mover a chamada ao Trackar para uma Cloud Function ou backend proxy.

Ao excluir um funcionário no `jm.html`, o app remove o cadastro operacional e as permissões em `managerAccess`/`driverAccess`. A conta do Firebase Authentication só pode ser apagada com Admin SDK, Cloud Function ou manualmente no Console Firebase.

## Verificação Local

Execute:

```bash
npm run check:js
```

