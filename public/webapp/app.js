const tg = window.Telegram?.WebApp;

const state = {
  menu: null,
  activeCategory: 'cold',
  cart: new Map(),
  initData: tg?.initData || ''
};

const elements = {
  categoryTabs: document.getElementById('categoryTabs'),
  menuGrid: document.getElementById('menuGrid'),
  cartItems: document.getElementById('cartItems'),
  cartTotal: document.getElementById('cartTotal'),
  checkoutForm: document.getElementById('checkoutForm'),
  template: document.getElementById('menuItemTemplate'),
  nameInput: document.getElementById('nameInput'),
  phoneInput: document.getElementById('phoneInput'),
  addressInput: document.getElementById('addressInput'),
  entranceInput: document.getElementById('entranceInput'),
  floorInput: document.getElementById('floorInput'),
  apartmentInput: document.getElementById('apartmentInput'),
  intercomInput: document.getElementById('intercomInput'),
  deliveryTimeInput: document.getElementById('deliveryTimeInput'),
  commentInput: document.getElementById('commentInput'),
  submitButton: document.getElementById('submitButton')
};

function money(value) {
  return `${Number(value || 0).toLocaleString('ru-RU')} тг`;
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Не удалось выполнить запрос.');
  }

  return payload;
}

function getCartArray() {
  return [...state.cart.values()];
}

function getCartTotal() {
  return getCartArray().reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function renderTabs() {
  elements.categoryTabs.innerHTML = '';
  (state.menu?.categories || []).forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tab${state.activeCategory === category.id ? ' active' : ''}`;
    button.textContent = category.title;
    button.addEventListener('click', () => {
      state.activeCategory = category.id;
      renderTabs();
      renderMenu();
    });
    elements.categoryTabs.appendChild(button);
  });
}

function renderMenu() {
  elements.menuGrid.innerHTML = '';
  const items = (state.menu?.items || []).filter((item) => item.category === state.activeCategory);

  items.forEach((item) => {
    const fragment = elements.template.content.cloneNode(true);
    fragment.querySelector('.menu-category').textContent = item.category === 'cold' ? 'Холодные закуски' : 'Горячие закуски';
    fragment.querySelector('.menu-name').textContent = item.name;
    fragment.querySelector('.menu-price').textContent = money(item.price);
    fragment.querySelector('.add-button').addEventListener('click', () => {
      const existing = state.cart.get(item.id);
      state.cart.set(item.id, {
        ...item,
        quantity: existing ? existing.quantity + 1 : 1
      });
      renderCart();
      tg?.HapticFeedback?.impactOccurred?.('light');
    });
    elements.menuGrid.appendChild(fragment);
  });
}

function updateCartQuantity(id, delta) {
  const entry = state.cart.get(id);
  if (!entry) return;

  const nextQuantity = entry.quantity + delta;
  if (nextQuantity <= 0) {
    state.cart.delete(id);
  } else {
    state.cart.set(id, { ...entry, quantity: nextQuantity });
  }

  renderCart();
}

function renderCart() {
  const cart = getCartArray();
  elements.cartItems.innerHTML = '';
  elements.cartTotal.textContent = money(getCartTotal());

  if (!cart.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Корзина пока пустая';
    elements.cartItems.appendChild(empty);
    return;
  }

  cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <div>${item.name}</div>
      <div class="cart-controls">
        <button type="button" data-action="minus">-</button>
        <span>${item.quantity}</span>
        <button type="button" data-action="plus">+</button>
      </div>
      <div>${money(item.price * item.quantity)}</div>
    `;
    row.querySelector('[data-action="minus"]').addEventListener('click', () => updateCartQuantity(item.id, -1));
    row.querySelector('[data-action="plus"]').addEventListener('click', () => updateCartQuantity(item.id, 1));
    elements.cartItems.appendChild(row);
  });
}

async function bootstrap() {
  try {
    tg?.ready();
    tg?.expand();

    const payload = await apiFetch('/api/webapp/session', {
      method: 'POST',
      body: JSON.stringify({ initData: state.initData })
    });

    state.menu = payload.menu;
    renderTabs();
    renderMenu();
    renderCart();

    const fullName = [payload.user?.firstName, payload.user?.lastName].filter(Boolean).join(' ').trim();
    if (fullName) {
      elements.nameInput.value = fullName;
    }
  } catch (error) {
    window.alert(error.message);
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const items = getCartArray().map((item) => ({ name: item.name, quantity: item.quantity }));
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || '';

  try {
    elements.submitButton.disabled = true;
    const payload = await apiFetch('/api/webapp/orders', {
      method: 'POST',
      body: JSON.stringify({
        initData: state.initData,
        items,
        paymentMethod,
        deliveryTime: elements.deliveryTimeInput.value.trim(),
        customer: {
          name: elements.nameInput.value.trim(),
          phone: elements.phoneInput.value.trim(),
          address: elements.addressInput.value.trim(),
          entrance: elements.entranceInput.value.trim(),
          floor: elements.floorInput.value.trim(),
          apartment: elements.apartmentInput.value.trim(),
          intercom: elements.intercomInput.value.trim(),
          comment: elements.commentInput.value.trim()
        }
      })
    });

    tg?.HapticFeedback?.notificationOccurred?.('success');
    window.alert(`Заказ №${payload.orderCode} принят`);
    tg?.close();
  } catch (error) {
    tg?.HapticFeedback?.notificationOccurred?.('error');
    window.alert(error.message);
  } finally {
    elements.submitButton.disabled = false;
  }
}

elements.checkoutForm.addEventListener('submit', handleSubmit);
bootstrap();
