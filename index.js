const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const app = express();
const port = 3000;

app.use(express.json());

// Lista de números autorizados
const authorizedNumbers = [
  '5511978252537@c.us',
  '447756118628@c.us'
];

// URL do Webhook do n8n
const n8nWebhookUrl = 'https://primary-production-1ff4.up.railway.app/webhook-test/3881df02-5d6d-4bae-a8ce-8b51d5213f51';

wppconnect.create({
  session: 'whatsapp-session',
  autoClose: 0, // Desativa o fechamento automático da sessão
  puppeteerOptions: {
    headless: true,
  },
  catchQR: (qrCode, asciiQR) => {
    // Exibe o QR Code no terminal
    qrcode.generate(qrCode, { small: true });
  },
  statusFind: (statusSession, session) => {
    console.log('Status da Sessão:', statusSession); // Recebe o status da sessão: isLogged, notLogged, browserClose, qrReadSuccess, qrReadFail, autocloseCalled
    console.log('Nome da Sessão:', session);
  },
  catchException: true,
  disableSpins: true,
}).then(client => {
  console.log('Cliente conectado com sucesso!');

  // Monitora o estado da conexão e tenta reconectar se necessário
  client.onStateChange(state => {
    console.log('Estado da Conexão:', state);
    const conflicts = [
      'CONFLICT',
      'UNPAIRED',
      'UNLAUNCHED',
    ];
    if (conflicts.includes(state)) {
      client.useHere();
    }
  });

  // Rota para enviar mensagem
  app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;
    try {
      await client.sendText(phone, message);
      res.status(200).send('Mensagem enviada com sucesso!');
    } catch (error) {
      res.status(500).send('Erro ao enviar mensagem: ' + error.message);
    }
  });

  // Rota para receber mensagem
  client.onMessage(async message => {
    if (authorizedNumbers.includes(message.from)) {
      console.log('Mensagem recebida de um número autorizado: ', {
        id: message.id,
        from: message.from,
        body: message.body,
        timestamp: message.timestamp,
        type: message.type,
        chatId: message.chatId,
        fromMe: message.fromMe
      });
      try {
        // Enviar a mensagem para o webhook do n8n
        await axios.post(n8nWebhookUrl, {
          id: message.id,
          from: message.from,
          body: message.body,
          timestamp: message.timestamp,
          type: message.type,
          chatId: message.chatId,
          fromMe: message.fromMe
        });
      } catch (error) {
        console.error('Erro ao enviar mensagem para o webhook do n8n: ', error);
      }
    } else {
      console.log('Mensagem recebida de um número não autorizado:', message.from);
    }
  });

}).catch(error => {
  console.error('Erro ao inicializar o cliente: ', error);
});

// Rota para obter o QR Code
app.get('/qr', (req, res) => {
  wppconnect.create({
    session: 'whatsapp-session',
    autoClose: 0,
    qrTimeout: 0
  }).then(client => {
    client.on('qrCode', qrCode => {
      qrcode.generate(qrCode, { small: true }); // Exibe o QR Code no terminal
      res.send('QR Code gerado no terminal.');
    });
  }).catch(error => {
    res.status(500).send('Erro ao obter QR Code: ' + error.message);
  });
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
