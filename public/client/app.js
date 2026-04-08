const state = {
  menu: null,
  activeCategory: 'cold',
  cart: new Map()
};

const elements = {
  categoryTabs: document.getElementById('categoryTabs'),
  menuGrid: document.getElementById('menuGrid'),
  cartItems: document.getElementById('cartItems'),
  cartTotal: document.getElementById('cartTotal'),
  checkoutForm: document.getElementById('checkoutForm'),
  bookingForm: document.getElementById('bookingForm'),
  trackingForm: document.getElementById('trackingForm'),
  trackingResult: document.getElementById('trackingResult'),
  template: document.getElementById('menuItemTemplate'),
  minOrderBadge: document.getElementById('minOrderBadge'),
  nameInput: document.getElementById('nameInput'),
  phoneInput: document.getElementById('phoneInput'),
  addressInput: document.getElementById('addressInput'),
  entranceInput: document.getElementById('entranceInput'),
  floorInput: document.getElementById('floorInput'),
  apartmentInput: document.getElementById('apartmentInput'),
  intercomInput: document.getElementById('intercomInput'),
  deliveryTimeInput: document.getElementById('deliveryTimeInput'),
  commentInput: document.getElementById('commentInput'),
  submitButton: document.getElementById('submitButton'),
  bookingNameInput: document.getElementById('bookingNameInput'),
  bookingPhoneInput: document.getElementById('bookingPhoneInput'),
  bookingDateTimeInput: document.getElementById('bookingDateTimeInput'),
  bookingGuestsInput: document.getElementById('bookingGuestsInput'),
  bookingUseCartInput: document.getElementById('bookingUseCartInput'),
  bookingSubmitButton: document.getElementById('bookingSubmitButton'),
  trackingOrderCodeInput: document.getElementById('trackingOrderCodeInput')
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
    empty.className = 'empty-state';
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

function buildResultCard(container, html, tone = '') {
  container.className = `result-card${tone ? ` ${tone}` : ''}`;
  container.innerHTML = html;
}

function buildCartPayload() {
  return getCartArray().map((item) => ({
    name: item.name,
    quantity: item.quantity
  }));
}

async function bootstrap() {
  try {
    const payload = await apiFetch('/api/client/bootstrap');
    state.menu = payload.menu;
    elements.minOrderBadge.textContent = `Минимум: ${money(payload.menu.minOrderTotal)}`;
    renderTabs();
    renderMenu();
    renderCart();
  } catch (error) {
    buildResultCard(elements.trackingResult, error.message, 'error');
  }
}

async function handleOrderSubmit(event) {
  event.preventDefault();

  try {
    elements.submitButton.disabled = true;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || '';

    const payload = await apiFetch('/api/client/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: buildCartPayload(),
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

    window.alert(`Заказ №${payload.orderCode} оформлен. Сохраните номер для отслеживания.`);
    state.cart.clear();
    renderCart();
    elements.checkoutForm.reset();
    elements.trackingOrderCodeInput.value = payload.orderCode;
    document.getElementById('tracking').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    window.alert(error.message);
  } finally {
    elements.submitButton.disabled = false;
  }
}

async function handleBookingSubmit(event) {
  event.preventDefault();

  try {
    elements.bookingSubmitButton.disabled = true;
    const payload = await apiFetch('/api/client/bookings', {
      method: 'POST',
      body: JSON.stringify({
        booking: {
          name: elements.bookingNameInput.value.trim(),
          phone: elements.bookingPhoneInput.value.trim(),
          dateTime: elements.bookingDateTimeInput.value.trim(),
          guests: elements.bookingGuestsInput.value.trim()
        },
        items: elements.bookingUseCartInput.checked ? buildCartPayload() : []
      })
    });

    window.alert(`Бронь подтверждена. Столик №${payload.tableNum}, ${payload.date} в ${payload.time}.`);
    elements.bookingForm.reset();
  } catch (error) {
    window.alert(error.message);
  } finally {
    elements.bookingSubmitButton.disabled = false;
  }
}

async function handleTrackingSubmit(event) {
  event.preventDefault();

  try {
    const payload = await apiFetch('/api/client/track', {
      method: 'POST',
      body: JSON.stringify({
        orderCode: elements.trackingOrderCodeInput.value.trim()
      })
    });

    const history = (payload.order.history || [])
      .slice(-6)
      .map((entry) => `<div class="tracking-history-item">${entry.at}: ${entry.comment ? `${entry.comment} (${payload.order.statusLabel})` : payload.order.statusLabel}</div>`)
      .join('');

    buildResultCard(
      elements.trackingResult,
      `
        <h3>Заказ ${payload.order.orderCode}</h3>
        <p><strong>Статус:</strong> ${payload.order.statusLabel}</p>
        <p><strong>Сумма:</strong> ${money(payload.order.total)}</p>
        <p><strong>Время доставки:</strong> ${payload.order.deliveryTime}</p>
        ${typeof payload.order.etaMinutes === 'number' ? `<p><strong>Осталось:</strong> ${payload.order.etaMinutes} мин.</p>` : ''}
        <div class="tracking-history">${history || `<div class="tracking-history-item">${payload.trackingText.replace(/\n/g, '<br>')}</div>`}</div>
      `,
      'success'
    );
  } catch (error) {
    buildResultCard(elements.trackingResult, error.message, 'error');
  }
}

elements.checkoutForm.addEventListener('submit', handleOrderSubmit);
elements.bookingForm.addEventListener('submit', handleBookingSubmit);
elements.trackingForm.addEventListener('submit', handleTrackingSubmit);

bootstrap();
