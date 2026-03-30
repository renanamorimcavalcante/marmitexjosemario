const http = require('http');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = '1Z4ATIkmt_k-40W29-RRqYjiJZ2I0hAwOP9DQYtsk9cw';
const SHEET_PEDIDOS  = 'Página1';
const SHEET_STATUS   = 'Status';

// Função para gerenciar a autenticação com Google Sheets
function getAuth() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    // IMPORTANTE: Corrige as quebras de linha da private_key que o Vercel remove
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
  } else {
    // Carregamento local para testes (usando o arquivo físico)
    const credPath = path.join(__dirname, 'credentials.json');
    if (fs.existsSync(credPath)) {
      credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    } else {
      throw new Error("Arquivo credentials.json não encontrado localmente.");
    }
  }
  
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

async function lerStatus() {
  const sheets = await getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_STATUS}!A:B`,
    });
    const rows = res.data.values || [];
    const map = {};
    rows.forEach(([id, status]) => { if (id) map[id] = status; });
    return map;
  } catch (e) { 
    console.error("Erro ao ler status:", e.message);
    return {}; 
  }
}

async function listarPedidos() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_PEDIDOS}!A2:H`,
  });
  const rows = res.data.values || [];
  const statusMap = await lerStatus();
  return rows.filter(r => r[0]).map(cols => {
    const id = cols[0];
    return {
      id: Number(id),
      data: cols[1] || '',
      cliente: { nome: cols[2] || '', tel: cols[3] || '', endereco: cols[4] || '' },
      pagamento: cols[5] === 'Pix' ? 'pix' : 'entrega',
      itens: (cols[6] || '').split(' | ').map(s => {
        const m = s.match(/^(.+) x(\d+)$/);
        return m ? { name: m[1], qty: Number(m[2]) } : { name: s, qty: 1 };
      }),
      total: parseFloat((cols[7] || '0').replace('R$ ', '').replace(',', '.')),
      status: statusMap[id] || 'pendente'
    };
  });
}

async function salvarPedido(p) {
  const sheets = await getSheets();
  const itens = p.itens.map(i => `${i.name} x${i.qty}`).join(' | ');
  const total = `R$ ${p.total.toFixed(2).replace('.', ',')}`;
  const pagamento = p.pagamento === 'pix' ? 'Pix' : 'Na entrega';
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_PEDIDOS}!A:H`,
    valueInputOption: 'RAW',
    requestBody: { values: [[p.id, p.data, p.cliente.nome, p.cliente.tel, p.cliente.endereco, pagamento, itens, total]] }
  });
}

async function atualizarStatus(id, status) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_STATUS}!A:B`,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => String(r[0]) === String(id));
  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_STATUS}!A${rowIndex + 1}:B${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[id, status]] }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_STATUS}!A:B`,
      valueInputOption: 'RAW',
      requestBody: { values: [[id, status]] }
    });
  }
}

const server = http.createServer(async (req, res) => {
  // Configuração de CORS para permitir requisições do seu próprio domínio
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') { 
    res.writeHead(204); 
    res.end(); 
    return; 
  }

  // Rotas de API ajustadas para aceitar /api/rota ou apenas /rota
  if (req.method === 'GET' && req.url.endsWith('/pedidos')) {
    try {
      const pedidos = await listarPedidos();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pedidos));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, erro: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url.endsWith('/status')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id, status } = JSON.parse(body);
        await atualizarStatus(id, status);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, erro: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url.endsWith('/pedido')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const p = JSON.parse(body);
        await salvarPedido(p);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, erro: e.message }));
      }
    });
    return;
  }

  // Se não cair em nenhuma rota de API, retorna 404 (A Vercel serve os estáticos automaticamente)
  res.writeHead(404);
  res.end('Rota de API não encontrada.');
});

// Suporte para rodar localmente (npm start ou node index.js)
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log(`✅ Servidor local rodando em http://localhost:${PORT}`);
  });
}

// Essencial para o Vercel identificar o servidor Node.js
module.exports = server;