const API = 'https://marmitexjosemario.vercel.app';

// Quantidades selecionadas nos cards
const qtys = { frango: 1, carne: 1, camarao: 1 };

// Carrinho em memória
let cart = [];

function changeQty(id, delta) {
  qtys[id] = Math.max(1, qtys[id] + delta);
  document.getElementById('qty-' + id).textContent = qtys[id];
}

function addToCart(id, name, price) {
  const qty = qtys[id];
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id, name, price, qty });
  }
  qtys[id] = 1;
  document.getElementById('qty-' + id).textContent = 1;
  updateCartCount();
  showToast(`${name} adicionado ao carrinho!`);
}

function limparCarrinho() {
  if (cart.length === 0) return;
  if (!confirm('Deseja limpar o carrinho?')) return;
  cart = [];
  updateCartCount();
  showToast('Carrinho limpo.');
}

function updateCartCount() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = total;
}

function openCart() {
  renderCartItems();
  document.getElementById('cartModal').classList.add('open');
}

function closeCart() {
  document.getElementById('cartModal').classList.remove('open');
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');

  if (cart.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:20px 0;">Carrinho vazio</p>';
    totalEl.textContent = '';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <span class="cart-item-name">${item.name}</span>
        <span style="color:#999; font-size:0.85rem;"> x${item.qty}</span>
      </div>
      <span class="cart-item-price">R$ ${(item.price * item.qty).toFixed(2).replace('.', ',')}</span>
    </div>
  `).join('');

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  totalEl.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
}

function togglePix() {
  const val = document.getElementById('pagamento').value;
  document.getElementById('pixInfo').classList.toggle('show', val === 'pix');
}

function copiarPix() {
  const chave = document.getElementById('pixKey').textContent;
  navigator.clipboard.writeText(chave).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copiado ✓';
    btn.style.background = 'var(--success)';
    setTimeout(() => {
      btn.textContent = 'Copiar';
      btn.style.background = 'var(--primary)';
    }, 2000);
  });
}

async function finalizarPedido() {
  if (cart.length === 0) {
    alert('Adicione itens ao carrinho antes de finalizar.');
    return;
  }

  const nome = document.getElementById('clienteNome').value.trim();
  const tel = document.getElementById('clienteTel').value.trim();
  const endereco = document.getElementById('clienteEndereco').value.trim();
  const pagamento = document.getElementById('pagamento').value;

  if (!nome || !tel || !endereco || !pagamento) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const pedido = {
    id: Date.now(),
    data: new Date().toLocaleString('pt-BR'),
    cliente: { nome, tel, endereco },
    pagamento,
    itens: [...cart],
    total,
    status: 'pendente'
  };

  // Envia ao servidor (Google Sheets via Vercel)
  try {
    const res = await fetch(`${API}/pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido)
    });
    if (!res.ok) throw new Error('Erro no servidor');
  } catch (e) {
    alert('Erro ao enviar pedido. Verifique sua conexão e tente novamente.');
    return;
  }

  // Salva no localStorage para exibir em "Meus Pedidos"
  const pedidos = getPedidos();
  pedidos.push(pedido);
  localStorage.setItem('marmitas_pedidos', JSON.stringify(pedidos));

  // Limpa carrinho
  cart = [];
  updateCartCount();
  closeCart();

  // Limpa form
  document.getElementById('clienteNome').value = '';
  document.getElementById('clienteTel').value = '';
  document.getElementById('clienteEndereco').value = '';
  document.getElementById('pagamento').value = '';
  document.getElementById('pixInfo').classList.remove('show');

  showToast('Pedido realizado com sucesso! 🎉');
  showSection('pedidos', null);
  renderPedidos();
}

function getPedidos() {
  return JSON.parse(localStorage.getItem('marmitas_pedidos') || '[]');
}

function renderPedidos() {
  const pedidos = getPedidos();
  const container = document.getElementById('pedidosList');

  if (pedidos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <p>Você ainda não fez nenhum pedido.</p>
      </div>`;
    return;
  }

  const sorted = [...pedidos].reverse();

  container.innerHTML = sorted.map(p => {
    const pagLabel = p.pagamento === 'pix' ? '💳 Pix' : '💵 Pagar na entrega';
    const statusClass = `status-${p.status}`;
    const statusLabel = p.status === 'pendente' ? 'PEDIDO REALIZADO — Para confirmar seu pedido, favor enviar o comprovante via WhatsApp.'
      : p.status === 'aceito' ? 'Aceito ✓'
      : 'Recusado ✗';

    return `
      <div class="pedido-card">
        <h4>Pedido #${p.id}</h4>
        <div class="pedido-info">📅 ${p.data}</div>
        <div class="pedido-info">👤 ${p.cliente.nome}</div>
        <div class="pedido-info">${pagLabel}</div>
        <ul class="pedido-items">
          ${p.itens.map(i => `<li>${i.name} x${i.qty} — R$ ${(i.price * i.qty).toFixed(2).replace('.', ',')}</li>`).join('')}
        </ul>
        <div class="pedido-total">Total: R$ ${p.total.toFixed(2).replace('.', ',')}</div>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>`;
  }).join('');
}

function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');

  if (id === 'pedidos') renderPedidos();
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    background:#1a1a1a; color:#fff; padding:12px 24px; border-radius:30px;
    font-size:0.9rem; z-index:999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
    animation: fadeInOut 2.5s forwards;
  `;
  const style = document.createElement('style');
  style.textContent = `@keyframes fadeInOut {
    0%{opacity:0;transform:translateX(-50%) translateY(10px)}
    15%{opacity:1;transform:translateX(-50%) translateY(0)}
    80%{opacity:1}
    100%{opacity:0}
  }`;
  document.head.appendChild(style);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

document.getElementById('cartModal').addEventListener('click', function(e) {
  if (e.target === this) closeCart();
});