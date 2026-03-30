const SENHA = 'marmitas123';
let filtroAtivo = 'todos';

function fazerLogin() {
  const senha = document.getElementById('senhaInput').value;
  if (senha === SENHA) {
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('painel').style.display = 'block';
    renderLojaPedidos();
    setInterval(renderLojaPedidos, 30000);
  } else {
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('senhaInput').value = '';
  }
}

function sair() {
  document.getElementById('loginWrap').style.display = 'flex';
  document.getElementById('painel').style.display = 'none';
  document.getElementById('senhaInput').value = '';
  document.getElementById('loginError').style.display = 'none';
}

function atualizarStatus(id, status) {
  fetch('https://marmitexjosemario.vercel.app/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status })
  }).then(() => renderLojaPedidos());
}

function filtrar(tipo, btn) {
  filtroAtivo = tipo;
  document.querySelectorAll('.filter-tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLojaPedidos();
}

function renderLojaPedidos() {
  fetch('https://marmitexjosemario.vercel.app/pedidos')
    .then(r => r.json())
    .then(pedidos => renderLista(pedidos))
    .catch(() => {
      document.getElementById('lojaPedidosList').innerHTML =
        '<div style="text-align:center;color:#c0392b;padding:40px;">Erro ao conectar ao servidor.</div>';
    });
}

function renderLista(pedidos) {
  const container = document.getElementById('lojaPedidosList');

  let lista = [...pedidos].reverse();
  if (filtroAtivo !== 'todos') {
    lista = lista.filter(p => p.status === filtroAtivo);
  }

  if (lista.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;color:#999;padding:60px 20px;">
        <div style="font-size:2.5rem;margin-bottom:12px;">📋</div>
        <p>Nenhum pedido encontrado.</p>
      </div>`;
    return;
  }

  const pagLabel = (p) => p.pagamento === 'pix' ? '💳 Pix (CPF: 001.173.795-65)' : '💵 Pagar na entrega';

  const statusBadge = (s) => {
    if (s === 'pendente') return '<span class="status-badge status-pendente">⏳ Aguardando</span>';
    if (s === 'aceito') return '<span class="status-badge status-aceito">✅ Aceito</span>';
    return '<span class="status-badge status-recusado">❌ Recusado</span>';
  };

  container.innerHTML = lista.map(p => `
    <div class="loja-pedido-card">
      <h4>Pedido #${p.id} — ${p.data}</h4>
      <div class="info">👤 <strong>${p.cliente.nome}</strong></div>
      <div class="info">📱 ${p.cliente.tel}</div>
      <div class="info">📍 ${p.cliente.endereco}</div>
      <div class="info">${pagLabel(p)}</div>
      <ul>
        ${p.itens.map(i => `<li>${i.name} x${i.qty}</li>`).join('')}
      </ul>
      <div class="total">Total: R$ ${p.total.toFixed(2).replace('.', ',')}</div>
      ${statusBadge(p.status)}
      ${p.status === 'pendente' ? `
        <div class="action-btns" style="margin-top:12px;">
          <button class="btn-aceitar" onclick="atualizarStatus(${p.id}, 'aceito')">✅ Aceitar Pedido</button>
          <button class="btn-recusar" onclick="atualizarStatus(${p.id}, 'recusado')">❌ Recusar Pedido</button>
        </div>` : ''}
    </div>
  `).join('');
}
