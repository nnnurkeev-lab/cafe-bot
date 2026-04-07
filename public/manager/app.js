const storageKey = 'cafe-manager-password';
const statusColumns = ['pending', 'cooking', 'ready', 'courier', 'done'];

const elements = {
  loginCard: document.getElementById('loginCard'),
  boardSection: document.getElementById('boardSection'),
  loginForm: document.getElementById('loginForm'),
  passwordInput: document.getElementById('passwordInput'),
  loginError: document.getElementById('loginError'),
  refreshButton: document.getElementById('refreshButton'),
  logoutButton: document.getElementById('logoutButton'),
  lastUpdated: document.getElementById('lastUpdated'),
  template: document.getElementById('orderCardTemplate')
};

let managerPassword = localStorage.getItem(storageKey) || '';
let refreshTimer = null;

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('ru-RU')} тг`;
}

function setLoginError(message = '') {
  elements.loginError.textContent = message;
  elements.loginError.classList.toggle('hidden', !message);
}

function setAuthenticated(isAuthenticated) {
  elements.loginCard.classList.toggle('hidden', isAuthenticated);
  elements.boardSection.classList.toggle('hidden', !isAuthenticated);
  elements.logoutButton.classList.toggle('hidden', !isAuthenticated);
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (managerPassword) {
    headers.set('x-manager-password', managerPassword);
  }

  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Не удалось выполнить запрос.');
  }

  return payload;
}

function makeActionButton(label, tone, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `action-button ${tone}`;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

async function updateOrderStatus(order, status) {
  let etaMinutes = null;
  if (status === 'courier_assigned') {
    const raw = window.prompt(`Сколько минут осталось до клиента для заказа ${order.orderCode}?`, order.etaMinutes || 25);
    if (raw == null) return;

    etaMinutes = Number(raw);
    if (!Number.isInteger(etaMinutes) || etaMinutes < 1 || etaMinutes > 300) {
      window.alert('Введите ETA целым числом от 1 до 300.');
      return;
    }
  }

  try {
    await apiFetch(`/api/manager/orders/${encodeURIComponent(order.orderCode)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, etaMinutes })
    });
    await loadOrders();
  } catch (error) {
    window.alert(error.message);
  }
}

function renderActions(order, container) {
  container.innerHTML = '';

  if (order.status === 'confirmed') {
    container.appendChild(makeActionButton('Готовится', 'cooking', () => updateOrderStatus(order, 'cooking')));
  }

  if (order.status === 'cooking') {
    container.appendChild(makeActionButton('Готов', 'ready', () => updateOrderStatus(order, 'ready')));
  }

  if (order.status === 'ready') {
    container.appendChild(makeActionButton('Передан курьеру', 'courier', () => updateOrderStatus(order, 'courier_assigned')));
  }

  if (order.status === 'courier_assigned') {
    container.appendChild(makeActionButton('Доставлен', 'done', () => updateOrderStatus(order, 'delivered')));
  }
}

function createCard(order) {
  const fragment = elements.template.content.cloneNode(true);
  const card = fragment.querySelector('.order-card');
  const statusTone = order.column === 'done' ? 'done' : order.column;

  fragment.querySelector('.order-code').textContent = `Заказ ${order.orderCode}`;
  fragment.querySelector('.customer-name').textContent = order.name;
  fragment.querySelector('.status-pill').textContent = order.statusLabel;
  fragment.querySelector('.status-pill').classList.add(statusTone);
  fragment.querySelector('.phone').textContent = order.phone;
  fragment.querySelector('.delivery-time').textContent = order.deliveryTime;
  fragment.querySelector('.address').textContent = `${order.address}, подъезд ${order.entrance}, этаж ${order.floor}, квартира ${order.apartment}`;
  fragment.querySelector('.total').textContent = formatMoney(order.total);
  fragment.querySelector('.payment').textContent = order.paymentMethod;
  fragment.querySelector('.comment').textContent = order.comment || 'нет';

  const itemsList = fragment.querySelector('.items-list');
  (order.orderItems || []).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.quantity} x ${item.name}`;
    itemsList.appendChild(li);
  });

  if (!order.orderItems || order.orderItems.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Состав заказа не найден';
    itemsList.appendChild(li);
  }

  const etaBlock = fragment.querySelector('.eta-block');
  if (typeof order.etaMinutes === 'number' && order.etaMinutes > 0) {
    etaBlock.classList.remove('hidden');
    fragment.querySelector('.eta').textContent = `${order.etaMinutes} мин`;
  }

  renderActions(order, fragment.querySelector('.actions'));
  return card;
}

function renderEmptyState(container, text) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = text;
  container.appendChild(empty);
}

function renderBoard(orders) {
  const grouped = Object.fromEntries(statusColumns.map((column) => [column, []]));
  orders.forEach((order) => {
    const key = grouped[order.column] ? order.column : 'pending';
    grouped[key].push(order);
  });

  statusColumns.forEach((column) => {
    const container = document.getElementById(`column-${column}`);
    const count = document.getElementById(`count-${column}`);
    container.innerHTML = '';
    count.textContent = grouped[column].length;

    if (grouped[column].length === 0) {
      renderEmptyState(container, 'Пока пусто');
      return;
    }

    grouped[column].forEach((order) => {
      container.appendChild(createCard(order));
    });
  });
}

async function loadOrders() {
  try {
    const payload = await apiFetch('/api/manager/orders');
    renderBoard(payload.orders || []);
    const updated = new Date(payload.generatedAt || Date.now());
    elements.lastUpdated.textContent = `Обновлено: ${updated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    if (error.message.includes('авторизация')) {
      setAuthenticated(false);
      return;
    }

    window.alert(error.message);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setLoginError('');
  managerPassword = elements.passwordInput.value.trim();

  try {
    await fetch('/api/manager/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: managerPassword })
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось войти.');
      }
    });

    localStorage.setItem(storageKey, managerPassword);
    setAuthenticated(true);
    await loadOrders();
  } catch (error) {
    managerPassword = '';
    localStorage.removeItem(storageKey);
    setLoginError(error.message);
  }
}

function logout() {
  managerPassword = '';
  localStorage.removeItem(storageKey);
  setAuthenticated(false);
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (managerPassword) {
      loadOrders();
    }
  }, 15000);
}

elements.loginForm.addEventListener('submit', handleLogin);
elements.refreshButton.addEventListener('click', () => {
  if (managerPassword) {
    loadOrders();
  }
});
elements.logoutButton.addEventListener('click', logout);

setAuthenticated(Boolean(managerPassword));
if (managerPassword) {
  loadOrders();
}
startAutoRefresh();
