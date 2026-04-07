require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const MENU_PHOTO_ID = process.env.MENU_PHOTO_ID;
const MANAGER_ID = 979390128;
const MY_ID = 979390128;
const TIME_ZONE = 'Asia/Almaty';
const MIN_ORDER_TOTAL = 4000;
const CONTACT_MANAGER_TEXT = '👨‍💼 Связаться с менеджером';
const COLD_APPETIZERS_TEXT = '🥗 Холодные закуски';
const HOT_APPETIZERS_TEXT = '🔥 Горячие закуски';
const MENU_SECTIONS_TEXT = '📂 Разделы меню';
const FINISH_SELECTION_TEXT = '✅ Завершить выбор';
const SKIP_PREORDER_TEXT = '🚫 Без предзаказа';
const CASH_PAYMENT_TEXT = 'Оплата наличными при получении';
const CARD_PAYMENT_TEXT = 'Оплата картой/Kaspi QR';
const CURRENT_ORDER_TEXT = '🧾 Мой заказ';
const CREATOR_TEXT = 'Кто твой создатель?';
const NONSENSE_REPLY = 'Нормально сформулируйте запрос: напишите блюдо, вопрос по меню или воспользуйтесь кнопками ниже.';
const TRACK_ORDER_TEXT = '📦 Отследить заказ';
const REPEAT_ORDER_TEXT = '🔁 Повторить заказ';

if (!TELEGRAM_TOKEN) throw new Error('TELEGRAM_TOKEN is required');
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL and SUPABASE_KEY are required');

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

const sessions = new Map();
const ordersByCode = new Map();
const orderCodesByChat = new Map();
const pendingEtaByManager = new Map();

const TABLES = [
  { id: 1, seats: 2 },
  { id: 2, seats: 4 },
  { id: 3, seats: 4 },
  { id: 4, seats: 6 },
  { id: 5, seats: 8 }
];

const MENU = `
ХОЛОДНЫЕ ЗАКУСКИ:
- Мясное ассорти (язык, ростбиф, казы) — 4290 тг
- Конское ассорти (казы, жая, копченая конина) — 4390 тг
- Рыбное ассорти (балык, семга, горбуша) — 4490 тг
- Сырная доска (пармезан, фета, сулугуни, моцарелла, блю-чиз) — 3990 тг
- Русская закуска (сельдь, картофель, соленые огурцы, квашенная капуста, лук) — 2290 тг
- Кавказская закуска (томаты, огурцы, перец болгарский, брынза, зелень) — 2590 тг
- Ассорти солений (огурцы, помидоры, квашеная капуста, маринованные опята и патиссоны) — 2390 тг
- Рулетики по-грузински (кабачки, баклажаны, томаты, сыр креметте, майонез, чеснок) — 2390 тг
- Рулетики с сёмгой — 3090 тг
- Казы — 2090 тг
- Оливки — 790 тг

ГОРЯЧИЕ ЗАКУСКИ:
- Запеченные мозговые кости — 2790 тг
- Жульен с курицей — 2390 тг
- Жульен с грибами — 2390 тг
- Мини-чебуреки (подаются с соусом тар-тар) — 2090 тг
- Крылышки в соусе терияки — 2690 тг
- Крылышки в соусе свит-чили — 2590 тг
- Острые крылышки в хрустящей панировке — 2590 тг
- Креветки к пиву (жареные, подаются не очищенные) — 2990 тг
- Сырные палочки — 2190 тг
- Куриные стрипсы — 2090 тг
- Луковые кольца — 1690 тг
- Королевские креветки в темпуре (8 шт) — 3890 тг
- Мойва на шпажках — 2090 тг
- Хрустящие шампиньоны с чесночным соусом — 2090 тг
- Шампиньоны запеченные под сыром — 2290 тг
- Долма — 2290 тг
- Картофельная доска (хэшбрауны, картофель фри, картофель по-домашнему, дольки, кетчуп и сырный соус) — 3990 тг
`.trim();

const MENU_ITEMS = [
  { name: 'Мясное ассорти', aliases: ['мясное ассорти'], price: 4290, category: 'cold' },
  { name: 'Конское ассорти', aliases: ['конское ассорти'], price: 4390, category: 'cold' },
  { name: 'Рыбное ассорти', aliases: ['рыбное ассорти'], price: 4490, category: 'cold' },
  { name: 'Сырная доска', aliases: ['сырная доска'], price: 3990, category: 'cold' },
  { name: 'Русская закуска', aliases: ['русская закуска'], price: 2290, category: 'cold' },
  { name: 'Кавказская закуска', aliases: ['кавказская закуска'], price: 2590, category: 'cold' },
  { name: 'Ассорти солений', aliases: ['ассорти солений'], price: 2390, category: 'cold' },
  { name: 'Рулетики по-грузински', aliases: ['рулетики по-грузински'], price: 2390, category: 'cold' },
  { name: 'Рулетики с сёмгой', aliases: ['рулетики с сёмгой', 'рулетики с семгой'], price: 3090, category: 'cold' },
  { name: 'Казы', aliases: ['казы'], price: 2090, category: 'cold' },
  { name: 'Оливки', aliases: ['оливки'], price: 790, category: 'cold' },
  { name: 'Запеченные мозговые кости', aliases: ['запеченные мозговые кости', 'мозги', 'мозговые кости', 'мозговые'], price: 2790, category: 'hot' },
  { name: 'Жульен с курицей', aliases: ['жульен с курицей'], price: 2390, category: 'hot' },
  { name: 'Жульен с грибами', aliases: ['жульен с грибами'], price: 2390, category: 'hot' },
  { name: 'Мини-чебуреки', aliases: ['мини-чебуреки', 'мини чебуреки'], price: 2090, category: 'hot' },
  { name: 'Крылышки в соусе терияки', aliases: ['крылышки в соусе терияки'], price: 2690, category: 'hot' },
  { name: 'Крылышки в соусе свит-чили', aliases: ['крылышки в соусе свит-чили', 'крылышки в соусе свит чили'], price: 2590, category: 'hot' },
  { name: 'Острые крылышки в хрустящей панировке', aliases: ['острые крылышки в хрустящей панировке', 'острые крылышки'], price: 2590, category: 'hot' },
  { name: 'Креветки к пиву', aliases: ['креветки к пиву'], price: 2990, category: 'hot' },
  { name: 'Сырные палочки', aliases: ['сырные палочки'], price: 2190, category: 'hot' },
  { name: 'Куриные стрипсы', aliases: ['куриные стрипсы'], price: 2090, category: 'hot' },
  { name: 'Луковые кольца', aliases: ['луковые кольца'], price: 1690, category: 'hot' },
  { name: 'Королевские креветки в темпуре', aliases: ['королевские креветки в темпуре', 'королевские креветки', 'каралевски креветки', 'креветки в темпуре'], price: 3890, category: 'hot' },
  { name: 'Мойва на шпажках', aliases: ['мойва на шпажках'], price: 2090, category: 'hot' },
  { name: 'Хрустящие шампиньоны с чесночным соусом', aliases: ['хрустящие шампиньоны с чесночным соусом', 'хрустящие шампиньоны'], price: 2090, category: 'hot' },
  { name: 'Шампиньоны запеченные под сыром', aliases: ['шампиньоны запеченные под сыром'], price: 2290, category: 'hot' },
  { name: 'Долма', aliases: ['долма'], price: 2290, category: 'hot' },
  { name: 'Картофельная доска', aliases: ['картофельная доска'], price: 3990, category: 'hot' }
];

const MAIN_KEYBOARD_ROWS = [
  [{ text: '🍕 Заказать еду' }, { text: '🪑 Забронировать стол' }],
  [{ text: '📋 Меню' }, { text: 'ℹ️ Помощь' }],
  [{ text: TRACK_ORDER_TEXT }, { text: REPEAT_ORDER_TEXT }],
  [{ text: CREATOR_TEXT }],
  [{ text: CONTACT_MANAGER_TEXT }]
];

function createKeyboard(rows, isPersistent = false) {
  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      is_persistent: isPersistent
    }
  };
}

function createInlineKeyboard(rows) {
  return {
    reply_markup: {
      inline_keyboard: rows
    }
  };
}

function chunkButtons(items, size = 2) {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size).map((text) => ({ text })));
  }
  return rows;
}

function createMenuSectionKeyboard(section, options = {}) {
  const names = MENU_ITEMS
    .filter((item) => item.category === section)
    .map((item) => item.name);

  const rows = chunkButtons(names, 2);
  rows.push([{ text: MENU_SECTIONS_TEXT }, { text: CURRENT_ORDER_TEXT }]);
  rows.push([{ text: FINISH_SELECTION_TEXT }]);

  if (options.allowSkipPreorder) {
    rows.push([{ text: SKIP_PREORDER_TEXT }]);
  }

  rows.push([{ text: CONTACT_MANAGER_TEXT }]);
  rows.push([{ text: '❌ Отменить заказ' }, { text: '⬅️ Главное меню' }]);
  return createKeyboard(rows);
}

function createMenuCategoryKeyboard(options = {}) {
  const rows = [
    [{ text: COLD_APPETIZERS_TEXT }, { text: HOT_APPETIZERS_TEXT }],
    [{ text: CURRENT_ORDER_TEXT }],
    [{ text: FINISH_SELECTION_TEXT }]
  ];

  if (options.allowSkipPreorder) {
    rows.unshift([{ text: SKIP_PREORDER_TEXT }]);
  }

  rows.push([{ text: CONTACT_MANAGER_TEXT }]);
  rows.push([{ text: '❌ Отменить заказ' }, { text: '⬅️ Главное меню' }]);
  return createKeyboard(rows);
}

const mainKeyboard = createKeyboard(MAIN_KEYBOARD_ROWS, true);

const bookingKeyboard = createKeyboard([
  [{ text: '🍽️ Забронировать + предзаказ блюд' }],
  [{ text: '🪑 Просто забронировать стол' }],
  [{ text: CONTACT_MANAGER_TEXT }],
  [{ text: '⬅️ Главное меню' }]
]);

const cancelKeyboard = createKeyboard([
  [{ text: CONTACT_MANAGER_TEXT }],
  [{ text: '❌ Отменить заказ' }, { text: '⬅️ Главное меню' }]
]);

const confirmOrderKeyboard = createKeyboard([
  [{ text: '✅ Да, подтвердить заказ' }, { text: '✏️ Изменить заказ' }],
  [{ text: CONTACT_MANAGER_TEXT }],
  [{ text: '❌ Отменить заказ' }, { text: '⬅️ Главное меню' }]
]);

const paymentKeyboard = createKeyboard([
  [{ text: CASH_PAYMENT_TEXT }],
  [{ text: CARD_PAYMENT_TEXT }],
  [{ text: '✏️ Изменить заказ' }],
  [{ text: '❌ Отменить заказ' }, { text: '⬅️ Главное меню' }]
]);

const confirmBookingKeyboard = createKeyboard([
  [{ text: '✅ Да, подтвердить бронь' }, { text: '✏️ Изменить бронь' }],
  [{ text: CONTACT_MANAGER_TEXT }],
  [{ text: '❌ Отменить' }, { text: '⬅️ Главное меню' }]
]);

const orderCategoryKeyboard = createMenuCategoryKeyboard();
const preorderCategoryKeyboard = createMenuCategoryKeyboard({ allowSkipPreorder: true });
const coldOrderKeyboard = createMenuSectionKeyboard('cold');
const hotOrderKeyboard = createMenuSectionKeyboard('hot');
const coldPreorderKeyboard = createMenuSectionKeyboard('cold', { allowSkipPreorder: true });
const hotPreorderKeyboard = createMenuSectionKeyboard('hot', { allowSkipPreorder: true });

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      flow: 'idle',
      step: null,
      history: [],
      data: {}
    });
  }
  return sessions.get(chatId);
}

function resetSession(chatId) {
  sessions.set(chatId, {
    flow: 'idle',
    step: null,
    history: [],
    data: {}
  });
}

function pushHistoryEntry(session, role, text) {
  if (!session || !text) return;
  session.history.push({ role, text: String(text).trim() });
  if (session.history.length > 10) {
    session.history = session.history.slice(-10);
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCurrentDateTimeParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    date: `${parts.day}.${parts.month}.${parts.year}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

function levenshteinDistance(a, b) {
  const source = normalizeText(a);
  const target = normalizeText(b);

  if (!source) return target.length;
  if (!target) return source.length;

  const prev = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let i = 1; i <= source.length; i += 1) {
    let next = [i];

    for (let j = 1; j <= target.length; j += 1) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      next[j] = Math.min(
        next[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }

    for (let j = 0; j <= target.length; j += 1) {
      prev[j] = next[j];
    }
  }

  return prev[target.length];
}

function buildSearchCandidates(item) {
  return [item.name, ...item.aliases];
}

function findMenuItemByAlias(alias) {
  const normalized = normalizeText(alias);
  if (!normalized) return null;

  for (const item of MENU_ITEMS) {
    const candidates = buildSearchCandidates(item);
    if (candidates.some((candidate) => normalizeText(candidate) === normalized)) {
      return item;
    }
  }

  const queryTokens = normalized.split(' ').filter(Boolean);
  const ranked = MENU_ITEMS.map((item) => {
    const candidates = buildSearchCandidates(item).map(normalizeText);
    const tokenMatch = candidates.some((candidate) =>
      queryTokens.every((token) => candidate.includes(token))
    );
    const partialMatch = candidates.some((candidate) =>
      candidate.includes(normalized) || normalized.includes(candidate)
    );
    const distance = Math.min(...candidates.map((candidate) => levenshteinDistance(normalized, candidate)));

    return { item, tokenMatch, partialMatch, distance };
  }).sort((left, right) => {
    if (left.tokenMatch !== right.tokenMatch) return left.tokenMatch ? -1 : 1;
    if (left.partialMatch !== right.partialMatch) return left.partialMatch ? -1 : 1;
    return left.distance - right.distance;
  });

  const best = ranked[0];
  if (!best) return null;

  if (best.tokenMatch || best.partialMatch) return best.item;

  const threshold = normalized.length <= 6 ? 1 : 2;
  return best.distance <= threshold ? best.item : null;
}

function suggestMenuItems(alias, limit = 3) {
  const normalized = normalizeText(alias);
  if (!normalized) return [];

  return MENU_ITEMS.map((item) => {
    const candidates = buildSearchCandidates(item).map(normalizeText);
    const distance = Math.min(...candidates.map((candidate) => levenshteinDistance(normalized, candidate)));
    return { item, distance };
  })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, limit)
    .map((entry) => entry.item.name);
}

function isRudeOrNonsenseText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  const rudeMarkers = [
    'хуй', 'хер', 'хуйня', 'пизд', 'еб', 'бля', 'бляд', 'сука', 'нах', 'сперма'
  ];

  return rudeMarkers.some((marker) => normalized.includes(marker));
}

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('ru-RU')} тг`;
}

function generateOrderCode() {
  return `ORD-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

function getOrderStatusLabel(status) {
  const labels = {
    confirmed: 'принят',
    cooking: 'готовится',
    courier_assigned: 'передан курьеру',
    delivered: 'доставлен',
    cancelled: 'отменён'
  };

  return labels[status] || 'обрабатывается';
}

function getCurrentStatusTimestamp() {
  const now = getCurrentDateTimeParts();
  return `${now.date} ${now.time}`;
}

function createOrderHistoryEntry(status, comment = '') {
  return {
    status,
    comment,
    at: getCurrentStatusTimestamp()
  };
}

function rememberOrder(order) {
  ordersByCode.set(order.orderCode, order);

  const existingCodes = orderCodesByChat.get(order.chatId) || [];
  orderCodesByChat.set(order.chatId, [...existingCodes.filter((code) => code !== order.orderCode), order.orderCode]);
}

function getLatestOrderForChat(chatId) {
  const codes = orderCodesByChat.get(chatId) || [];
  const activeStatuses = ['confirmed', 'cooking', 'courier_assigned'];

  for (let index = codes.length - 1; index >= 0; index -= 1) {
    const order = ordersByCode.get(codes[index]);
    if (order && activeStatuses.includes(order.status)) {
      return order;
    }
  }

  for (let index = codes.length - 1; index >= 0; index -= 1) {
    const order = ordersByCode.get(codes[index]);
    if (order) return order;
  }

  return null;
}

function getLatestOrderForRepeat(chatId) {
  const codes = orderCodesByChat.get(chatId) || [];
  for (let index = codes.length - 1; index >= 0; index -= 1) {
    const order = ordersByCode.get(codes[index]);
    if (order) return order;
  }
  return null;
}

function buildManagerOrderStatusKeyboard(orderCode) {
  return createInlineKeyboard([
    [
      { text: 'Готовится', callback_data: `order_status:${orderCode}:cooking` },
      { text: 'Передан курьеру', callback_data: `order_status:${orderCode}:courier` }
    ],
    [
      { text: 'Доставлен', callback_data: `order_status:${orderCode}:delivered` }
    ]
  ]);
}

function buildOrderTrackingText(order) {
  if (!order) {
    return 'Активных заказов пока не найдено.';
  }

  const historyText = (order.history || [])
    .slice(-4)
    .map((entry) => {
      const suffix = entry.comment ? ` — ${entry.comment}` : '';
      return `• ${entry.at}: ${getOrderStatusLabel(entry.status)}${suffix}`;
    })
    .join('\n');

  const etaText = order.etaMinutes ? `\nОриентировочно осталось: ${order.etaMinutes} мин.` : '';

  return (
    `Заказ №${order.orderCode}\n` +
    `Статус: ${getOrderStatusLabel(order.status)}${etaText}\n` +
    `Сумма: ${formatMoney(order.total)}\n` +
    `Время доставки: ${order.deliveryTime}\n\n` +
    `История:\n${historyText || '• Заказ только что создан'}`
  );
}

function buildManagerOrderMessage(order) {
  return (
    `🔔 Новый заказ №${order.orderCode}\n\n` +
    `👤 Клиент: ${order.name}\n` +
    `📞 Телефон: ${order.phone}\n` +
    `🆔 Chat ID: ${order.chatId}\n` +
    `📍 Адрес: ${order.address}\n` +
    `🚪 Подъезд: ${order.entrance}\n` +
    `🏢 Этаж: ${order.floor}\n` +
    `🏠 Квартира: ${order.apartment}\n` +
    `🔢 Домофон: ${order.intercom}\n` +
    `🍽️ Позиции:\n${formatOrderItems(order.orderItems)}\n\n` +
    `💰 Сумма: ${formatMoney(order.total)}\n` +
    `💳 Оплата: ${order.paymentMethod}\n` +
    `⏰ Время: ${order.deliveryTime}\n` +
    `💬 Комментарий: ${order.comment || 'нет'}\n` +
    `📌 Статус: ${getOrderStatusLabel(order.status)}`
  );
}

function isWorkingHours() {
  const { hour: hours } = getCurrentDateTimeParts();
  return hours >= 8 || hours < 2;
}

function getCurrentTimeText() {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
}

function isValidName(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (/^\d+$/u.test(trimmed)) return false;
  return true;
}

function isValidPhone(text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!/^\+?\d+$/u.test(trimmed)) return false;
  return /^(?:\+7|8|7)\d{10}$/u.test(trimmed);
}

function normalizePhone(text) {
  const digits = String(text || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  if (digits.startsWith('7') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('77') && digits.length === 12) {
    return `+${digits}`;
  }
  return text.trim();
}

function isPositiveInteger(text) {
  return /^[1-9]\d*$/.test(String(text || '').trim());
}

function formatParsedDateValue(day, month, year) {
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

function buildParsedDate(day, month, year) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    day,
    month,
    year,
    value: formatParsedDateValue(day, month, year)
  };
}

function buildRelativeDate(offsetDays) {
  const now = getCurrentDateTimeParts();
  const base = new Date(Date.UTC(now.year, now.month - 1, now.day));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return buildParsedDate(base.getUTCDate(), base.getUTCMonth() + 1, base.getUTCFullYear());
}

function parseDate(text) {
  const rawText = String(text || '').trim();
  const normalized = normalizeText(rawText).replace(/^(?:на|в|во)\s+/u, '');
  const currentYear = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric'
  }).format(new Date()));

  if (normalized === 'сегодня') return buildRelativeDate(0);
  if (normalized === 'завтра') return buildRelativeDate(1);
  if (normalized === 'послезавтра') return buildRelativeDate(2);

  const weekdayMap = {
    'воскресенье': 0,
    'понедельник': 1,
    'вторник': 2,
    'среда': 3,
    'среду': 3,
    'четверг': 4,
    'пятница': 5,
    'пятницу': 5,
    'суббота': 6
  };

  if (Object.prototype.hasOwnProperty.call(weekdayMap, normalized)) {
    const now = getCurrentDateTimeParts();
    const base = new Date(Date.UTC(now.year, now.month - 1, now.day));
    const currentWeekday = base.getUTCDay();
    let offset = (weekdayMap[normalized] - currentWeekday + 7) % 7;
    if (offset === 0) offset = 7;
    return buildRelativeDate(offset);
  }

  const namedMonthMap = {
    'января': 1, 'январь': 1, 'янв': 1,
    'февраля': 2, 'февраль': 2, 'фев': 2,
    'марта': 3, 'март': 3, 'мар': 3,
    'апреля': 4, 'апрель': 4, 'апр': 4,
    'мая': 5, 'май': 5,
    'июня': 6, 'июнь': 6, 'июн': 6,
    'июля': 7, 'июль': 7, 'июл': 7,
    'августа': 8, 'август': 8, 'авг': 8,
    'сентября': 9, 'сентябрь': 9, 'сен': 9,
    'октября': 10, 'октябрь': 10, 'окт': 10,
    'ноября': 11, 'ноябрь': 11, 'ноя': 11,
    'декабря': 12, 'декабрь': 12, 'дек': 12
  };

  const namedMonthMatch = normalized.match(/^(\d{1,2})\s+([a-zа-я]+)(?:\s+(\d{2,4}))?$/u);
  if (namedMonthMatch) {
    const day = Number(namedMonthMatch[1]);
    const month = namedMonthMap[namedMonthMatch[2]];
    let year = namedMonthMatch[3] ? Number(namedMonthMatch[3]) : currentYear;

    if (month) {
      if (year < 100) year += 2000;
      return buildParsedDate(day, month, year);
    }
  }

  const match = rawText.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : currentYear;

  if (year < 100) year += 2000;
  return buildParsedDate(day, month, year);
}

function parseTime(text) {
  const rawText = String(text || '').trim();
  const normalized = normalizeText(rawText);
  const cleaned = normalized.replace(/^(?:в|во|к|на)\s+/u, '');
  const wordHourMap = {
    'час': 1, 'часу': 1, 'часа': 1,
    'два': 2, 'двух': 2, 'двум': 2,
    'три': 3, 'трех': 3, 'трёх': 3,
    'четыре': 4, 'четырех': 4, 'четырёх': 4,
    'пять': 5, 'пяти': 5,
    'шесть': 6, 'шести': 6,
    'семь': 7, 'семи': 7,
    'восемь': 8, 'восьми': 8,
    'девять': 9, 'девяти': 9,
    'десять': 10, 'десяти': 10,
    'одиннадцать': 11, 'одиннадцати': 11,
    'двенадцать': 12, 'двенадцати': 12
  };

  const wordTimeMatch = cleaned.match(/^([a-zа-я]+)(?:\s*(утра|дня|вечера|ночи))?$/u);
  if (wordTimeMatch && wordHourMap[wordTimeMatch[1]]) {
    const hour = wordHourMap[wordTimeMatch[1]];
    return parseTime(`${hour}${wordTimeMatch[2] ? ` ${wordTimeMatch[2]}` : ''}`);
  }

  if (cleaned === 'сейчас') {
    const now = getCurrentDateTimeParts();
    return {
      hours: now.hour,
      minutes: now.minute,
      value: `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`
    };
  }

  if (cleaned === 'полдень') {
    return { hours: 12, minutes: 0, value: '12:00' };
  }

  if (cleaned === 'полночь') {
    return { hours: 0, minutes: 0, value: '00:00' };
  }

  const relativeHourMatch = cleaned.match(/^через\s+(\d+)\s*(час|часа|часов)$/u);
  if (relativeHourMatch) {
    const addHours = Number(relativeHourMatch[1]);
    const now = getCurrentDateTimeParts();
    const totalMinutes = now.hour * 60 + now.minute + addHours * 60;
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    return {
      hours,
      minutes,
      value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    };
  }

  const relativeMinuteMatch = cleaned.match(/^через\s+(\d+)\s*(минут|минута|минуты)$/u);
  if (relativeMinuteMatch) {
    const addMinutes = Number(relativeMinuteMatch[1]);
    const now = getCurrentDateTimeParts();
    const totalMinutes = now.hour * 60 + now.minute + addMinutes;
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    return {
      hours,
      minutes,
      value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    };
  }

  const naturalMatch = cleaned.match(/^(\d{1,2})(?:(?::|\.|\s)(\d{2}))?(?:\s*(утра|дня|вечера|ночи))?$/u)
    || cleaned.match(/^(\d{1,2})\s*(?:час|часа|часов)(?:(?::|\.|\s)(\d{2}))?(?:\s*(утра|дня|вечера|ночи))?$/u);

  if (naturalMatch) {
    let hours = Number(naturalMatch[1]);
    const minutes = naturalMatch[2] ? Number(naturalMatch[2]) : 0;
    const period = naturalMatch[3] || '';

    if (minutes > 59 || hours > 24) return null;

    if (period === 'утра') {
      if (hours === 12) hours = 0;
    } else if (period === 'дня') {
      if (hours >= 1 && hours <= 11) hours += 12;
    } else if (period === 'вечера') {
      if (hours >= 1 && hours <= 11) hours += 12;
    } else if (period === 'ночи') {
      if (hours === 12) hours = 0;
      if (hours >= 1 && hours <= 5) {
        hours = hours;
      } else if (hours >= 6 && hours <= 11) {
        hours += 12;
      }
    }

    if (hours === 24 && minutes === 0) {
      hours = 0;
    }

    if (hours > 23) return null;

    return {
      hours,
      minutes,
      value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    };
  }

  const match = rawText.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return {
    hours,
    minutes,
    value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  };
}

function extractDateCandidate(text) {
  const normalized = normalizeText(text);
  if (!normalized) return '';

  const directDate = parseDate(normalized);
  if (directDate) return normalized;

  const patterns = [
    /\bсегодня\b/u,
    /\bзавтра\b/u,
    /\bпослезавтра\b/u,
    /\b(?:в\s+)?(?:понедельник|вторник|среда|среду|четверг|пятница|пятницу|суббота|воскресенье)\b/u,
    /\b\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?\b/u,
    /\b\d{1,2}\s+(?:января|январь|янв|февраля|февраль|фев|марта|март|мар|апреля|апрель|апр|мая|май|июня|июнь|июн|июля|июль|июл|августа|август|авг|сентября|сентябрь|сен|октября|октябрь|окт|ноября|ноябрь|ноя|декабря|декабрь|дек)(?:\s+\d{2,4})?\b/u
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[0];
  }

  return '';
}

function extractTimeCandidate(text) {
  const normalized = normalizeText(text);
  if (!normalized) return '';

  const directTime = parseTime(normalized);
  if (directTime) return normalized;

  const patterns = [
    /\bчерез\s+\d+\s*(?:час|часа|часов|минут|минута|минуты)\b/u,
    /\b(?:сейчас|полдень|полночь)\b/u,
    /\b\d{1,2}(?::|\.)\d{2}(?:\s*(?:утра|дня|вечера|ночи))?\b/u,
    /\b\d{1,2}\s*(?:час|часа|часов)(?:(?::|\.|\s)\d{2})?(?:\s*(?:утра|дня|вечера|ночи))?\b/u,
    /\b\d{1,2}\s*(?:утра|дня|вечера|ночи)\b/u
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[0];
  }

  return '';
}

function parseBookingDateTime(text) {
  const dateCandidate = extractDateCandidate(text);
  const timeCandidate = extractTimeCandidate(text);
  const parsedDate = parseDate(text) || (dateCandidate ? parseDate(dateCandidate) : null);
  const parsedTime = parseTime(text) || (timeCandidate ? parseTime(timeCandidate) : null);

  return {
    parsedDate,
    parsedTime,
    hasDate: Boolean(parsedDate),
    hasTime: Boolean(parsedTime)
  };
}

function isBookingTimeAllowed(parsedTime) {
  if (!parsedTime) return false;
  return parsedTime.hours >= 8 || parsedTime.hours < 2;
}

function looksLikeOrderInput(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  if (isConfirmationText(normalized) || isRejectionText(normalized)) {
    return false;
  }

  if (/^\d+\s*[xх*]\s+.+$/i.test(String(text || '').trim())) {
    return true;
  }

  return isAllMenuRequest(text) || parseNaturalOrderText(text).items.length > 0 || Boolean(findMenuItemByAlias(text));
}

function isDoneOrderingText(text) {
  const normalized = normalizeText(text);
  if (['все', 'всё', 'готово', 'это все', 'это всё', 'хватит', normalizeText(FINISH_SELECTION_TEXT)].includes(normalized)) {
    return true;
  }

  return /^(?:ну\s+)?(?:да\s+)?(?:все|всё)(?:\s+хватит|\s+достаточно|\s+готово)?$/u.test(normalized);
}

function isConfirmationText(text) {
  const normalized = normalizeText(text);
  return ['да', 'ага', 'угу', 'ок', 'окей', 'хорошо', 'подтверждаю'].includes(normalized);
}

function isRejectionText(text) {
  const normalized = normalizeText(text);
  return ['нет', 'неа', 'не надо', 'не нужно', 'отмена'].includes(normalized);
}

function isOrderSummaryQuestion(text) {
  const normalized = normalizeText(text);
  if (normalized === normalizeText(CURRENT_ORDER_TEXT)) {
    return true;
  }

  const hasOrderWord = ['заказ', 'заказе', 'заказал', 'заказали'].some((word) => normalized.includes(word));
  const hasQueryWord = ['что', 'какой', 'какие', 'покажи', 'показать', 'посмотреть', 'сейчас', 'итого'].some((word) => normalized.includes(word));
  const hasPossessiveWord = ['мой', 'меня', 'мне', 'наш', 'нас', 'мы', 'я'].some((word) => normalized.includes(word));

  return (
    normalized.includes('итого') ||
    normalized.includes('покажи заказ') ||
    normalized.includes('мой заказ') ||
    normalized.includes('что в заказе') ||
    (hasOrderWord && hasQueryWord) ||
    (hasOrderWord && hasPossessiveWord)
  );
}

function isRecommendationRequest(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  return [
    'помоги выбрать',
    'помочь выбрать',
    'что выбрать',
    'посоветуй',
    'посоветуйте',
    'что посоветуешь',
    'что посоветуете',
    'что взять',
    'что попробовать',
    'порекомендуй',
    'порекомендуйте'
  ].some((phrase) => normalized.includes(phrase));
}

function buildRecommendationsText() {
  const cold = [
    'Сырная доска',
    'Рулетики с сёмгой',
    'Ассорти солений'
  ].map((name) => MENU_ITEMS.find((item) => item.name === name)).filter(Boolean);

  const hot = [
    'Королевские креветки в темпуре',
    'Крылышки в соусе терияки',
    'Сырные палочки'
  ].map((name) => MENU_ITEMS.find((item) => item.name === name)).filter(Boolean);

  const coldText = cold.map((item) => `• ${item.name} — ${formatMoney(item.price)}`).join('\n');
  const hotText = hot.map((item) => `• ${item.name} — ${formatMoney(item.price)}`).join('\n');

  return (
    `Могу подсказать с выбором.\n\n` +
    `Из холодных закусок часто выбирают:\n${coldText}\n\n` +
    `Из горячих закусок могу посоветовать:\n${hotText}\n\n` +
    `Если хотите, могу ещё подобрать варианты:\n` +
    `• под компанию\n` +
    `• к пиву\n` +
    `• подешевле\n` +
    `• посытнее`
  );
}

function isAllMenuRequest(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  return (
    (normalized.includes('все') || normalized.includes('всё')) &&
    (normalized.includes('меню') || normalized.includes('позиции') || normalized.includes('блюда') || normalized.includes('закуски'))
  );
}

function buildAllMenuOrderItems() {
  return MENU_ITEMS.map((item) => buildOrderItem(item, 1));
}

function findSuggestedMenuItem(text) {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length < 4) return null;

  const queryTokens = normalized.split(' ').filter((token) => token.length >= 3);
  const ranked = MENU_ITEMS.map((item) => {
    const candidates = buildSearchCandidates(item).map(normalizeText);
    const tokenOverlap = Math.max(
      ...candidates.map((candidate) => queryTokens.filter((token) => candidate.includes(token)).length),
      0
    );
    const distance = Math.min(...candidates.map((candidate) => levenshteinDistance(normalized, candidate)));

    return { item, tokenOverlap, distance };
  }).sort((left, right) => {
    if (left.tokenOverlap !== right.tokenOverlap) return right.tokenOverlap - left.tokenOverlap;
    return left.distance - right.distance;
  });

  const best = ranked[0];
  if (!best) return null;

  if (best.tokenOverlap > 0) {
    return best.distance <= 6 ? best.item : null;
  }

  return queryTokens.length <= 1 && best.distance <= 2 ? best.item : null;
}

function extractMenuItemFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  for (const item of MENU_ITEMS) {
    const candidates = buildSearchCandidates(item).map(normalizeText);
    if (candidates.some((candidate) => normalized.includes(candidate))) {
      return item;
    }
  }

  const suggestions = MENU_ITEMS.map((item) => {
    const candidates = buildSearchCandidates(item).map(normalizeText);
    const score = Math.min(...candidates.map((candidate) => levenshteinDistance(normalized, candidate)));
    return { item, score };
  }).sort((left, right) => left.score - right.score);

  return suggestions[0] && suggestions[0].score <= 3 ? suggestions[0].item : null;
}

function upsertOrderItems(existingItems, newItems) {
  const merged = [...(existingItems || [])];

  for (const newItem of newItems) {
    const existing = merged.find((item) => item.name === newItem.name);
    if (existing) {
      existing.quantity += newItem.quantity;
      existing.lineTotal = existing.quantity * existing.price;
    } else {
      merged.push({ ...newItem });
    }
  }

  return merged;
}

function calculateOrderTotal(items) {
  return (items || []).reduce((sum, item) => sum + item.lineTotal, 0);
}

function buildOrderItem(item, quantity = 1) {
  return {
    name: item.name,
    quantity,
    price: item.price,
    lineTotal: item.price * quantity
  };
}

const QUANTITY_PATTERNS = [
  { regex: /\b(10|десять)\b/u, value: 10 },
  { regex: /\b(9|девять)\b/u, value: 9 },
  { regex: /\b(8|восемь)\b/u, value: 8 },
  { regex: /\b(7|семь)\b/u, value: 7 },
  { regex: /\b(6|шесть)\b/u, value: 6 },
  { regex: /\b(5|пять)\b/u, value: 5 },
  { regex: /\b(4|четыре)\b/u, value: 4 },
  { regex: /\b(3|три)\b/u, value: 3 },
  { regex: /\b(2|два|две)\b/u, value: 2 },
  { regex: /\b(1|один|одна|одно)\b/u, value: 1 }
];

function extractBaseName(itemName) {
  return normalizeText(itemName).split(' с ')[0].trim();
}

function extractQualifier(itemName) {
  const normalized = normalizeText(itemName);
  const parts = normalized.split(' с ');
  return parts.length > 1 ? parts.slice(1).join(' с ').trim() : '';
}

function parseQuantityWord(text) {
  const normalized = normalizeText(text);
  for (const pattern of QUANTITY_PATTERNS) {
    if (pattern.regex.test(normalized)) return pattern.value;
  }
  return null;
}

function splitNaturalSegments(text) {
  return String(text || '')
    .split(/\n|,|;|\.|(?:\s+и\s+)|(?:\s+а\s+)|(?:\s+плюс\s+)/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractQuantityNearCandidate(segment, candidate) {
  const normalizedSegment = normalizeText(segment);
  const normalizedCandidate = normalizeText(candidate);
  const index = normalizedSegment.indexOf(normalizedCandidate);

  if (index === -1) {
    return 1;
  }

  const before = normalizedSegment.slice(0, index).trim();
  const tailWords = before.split(' ').filter(Boolean).slice(-4).join(' ');
  const quantity = parseQuantityWord(tailWords) || parseQuantityWord(before);
  return quantity || 1;
}

function getSortedMenuCandidates() {
  return MENU_ITEMS.flatMap((item) =>
    buildSearchCandidates(item).map((candidate) => ({
      item,
      candidate,
      normalizedCandidate: normalizeText(candidate)
    }))
  ).sort((left, right) => right.normalizedCandidate.length - left.normalizedCandidate.length);
}

function findExplicitItemsInSegment(segment) {
  const normalizedSegment = normalizeText(segment);
  const found = [];
  const takenRanges = [];

  for (const entry of getSortedMenuCandidates()) {
    const index = normalizedSegment.indexOf(entry.normalizedCandidate);
    if (index === -1) continue;

    const start = index;
    const end = index + entry.normalizedCandidate.length;
    const overlaps = takenRanges.some((range) => !(end <= range.start || start >= range.end));
    if (overlaps) continue;

    found.push(buildOrderItem(entry.item, extractQuantityNearCandidate(segment, entry.candidate)));
    takenRanges.push({ start, end });
  }

  return found;
}

function normalizeUnknownSegment(segment) {
  return normalizeText(segment)
    .replace(/\b(нам|мне|я|мы|хочу|хотим|будет|будут|нужно|нужны|добавь|добавьте|еще|ещё|пожалуйста|какой-нибудь|какой нибудь|другой|другая|другое|один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять)\b/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseContextualVariants(text) {
  const normalized = normalizeText(text);
  const items = [];
  const unknown = [];

  const groups = new Map();
  for (const item of MENU_ITEMS) {
    const base = extractBaseName(item.name);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(item);
  }

  for (const [base, variants] of groups.entries()) {
    if (variants.length < 2 || !normalized.includes(base)) continue;

    let matchedAny = false;

    for (const variant of variants) {
      const qualifier = extractQualifier(variant.name);
      if (qualifier && normalized.includes(qualifier)) {
        items.push(buildOrderItem(variant, 1));
        matchedAny = true;
      }
    }

    if (matchedAny) {
      const requestedQuantity = parseQuantityWord(normalized);
      if (requestedQuantity && requestedQuantity > items.length) {
        unknown.push(`${base} — уточните, пожалуйста, какие именно варианты нужны`);
      }
    }
  }

  return {
    items,
    unknown,
    total: calculateOrderTotal(items)
  };
}

function isSegmentCoveredByKnownItems(segment, knownItems) {
  const normalizedSegment = normalizeText(segment);
  if (!normalizedSegment || !knownItems || knownItems.length === 0) {
    return false;
  }

  return knownItems.some((item) => {
    const base = extractBaseName(item.name);
    const qualifier = extractQualifier(item.name);

    return (
      (base && normalizedSegment.includes(base)) ||
      (qualifier && normalizedSegment.includes(qualifier))
    );
  });
}

function parseNaturalOrderText(text) {
  const rawText = String(text || '').trim();
  if (!rawText) {
    return { items: [], unknown: [], total: 0 };
  }

  const contextualParsed = parseContextualVariants(rawText);
  const collectedNames = new Set(contextualParsed.items.map((item) => item.name));
  const segments = splitNaturalSegments(rawText);

  const items = [];
  const unknown = [...contextualParsed.unknown];

  for (const item of contextualParsed.items) {
    items.push(item);
  }

  for (const segment of segments) {
    const explicitItems = findExplicitItemsInSegment(segment);
    let matched = false;
    let sawOnlyDuplicates = explicitItems.length > 0;

    for (const explicitItem of explicitItems) {
      if (collectedNames.has(explicitItem.name)) {
        continue;
      }
      items.push(explicitItem);
      collectedNames.add(explicitItem.name);
      matched = true;
      sawOnlyDuplicates = false;
    }

    if (matched || sawOnlyDuplicates) {
      continue;
    }

    const item = extractMenuItemFromText(segment) || findMenuItemByAlias(segment);

    if (item) {
      if (!collectedNames.has(item.name)) {
        items.push(buildOrderItem(item, extractQuantityNearCandidate(segment, item.name)));
        collectedNames.add(item.name);
      }
      continue;
    }

    if (isSegmentCoveredByKnownItems(segment, items)) {
      continue;
    }

    const normalizedSegment = normalizeUnknownSegment(segment);

    if (normalizedSegment.length >= 3) {
      unknown.push(segment);
    }
  }

  return {
    items,
    unknown,
    total: calculateOrderTotal(items)
  };
}

function parseOrderItems(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const items = [];
  const unknown = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)\s*[xх*]?\s+(.+)$/i);
    const quantity = match ? Number(match[1]) : 1;
    const rawName = match ? match[2].trim() : line;

    if (!Number.isInteger(quantity) || quantity < 1) {
      unknown.push(line);
      continue;
    }

    const item = findMenuItemByAlias(rawName);
    if (!item) {
      const suggestions = suggestMenuItems(rawName);
      unknown.push(suggestions.length > 0
        ? `${line} → возможно, вы имели в виду: ${suggestions.join(', ')}`
        : line);
      continue;
    }

    items.push({
      name: item.name,
      quantity,
      price: item.price,
      lineTotal: item.price * quantity
    });
  }

  return {
    items,
    unknown,
    total: items.reduce((sum, item) => sum + item.lineTotal, 0)
  };
}

function formatSuggestionsList(rawText) {
  const suggestions = suggestMenuItems(rawText);
  if (suggestions.length === 0) {
    return null;
  }

  return suggestions.join(', ');
}

function formatUnknownItemsMessage(unknownItems) {
  const lines = unknownItems.map((entry) => {
    const rawText = String(entry || '').split('→')[0].trim();
    const suggestions = formatSuggestionsList(rawText);

    if (suggestions) {
      return `• ${rawText} — такой позиции нет в меню. Могу предложить: ${suggestions}.`;
    }

    return `• ${rawText} — такой позиции нет в меню.`;
  });

  return `Не нашёл в меню некоторые позиции:\n${lines.join('\n')}`;
}

function parseDeliveryDetails(text) {
  const rawText = String(text || '').trim();
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const FIELD_LABEL_REGEX = /^(имя|телефон|адрес|подъезд|этаж|квартира|домофон|время(?: доставки)?|комментарий(?: к курьеру)?):\s*/iu;
  const cleaned = lines.map((line) => line.replace(FIELD_LABEL_REGEX, '').trim());

  if (cleaned.length >= 9) {
    const [name, phone, address, entrance, floor, apartment, intercom, deliveryTime, ...commentParts] = cleaned;
    const parsedTime = parseTime(deliveryTime);

    if (!name || name.length < 2) return { error: 'INVALID_NAME' };
    if (!isValidPhone(phone)) return { error: 'INVALID_PHONE' };
    if (!address || address.length < 5) return { error: 'INVALID_ADDRESS' };
    if (!parsedTime || !isBookingTimeAllowed(parsedTime)) return { error: 'INVALID_TIME' };

    return {
      data: {
        name,
        phone: normalizePhone(phone),
        address,
        entrance: entrance || 'нет',
        floor: floor || 'нет',
        apartment: apartment || 'нет',
        intercom: intercom || 'нет',
        deliveryTime: parsedTime.value,
        comment: commentParts.join(' ').trim() || 'нет'
      }
    };
  }

  const phoneMatch = rawText.match(/(\+?\d[\d\s()-]{8,}\d)/);
  const timeMatch = rawText.match(/(\d{1,2}:\d{2})/);
  const entranceMatch = rawText.match(/(\d+)\s*под[ъь]?езд/u);
  const floorMatch = rawText.match(/(\d+)\s*этаж/u);
  const apartmentMatch = rawText.match(/(\d+)\s*квартир/u);
  const intercomMatch = rawText.match(/домофон[:\s-]*([^,.]+)/iu);
  const commentMatch = rawText.match(/комментари[йя]\s*(?:к\s*курьеру)?[:\s-]*([^]+)$/iu);

  const parts = rawText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const name = parts[0] || '';
  const phone = phoneMatch ? phoneMatch[1].trim() : '';
  const address = parts.find((part) =>
    !part.includes(phone) &&
    !/под[ъь]?езд|этаж|квартир|домофон|время|комментари/u.test(part)
  ) || '';
  const parsedTime = parseTime(timeMatch ? timeMatch[1] : '');

  if (!name || name.length < 2) return { error: 'INVALID_NAME' };
  if (!isValidPhone(phone)) return { error: 'INVALID_PHONE' };
  if (!address || address.length < 5) return { error: 'INVALID_ADDRESS' };
  if (!parsedTime || !isBookingTimeAllowed(parsedTime)) return { error: 'INVALID_TIME' };

  return {
    data: {
      name,
      phone: normalizePhone(phone),
      address,
      entrance: entranceMatch ? entranceMatch[1] : 'нет',
      floor: floorMatch ? floorMatch[1] : 'нет',
      apartment: apartmentMatch ? apartmentMatch[1] : 'нет',
      intercom: intercomMatch ? intercomMatch[1].trim() : 'нет',
      deliveryTime: parsedTime.value,
      comment: commentMatch ? commentMatch[1].trim() : 'нет'
    }
  };
}

function formatOrderItems(items) {
  return items.map((item) => `${item.quantity} x ${item.name} — ${formatMoney(item.lineTotal)}`).join('\n');
}

function summarizeOrder(data) {
  return (
    `📋 Подтвердите заказ:\n\n` +
    `👤 Имя: ${data.name}\n` +
    `📞 Телефон: ${data.phone}\n` +
    `📍 Адрес: ${data.address}\n` +
    `🚪 Подъезд: ${data.entrance}\n` +
    `🏢 Этаж: ${data.floor}\n` +
    `🏠 Квартира: ${data.apartment}\n` +
    `🔢 Домофон: ${data.intercom}\n` +
    `🍽️ Позиции:\n${formatOrderItems(data.orderItems)}\n\n` +
    `💰 Сумма заказа: ${formatMoney(data.total)}\n` +
    `💳 Оплата: ${data.paymentMethod || 'не выбрана'}\n` +
    `⏰ Время доставки: ${data.deliveryTime}\n` +
    `💬 Комментарий: ${data.comment || 'нет'}`
  );
}

function normalizeOptionalDeliveryField(text) {
  const raw = String(text || '').trim();
  if (!raw) return 'нет';

  const normalized = normalizeText(raw);
  if (['нет', 'не', 'нету', 'не нужно', 'отсутствует'].includes(normalized)) {
    return 'нет';
  }

  return raw;
}

async function startDeliveryDetailsFlow(chatId, session) {
  nextOrderStep(session, 'delivery_name');
  await bot.sendMessage(chatId, 'Укажите, пожалуйста, имя получателя.');
}

function summarizeCurrentCart(data) {
  if (!data.orderItems || data.orderItems.length === 0) {
    return 'Пока в заказе ничего нет. Напишите, что хотите добавить.';
  }

  const total = calculateOrderTotal(data.orderItems);
  return (
    `Сейчас у вас в заказе:\n${formatOrderItems(data.orderItems)}\n\n` +
    `Итого: ${formatMoney(total)}. Если хотите добавить что-то ещё, просто напишите следующую позицию. Когда закончите, отправьте "всё".`
  );
}

function summarizeCurrentPreorder(data) {
  if (!data.preorderItems || data.preorderItems.length === 0) {
    return 'Пока в предзаказе ничего нет. Напишите, что хотите добавить, или отправьте "нет".';
  }

  const total = calculateOrderTotal(data.preorderItems);
  return (
    `Сейчас у вас в предзаказе:\n${formatOrderItems(data.preorderItems)}\n\n` +
    `Итого: ${formatMoney(total)}. Если хотите добавить что-то ещё, просто напишите следующую позицию. Когда закончите, отправьте "всё".`
  );
}

function parseFlexibleOrderInput(text) {
  if (isAllMenuRequest(text)) {
    const items = buildAllMenuOrderItems();
    return {
      items,
      unknown: [],
      total: calculateOrderTotal(items)
    };
  }

  let parsed = parseOrderItems(text);

  if (parsed.items.length === 0 || (!/\n/.test(text) && parsed.items.length <= 1)) {
    const naturalParsed = parseNaturalOrderText(text);
    if (naturalParsed.items.length > 0 || naturalParsed.unknown.length > 0) {
      parsed = naturalParsed;
    }
  }

  return parsed;
}

function getSelectionKeyboard(session, mode = 'order') {
  const sectionKey = mode === 'preorder' ? session?.data?.preorderMenuSection : session?.data?.orderMenuSection;

  if (mode === 'preorder') {
    if (sectionKey === 'cold') return coldPreorderKeyboard;
    if (sectionKey === 'hot') return hotPreorderKeyboard;
    return preorderCategoryKeyboard;
  }

  if (sectionKey === 'cold') return coldOrderKeyboard;
  if (sectionKey === 'hot') return hotOrderKeyboard;
  return orderCategoryKeyboard;
}

async function openMenuSection(chatId, session, mode, section) {
  const isPreorder = mode === 'preorder';
  const title = section === 'cold' ? 'Холодные закуски' : 'Горячие закуски';

  if (isPreorder) {
    session.data.preorderMenuSection = section;
  } else {
    session.data.orderMenuSection = section;
  }

  await bot.sendMessage(
    chatId,
    `Выберите позицию из раздела "${title}" или продолжайте писать текстом.`,
    getSelectionKeyboard(session, mode)
  );
}

function detectSelectionIntent(text, session, mode = 'order') {
  const data = session.data || {};
  const isPreorder = mode === 'preorder';
  const normalized = normalizeText(text);

  if (isDoneOrderingText(text)) {
    return { type: 'finish' };
  }

  if (data.pendingSuggestedItem && isConfirmationText(text)) {
    return { type: 'confirm_suggested_item', itemName: data.pendingSuggestedItem };
  }

  if (data.pendingSuggestedItem && isRejectionText(text)) {
    return { type: 'reject_suggested_item' };
  }

  if (text === COLD_APPETIZERS_TEXT) {
    return { type: 'open_section', section: 'cold' };
  }

  if (text === HOT_APPETIZERS_TEXT) {
    return { type: 'open_section', section: 'hot' };
  }

  if (text === MENU_SECTIONS_TEXT) {
    return { type: 'show_sections' };
  }

  if (isOrderSummaryQuestion(text)) {
    return { type: 'show_summary' };
  }

  if (isRecommendationRequest(text)) {
    return { type: 'recommend' };
  }

  if (isPreorder && (normalized === 'нет' || text === SKIP_PREORDER_TEXT) && (!data.preorderItems || data.preorderItems.length === 0)) {
    return { type: 'skip_preorder' };
  }

  if (!looksLikeOrderInput(text)) {
    if (isRudeOrNonsenseText(text)) {
      return { type: 'nonsense' };
    }

    const suggestedItem = findSuggestedMenuItem(text);
    if (suggestedItem) {
      return { type: 'suggest_item', item: suggestedItem };
    }
    return { type: 'menu_question' };
  }

  const parsed = parseFlexibleOrderInput(text);
  if (parsed.items.length === 0) {
    return { type: 'parse_error', parsed };
  }

  return { type: 'add_items', parsed };
}

async function handleSelectionIntent(chatId, text, session, mode = 'order') {
  const data = session.data;
  const isPreorder = mode === 'preorder';
  const keyboard = getSelectionKeyboard(session, mode);
  const itemsKey = isPreorder ? 'preorderItems' : 'orderItems';
  const totalKey = isPreorder ? 'preorderTotal' : 'total';
  const emptyMessage = isPreorder
    ? 'Пока в предзаказе ничего нет. Напишите, что хотите добавить, или отправьте "нет".'
    : 'Пока у вас нет ни одной позиции в заказе. Напишите, что хотите заказать.';
  const recommendTail = isPreorder
    ? 'Можете просто написать понравившиеся позиции, и я добавлю их в предзаказ.'
    : 'Можете просто написать понравившиеся позиции, и я добавлю их в заказ.';
  const summaryBuilder = isPreorder ? summarizeCurrentPreorder : summarizeCurrentCart;

  const intent = detectSelectionIntent(text, session, mode);

  switch (intent.type) {
    case 'confirm_suggested_item': {
      const item = findMenuItemByAlias(intent.itemName);
      data.pendingSuggestedItem = null;

      if (!item) {
        const reply = 'Не получилось подтвердить позицию. Напишите название блюда ещё раз.';
        await bot.sendMessage(chatId, reply, keyboard);
        pushHistoryEntry(session, 'assistant', reply);
        return;
      }

      const addedItems = [buildOrderItem(item, 1)];
      data[itemsKey] = upsertOrderItems(data[itemsKey], addedItems);
      data[totalKey] = calculateOrderTotal(data[itemsKey]);
      const reply = isPreorder
        ? `Добавил в предзаказ:\n${formatOrderItems(addedItems)}\n\nСейчас в предзаказе на ${formatMoney(data[totalKey])}. Если хотите что-то ещё, напишите следующую позицию. Когда закончите, отправьте "всё".`
        : `Добавил в заказ:\n${formatOrderItems(addedItems)}\n\nСейчас в заказе на ${formatMoney(data[totalKey])}. Если хотите что-то ещё, напишите следующую позицию. Когда закончите, отправьте "всё".`;
      await bot.sendMessage(chatId, reply, keyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    case 'reject_suggested_item': {
      data.pendingSuggestedItem = null;
      const reply = 'Хорошо, не добавляю. Напишите, пожалуйста, нужное блюдо ещё раз.';
      await bot.sendMessage(chatId, reply, keyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    case 'open_section':
      await openMenuSection(chatId, session, mode, intent.section);
      return;

    case 'show_sections': {
      if (isPreorder) {
        data.preorderMenuSection = null;
        await bot.sendMessage(chatId, 'Выберите раздел для предзаказа или продолжайте писать блюда текстом.', preorderCategoryKeyboard);
      } else {
        data.orderMenuSection = null;
        await bot.sendMessage(chatId, 'Выберите раздел меню или продолжайте писать блюда текстом.', orderCategoryKeyboard);
      }
      return;
    }

    case 'show_summary': {
      data[totalKey] = calculateOrderTotal(data[itemsKey]);
      const reply = summaryBuilder(data);
      await bot.sendMessage(chatId, reply, keyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    case 'recommend': {
      const reply = `${buildRecommendationsText()}\n\n${recommendTail}`;
      await bot.sendMessage(chatId, reply, keyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    case 'finish': {
      const selectedItems = data[itemsKey] || [];
      if (!isPreorder && selectedItems.length === 0) {
        const reply = emptyMessage;
        await bot.sendMessage(chatId, reply, keyboard);
        pushHistoryEntry(session, 'assistant', reply);
        return;
      }

      data[totalKey] = calculateOrderTotal(selectedItems);

      if (isPreorder) {
        nextBookingStep(session, 'confirm', true);
        const reply = summarizeBooking(data);
        await bot.sendMessage(chatId, reply, confirmBookingKeyboard);
        pushHistoryEntry(session, 'assistant', reply);
        return;
      }

      if (data.total < MIN_ORDER_TOTAL) {
        const reply = `Сейчас в заказе ${formatMoney(data.total)}. Минимальная сумма доставки — ${formatMoney(MIN_ORDER_TOTAL)}.\nДобавьте, пожалуйста, ещё позиции или отмените заказ.`;
        await bot.sendMessage(chatId, reply, keyboard);
        pushHistoryEntry(session, 'assistant', reply);
        return;
      }

      const reply = `Ваш заказ:\n${formatOrderItems(data.orderItems)}\n\nИтого: ${formatMoney(data.total)}.\n\nТеперь оформим доставку по шагам, чтобы ничего не потерялось.`;
      await bot.sendMessage(chatId, reply);
      pushHistoryEntry(session, 'assistant', reply);
      await startDeliveryDetailsFlow(chatId, session);
      return;
    }

    case 'skip_preorder': {
      data.preorderItems = [];
      data.preorderTotal = 0;
      nextBookingStep(session, 'confirm', true);
      const reply = summarizeBooking(data);
      await bot.sendMessage(chatId, reply, confirmBookingKeyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    case 'suggest_item': {
      data.pendingSuggestedItem = intent.item.name;
      const reply = `Вы, наверное, имеете в виду ${intent.item.name}. Он стоит ${formatMoney(intent.item.price)}. Напишите "да", и я добавлю его ${isPreorder ? 'в предзаказ' : 'в заказ'}, или отправьте другое блюдо.`;
      await bot.sendMessage(chatId, reply, keyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    case 'menu_question': {
      const answer = await answerMenuQuestion(text, session);
      const reply = isPreorder
        ? `${answer}\n\nЕсли хотите добавить предзаказ, просто напишите нужные блюда. Когда закончите, отправьте "всё". Если предзаказ не нужен, напишите "нет".`
        : `${answer}\n\nКогда определитесь, просто напишите нужные блюда. Когда закончите, отправьте "всё".`;
      await bot.sendMessage(chatId, reply, keyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    case 'nonsense': {
      await bot.sendMessage(chatId, NONSENSE_REPLY, keyboard);
      pushHistoryEntry(session, 'assistant', NONSENSE_REPLY);
      return;
    }

    case 'parse_error': {
      const parsed = intent.parsed;
      if (parsed.unknown.length > 0) {
        const reply = isPreorder
          ? `${formatUnknownItemsMessage(parsed.unknown)}\n\nНапишите другие позиции, и я помогу собрать предзаказ.`
          : `${formatUnknownItemsMessage(parsed.unknown)}\n\nНапишите другие позиции, и я с радостью помогу собрать заказ.`;
        await bot.sendMessage(chatId, reply, keyboard);
        pushHistoryEntry(session, 'assistant', reply);
        return;
      }

      const reply = isPreorder
        ? 'Не получилось понять, какие позиции добавить в предзаказ. Напишите блюда так, как вам удобно.'
        : 'Не получилось понять, какую позицию вы хотите добавить. Напишите название блюда так, как вам удобно.';
      await bot.sendMessage(chatId, reply, keyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    case 'add_items': {
      const parsed = intent.parsed;
      data.pendingSuggestedItem = null;
      data[itemsKey] = upsertOrderItems(data[itemsKey], parsed.items);
      data[totalKey] = calculateOrderTotal(data[itemsKey]);
      const unknownBlock = parsed.unknown.length > 0 ? `\n\n${formatUnknownItemsMessage(parsed.unknown)}` : '';
      const reply = isAllMenuRequest(text)
        ? `Добавил ${isPreorder ? 'в предзаказ' : 'в заказ'} все позиции из меню по 1 порции.\n\n${formatOrderItems(parsed.items)}\n\nСейчас ${isPreorder ? 'в предзаказе' : 'в заказе'} на ${formatMoney(data[totalKey])}. Если хотите что-то ещё, напишите следующую позицию. Когда закончите, отправьте "всё".${unknownBlock}`
        : `Добавил ${isPreorder ? 'в предзаказ' : 'в заказ'}:\n${formatOrderItems(parsed.items)}\n\nСейчас ${isPreorder ? 'в предзаказе' : 'в заказе'} на ${formatMoney(data[totalKey])}. Если хотите что-то ещё, напишите следующую позицию. Когда закончите, отправьте "всё".${unknownBlock}`;
      await bot.sendMessage(chatId, reply, keyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    default:
      return;
  }
}

function summarizeBooking(data) {
  const preorder = data.preorderItems && data.preorderItems.length > 0
    ? `\n🍽️ Предзаказ:\n${formatOrderItems(data.preorderItems)}\n\n💰 Предзаказ на сумму: ${formatMoney(data.preorderTotal)}`
    : '';

  return (
    `📋 Подтвердите бронь:\n\n` +
    `👤 Имя: ${data.name}\n` +
    `📞 Телефон: ${data.phone}\n` +
    `📅 Дата: ${data.date}\n` +
    `⏰ Время: ${data.time}\n` +
    `👥 Гостей: ${data.guests}\n` +
    `🪑 Столик: №${data.tableNum}${preorder}`
  );
}

function getSuitableTables(guests) {
  return TABLES.filter((table) => table.seats >= Number(guests));
}

async function getBusyTableIds(date, time) {
  const { data, error } = await supabase
    .from('bookings_cafe')
    .select('table_num')
    .eq('type', 'booking')
    .eq('date', date)
    .eq('time', time);

  if (error) throw new Error(`Failed to load busy tables: ${error.message}`);
  return new Set((data || []).map((row) => String(row.table_num)));
}

async function chooseAvailableTable(guests, date, time) {
  const busy = await getBusyTableIds(date, time);
  const candidate = getSuitableTables(guests).find((table) => !busy.has(String(table.id)));

  if (!candidate) return null;
  return candidate.id;
}

function isMissingColumnError(error, columnName) {
  if (!error || !columnName) return false;
  const message = `${error.message || ''} ${error.details || ''}`;
  return error.code === 'PGRST204' || new RegExp(columnName, 'i').test(message);
}

async function saveOrder(data, meta = {}) {
  const commentWithPayment = [
    data.comment || 'нет',
    data.paymentMethod ? `Оплата: ${data.paymentMethod}` : null
  ].filter(Boolean).join(' | ');

  const basePayload = {
    type: 'order',
    client_name: data.name,
    phone: data.phone,
    delivery_address: data.address,
    entrance: data.entrance,
    floor: data.floor,
    apartment: data.apartment,
    intercom: data.intercom,
    order_items: data.orderItems.map((item) => `${item.quantity} x ${item.name}`).join(', '),
    payment_method: data.paymentMethod || 'не выбрана',
    time: data.deliveryTime,
    comment: commentWithPayment
  };

  const extendedPayload = {
    ...basePayload,
    order_code: meta.orderCode || null,
    status: meta.status || 'confirmed',
    status_comment: meta.statusComment || null,
    eta_minutes: meta.etaMinutes ?? null,
    customer_chat_id: meta.customerChatId ?? null
  };

  let response = await supabase
    .from('bookings_cafe')
    .insert(extendedPayload)
    .select('id')
    .single();

  if (!response.error) {
    return { id: response.data?.id || null };
  }

  const missingExtendedColumn = ['order_code', 'status', 'status_comment', 'eta_minutes', 'customer_chat_id']
    .some((column) => isMissingColumnError(response.error, column));

  let fallbackPayload = missingExtendedColumn ? { ...basePayload } : { ...extendedPayload };

  if (isMissingColumnError(response.error, 'payment_method')) {
    delete fallbackPayload.payment_method;
  }

  response = await supabase
    .from('bookings_cafe')
    .insert(fallbackPayload)
    .select('id')
    .single();

  if (response.error) {
    throw new Error(`Failed to save order: ${response.error.message}`);
  }

  return { id: response.data?.id || null };
}

async function saveBooking(data) {
  const tableAvailable = await chooseAvailableTable(data.guests, data.date, data.time);
  if (String(tableAvailable) !== String(data.tableNum)) {
    throw new Error('TABLE_ALREADY_TAKEN');
  }

  const payload = {
    type: 'booking',
    client_name: data.name,
    phone: data.phone,
    table_num: data.tableNum,
    date: data.date,
    time: data.time,
    guests: data.guests
  };

  const { error } = await supabase.from('bookings_cafe').insert(payload);
  if (error) throw new Error(`Failed to save booking: ${error.message}`);
}

async function updateOrderStatusInDatabase(order) {
  if (!order?.databaseId) return;

  const updatePayload = {
    status: order.status,
    status_comment: order.statusComment || null,
    eta_minutes: order.etaMinutes ?? null
  };

  const { error } = await supabase
    .from('bookings_cafe')
    .update(updatePayload)
    .eq('id', order.databaseId);

  if (error && !['status', 'status_comment', 'eta_minutes'].some((column) => isMissingColumnError(error, column))) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }
}

async function applyOrderStatus(orderCode, status, options = {}) {
  const order = ordersByCode.get(orderCode);
  if (!order) return null;

  order.status = status;
  order.statusComment = options.comment || null;
  if (typeof options.etaMinutes === 'number') {
    order.etaMinutes = options.etaMinutes;
  } else if (status !== 'courier_assigned') {
    order.etaMinutes = null;
  }

  order.history = order.history || [];
  order.history.push(createOrderHistoryEntry(status, options.comment || (order.etaMinutes ? `Осталось около ${order.etaMinutes} мин.` : '')));

  await updateOrderStatusInDatabase(order);
  rememberOrder(order);

  const etaText = order.etaMinutes ? ` Ориентировочно осталось ${order.etaMinutes} минут.` : '';
  await bot.sendMessage(
    order.chatId,
    `Обновление по заказу №${order.orderCode}: сейчас он ${getOrderStatusLabel(order.status)}.${etaText}`,
    mainKeyboard
  );

  return order;
}

async function notifyManagers(text, options = {}) {
  const targets = [...new Set([MANAGER_ID].filter(Boolean))];
  await Promise.allSettled(targets.map((id) => bot.sendMessage(id, text, options)));
}

async function finalizeOrder(chatId, session, paymentMethod) {
  session.data.paymentMethod = paymentMethod;

  const orderCode = generateOrderCode();
  const order = {
    orderCode,
    chatId,
    name: session.data.name,
    phone: session.data.phone,
    address: session.data.address,
    entrance: session.data.entrance,
    floor: session.data.floor,
    apartment: session.data.apartment,
    intercom: session.data.intercom,
    orderItems: session.data.orderItems,
    total: session.data.total,
    paymentMethod: session.data.paymentMethod,
    deliveryTime: session.data.deliveryTime,
    comment: session.data.comment || 'нет',
    status: 'confirmed',
    statusComment: 'Заказ принят',
    etaMinutes: null,
    history: [createOrderHistoryEntry('confirmed', 'Заказ принят')]
  };

  const saveResult = await saveOrder(session.data, {
    orderCode,
    status: order.status,
    statusComment: order.statusComment,
    customerChatId: chatId
  });

  order.databaseId = saveResult?.id || null;
  rememberOrder(order);

  await notifyManagers(
    buildManagerOrderMessage(order),
    buildManagerOrderStatusKeyboard(order.orderCode)
  );

  await goHome(
    chatId,
    `✅ Заказ подтверждён.\nНомер заказа: ${order.orderCode}\nСпособ оплаты: ${paymentMethod}.\nДля проверки статуса используйте кнопку "${TRACK_ORDER_TEXT}".`
  );
}

function summarizeSessionForManager(session) {
  if (!session) return 'Контекст не найден.';

  const lines = [
    `Текущий сценарий: ${session.flow || 'idle'}`,
    `Шаг: ${session.step || 'нет'}`
  ];

  if (session.data?.name) lines.push(`Имя клиента: ${session.data.name}`);
  if (session.data?.phone) lines.push(`Телефон клиента: ${session.data.phone}`);
  if (session.data?.date) lines.push(`Дата: ${session.data.date}`);
  if (session.data?.time) lines.push(`Время: ${session.data.time}`);
  if (session.data?.guests) lines.push(`Гостей: ${session.data.guests}`);
  if (session.data?.address) lines.push(`Адрес: ${session.data.address}`);
  if (session.data?.orderItems?.length) {
    lines.push(`Заказ: ${session.data.orderItems.map((item) => `${item.quantity} x ${item.name}`).join(', ')}`);
  }
  if (session.data?.preorderItems?.length) {
    lines.push(`Предзаказ: ${session.data.preorderItems.map((item) => `${item.quantity} x ${item.name}`).join(', ')}`);
  }

  return lines.join('\n');
}

async function contactManager(chatId, session, user) {
  const username = user?.username ? `@${user.username}` : 'не указан';
  const managerMessage =
    `🆘 Клиент просит связаться с менеджером\n\n` +
    `👤 Telegram: ${user?.first_name || 'Гость'}${user?.last_name ? ` ${user.last_name}` : ''}\n` +
    `🆔 Chat ID: ${chatId}\n` +
    `🔗 Username: ${username}\n\n` +
    `${summarizeSessionForManager(session)}`;

  await notifyManagers(managerMessage);
  await bot.sendMessage(
    chatId,
    'Передал ваш запрос менеджеру. Он увидит ваш контакт и текущий контекст обращения и свяжется с вами при первой возможности.',
    mainKeyboard
  );
}

async function safeSendMenu(chatId) {
  if (!MENU_PHOTO_ID) {
    await bot.sendMessage(chatId, `Меню:\n\n${MENU}`, cancelKeyboard);
    return;
  }

  try {
    await bot.sendPhoto(chatId, MENU_PHOTO_ID, { caption: 'Наше меню 🍽️' });
  } catch (error) {
    console.error('Failed to send menu photo:', error);
    await bot.sendMessage(chatId, `Не получилось отправить фото меню, поэтому отправляю текстом.\n\n${MENU}`, cancelKeyboard);
  }
}

async function answerMenuQuestion(question, session = null) {
  const normalizedQuestion = normalizeText(question);
  const now = getCurrentDateTimeParts();

  if (normalizedQuestion.includes('сегодня') || normalizedQuestion.includes('сейчас') || normalizedQuestion.includes('время') || normalizedQuestion.includes('число')) {
    return `Сейчас по Алматы ${now.time}, сегодня ${now.date}. Заказы принимаем с 08:00 до 02:00.`;
  }

  if (
    normalizedQuestion.includes('работаете') ||
    normalizedQuestion.includes('принимаете заказ') ||
    normalizedQuestion.includes('можно заказать') ||
    normalizedQuestion.includes('доставка')
  ) {
    if (isWorkingHours()) {
      return `Сейчас по Алматы ${now.time}, сегодня ${now.date}. Мы принимаем заказы до 02:00.`;
    }

    return `Сейчас по Алматы ${now.time}, сегодня ${now.date}. С 02:00 до 08:00 мы временно не принимаем заказы. Будем рады помочь после 08:00.`;
  }

  const mentionedItem = findMenuItemByAlias(question);
  if (mentionedItem) {
    return `${mentionedItem.name} есть в меню. Цена: ${formatMoney(mentionedItem.price)}. Если хотите, могу сразу помочь оформить заказ или бронь.`;
  }

  const suggestions = suggestMenuItems(question);

  if (!openai) {
    if (suggestions.length > 0) {
      return `Такого блюда в меню сейчас нет. Могу предложить похожие позиции: ${suggestions.join(', ')}.`;
    }

    return 'Не нашёл такого блюда в меню. Могу подсказать позиции из нашего меню или помочь оформить заказ и бронь.';
  }

  const completion = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              `Ты администратор ресторана. Отвечай только на русском, коротко и дружелюбно. ` +
              `Сегодня ${now.date}, текущее время по Алматы ${now.time}. Заказы на доставку принимаются только с 08:00 до 02:00 по времени Алматы. ` +
              `Не придумывай блюда вне меню. Если блюда нет, вежливо скажи об этом и предложи 2-4 похожие позиции из списка. ` +
              `Если пользователь пишет с опечаткой или неполным названием, старайся сопоставить это с меню. ` +
              `Никогда не говори, что блюдо уже добавлено в заказ, если тебя об этом прямо не попросили подтвердить уже выполненное действие. ` +
              `Если сейчас нерабочее время для доставки, скажи об этом уважительно.\n\nМеню:\n${MENU}`
          }
        ]
      },
      {
        role: 'user',
        content: [{
          type: 'input_text',
          text: [
            session?.history?.length
              ? `Контекст последних сообщений:\n${session.history.map((entry) => `${entry.role === 'assistant' ? 'Бот' : 'Клиент'}: ${entry.text}`).join('\n')}\n`
              : '',
            `Текущее сообщение клиента: ${question}`
          ].filter(Boolean).join('\n\n')
        }]
      }
    ]
  });

  return completion.output_text || 'Не удалось подготовить ответ. Попробуйте сформулировать вопрос чуть иначе.';
}

async function goHome(chatId, text = 'Вы в главном меню 👋') {
  resetSession(chatId);
  await bot.sendMessage(chatId, text, mainKeyboard);
}

function nextOrderStep(session, step) {
  session.flow = 'order';
  session.step = step;
}

function nextBookingStep(session, step, withFood = false) {
  session.flow = withFood ? 'booking_with_food' : 'booking_only';
  session.step = step;
}

async function startOrder(chatId) {
  if (!isWorkingHours()) {
    const now = getCurrentDateTimeParts();
    await bot.sendMessage(
      chatId,
      `Сейчас по Алматы ${now.time}, сегодня ${now.date}. С 02:00 до 08:00 мы временно не принимаем заказы. Будем рады помочь после 08:00.`,
      mainKeyboard
    );
    return;
  }

  const session = getSession(chatId);
  session.data = {
    orderItems: [],
    total: 0,
    orderMenuSection: null
  };
  nextOrderStep(session, 'items');

  await safeSendMenu(chatId);
  await bot.sendMessage(
    chatId,
    'Напишите, что хотите заказать. Можно писать свободно или выбрать раздел кнопками ниже. Когда закончите, нажмите "✅ Завершить выбор" или напишите "всё".',
    orderCategoryKeyboard
  );
}

async function startBookingChoice(chatId) {
  const session = getSession(chatId);
  session.data = {};
  session.flow = 'booking_choice';
  session.step = 'choice';
  await bot.sendMessage(chatId, 'Как вы хотите забронировать стол?', bookingKeyboard);
}

async function startBooking(chatId, withFood) {
  const session = getSession(chatId);
  session.data = { withFood };
  nextBookingStep(session, 'name', withFood);

  if (withFood) {
    await safeSendMenu(chatId);
  }

  await bot.sendMessage(chatId, 'Напишите, пожалуйста, ваше имя.', cancelKeyboard);
}

async function handleOrderFlow(chatId, text, session) {
  const data = session.data;
  pushHistoryEntry(session, 'user', text);

  switch (session.step) {
    case 'items':
      await handleSelectionIntent(chatId, text, session, 'order');
      return;

    case 'delivery_name':
      if (!isValidName(text)) {
        await bot.sendMessage(chatId, 'Введите корректное имя');
        return;
      }
      data.name = text.trim();
      nextOrderStep(session, 'delivery_phone');
      await bot.sendMessage(chatId, 'Укажите номер телефона получателя.');
      return;

    case 'delivery_phone':
      if (!isValidPhone(text)) {
        await bot.sendMessage(chatId, 'Введите корректный номер телефона');
        return;
      }
      data.phone = normalizePhone(text);
      nextOrderStep(session, 'delivery_address');
      await bot.sendMessage(chatId, 'Укажите адрес доставки.');
      return;

    case 'delivery_address':
      if (text.trim().length < 5) {
        await bot.sendMessage(chatId, 'Адрес выглядит слишком коротким. Пожалуйста, укажите адрес подробнее.');
        return;
      }
      data.address = text.trim();
      nextOrderStep(session, 'delivery_entrance');
      await bot.sendMessage(chatId, 'Укажите подъезд. Если его нет, напишите "нет".');
      return;

    case 'delivery_entrance':
      data.entrance = normalizeOptionalDeliveryField(text);
      nextOrderStep(session, 'delivery_floor');
      await bot.sendMessage(chatId, 'Укажите этаж. Если его нет, напишите "нет".');
      return;

    case 'delivery_floor':
      data.floor = normalizeOptionalDeliveryField(text);
      nextOrderStep(session, 'delivery_apartment');
      await bot.sendMessage(chatId, 'Укажите квартиру. Если её нет, напишите "нет".');
      return;

    case 'delivery_apartment':
      data.apartment = normalizeOptionalDeliveryField(text);
      nextOrderStep(session, 'delivery_intercom');
      await bot.sendMessage(chatId, 'Укажите домофон. Если его нет, напишите "нет".');
      return;

    case 'delivery_intercom':
      data.intercom = normalizeOptionalDeliveryField(text);
      nextOrderStep(session, 'delivery_time');
      await bot.sendMessage(chatId, 'Когда привезти заказ? Можно написать, например: "15:00", "к 3 дня", "8 вечера" или "через час".');
      return;

    case 'delivery_time': {
      const parsedTime = parseTime(text);
      if (!parsedTime || !isBookingTimeAllowed(parsedTime)) {
        await bot.sendMessage(chatId, 'Не удалось распознать подходящее время доставки. Мы принимаем заказы с 08:00 до 02:00. Можно написать, например: "15:00", "к 3 дня", "8 вечера" или "через час".');
        return;
      }
      data.deliveryTime = parsedTime.value;
      nextOrderStep(session, 'delivery_comment');
      await bot.sendMessage(chatId, 'Есть комментарий для курьера? Если нет, напишите "нет".');
      return;
    }

    case 'delivery_comment':
      data.comment = normalizeOptionalDeliveryField(text);
      nextOrderStep(session, 'confirm');
      await bot.sendMessage(chatId, `${summarizeOrder(data)}\n\nЕсли всё верно, подтвердите заказ.`, confirmOrderKeyboard);
      return;
    

    case 'payment':
      await bot.sendMessage(chatId, 'Выберите, пожалуйста, способ оплаты кнопками ниже.', paymentKeyboard);
      return;

    case 'confirm':
      await bot.sendMessage(chatId, `Сумма вашего заказа: ${formatMoney(data.total)}.\nИспользуйте кнопки ниже, чтобы подтвердить заказ, изменить его или вернуться в главное меню.`, confirmOrderKeyboard);
      return;

    default:
      await goHome(chatId);
  }
}

async function handleBookingFlow(chatId, text, session) {
  const data = session.data;
  const withFood = session.flow === 'booking_with_food';

  switch (session.step) {
    case 'name':
      if (!isValidName(text)) {
        await bot.sendMessage(chatId, 'Введите корректное имя');
        return;
      }
      data.name = text.trim();
      nextBookingStep(session, 'phone', withFood);
      await bot.sendMessage(chatId, 'Укажите номер телефона.');
      return;

    case 'phone':
      if (!isValidPhone(text)) {
        await bot.sendMessage(chatId, 'Введите корректный номер телефона');
        return;
      }
      data.phone = normalizePhone(text);
      nextBookingStep(session, 'date_time', withFood);
      await bot.sendMessage(chatId, 'Когда и на какое время вы хотите забронировать стол? Например: "сегодня в 15:30", "завтра к 3 дня", "7 апреля в 8 вечера".');
      return;

    case 'date_time': {
      const { parsedDate, parsedTime, hasDate, hasTime } = parseBookingDateTime(text);
      const savedDate = data.pendingBookingDate ? parseDate(data.pendingBookingDate) : null;
      const savedTime = data.pendingBookingTime ? parseTime(data.pendingBookingTime) : null;
      const finalDate = parsedDate || savedDate;
      const finalTime = parsedTime || savedTime;

      if (parsedDate) {
        data.pendingBookingDate = parsedDate.value;
      }

      if (parsedTime) {
        data.pendingBookingTime = parsedTime.value;
      }

      if (!hasDate && !hasTime) {
        if (savedDate && !savedTime) {
          await bot.sendMessage(chatId, `Дату уже запомнил: ${savedDate.value}. Теперь напишите только время, например: "15:30", "к 4 дня" или "8 вечера".`);
          return;
        }

        if (!savedDate && savedTime) {
          await bot.sendMessage(chatId, `Время уже запомнил: ${savedTime.value}. Теперь напишите только дату, например: "сегодня", "завтра", "8 апреля" или "в пятницу".`);
          return;
        }

        await bot.sendMessage(chatId, 'Не удалось распознать ни дату, ни время. Напишите одним сообщением, например: "сегодня в 15:30", "завтра к 3 дня" или "в пятницу в 8 вечера".');
        return;
      }

      if (!finalDate) {
        await bot.sendMessage(chatId, 'Не удалось распознать дату. Напишите только дату, например: "сегодня", "завтра", "8 апреля" или "в пятницу".');
        return;
      }

      if (!finalTime) {
        await bot.sendMessage(chatId, `Дату запомнил: ${finalDate.value}. Теперь напишите только время, например: "15:30", "к 4 дня" или "8 вечера".`);
        return;
      }

      if (!isBookingTimeAllowed(finalTime)) {
        await bot.sendMessage(chatId, 'Не удалось распознать подходящее время. Бронь принимается с 08:00 до 02:00. Напишите только время, например: "15:30", "к 4 дня" или "8 вечера".');
        return;
      }

      data.date = finalDate.value;
      data.time = finalTime.value;
      data.pendingBookingDate = null;
      data.pendingBookingTime = null;
      nextBookingStep(session, 'guests', withFood);
      await bot.sendMessage(chatId, 'Укажите количество гостей.');
      return;
    }

    case 'guests':
      if (!isPositiveInteger(text)) {
        await bot.sendMessage(chatId, 'Количество гостей должно быть целым числом.');
        return;
      }

      data.guests = Number(text.trim());
      if (data.guests > Math.max(...TABLES.map((table) => table.seats))) {
        await bot.sendMessage(chatId, 'Для такого количества гостей у нас нет подходящего столика. Пожалуйста, свяжитесь с администратором.');
        return;
      }

      data.tableNum = await chooseAvailableTable(data.guests, data.date, data.time);
      if (!data.tableNum) {
        await bot.sendMessage(chatId, 'На это время нет свободного столика для такого количества гостей. Попробуйте другую дату или время.');
        return;
      }

      if (withFood) {
        data.preorderItems = [];
        data.preorderTotal = 0;
        data.preorderMenuSection = null;
        nextBookingStep(session, 'preorder', true);
        await bot.sendMessage(
          chatId,
          `Подобрал столик №${data.tableNum}. Теперь можете оформить предзаказ так же, как обычный заказ: пишите позиции свободно или выбирайте разделы кнопками ниже. Когда закончите, нажмите "✅ Завершить выбор" или напишите "всё". Если предзаказ не нужен, нажмите "🚫 Без предзаказа" или напишите "нет".`,
          preorderCategoryKeyboard
        );
      } else {
        nextBookingStep(session, 'confirm', false);
        await bot.sendMessage(chatId, summarizeBooking(data), confirmBookingKeyboard);
      }
      return;

    case 'preorder':
      await handleSelectionIntent(chatId, text, session, 'preorder');
      return;

    case 'confirm':
      await bot.sendMessage(chatId, 'Используйте кнопки ниже, чтобы подтвердить или изменить бронь.', confirmBookingKeyboard);
      return;

    default:
      await goHome(chatId);
  }
}

bot.onText(/\/start/, async (msg) => {
  const name = msg.from.first_name || 'Гость';
  const now = getCurrentDateTimeParts();
  await goHome(
    msg.chat.id,
    `Привет, ${name}! 👋\n\nДобро пожаловать в наш ресторан.\nСейчас по Алматы ${now.time}, сегодня ${now.date}.\nЧем могу помочь?`
  );
});

bot.on('callback_query', async (query) => {
  const data = String(query.data || '');
  const managerChatId = query.message?.chat?.id;

  try {
    if (!data.startsWith('order_status:')) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (managerChatId !== MANAGER_ID) {
      await bot.answerCallbackQuery(query.id, { text: 'Эта кнопка доступна только менеджеру.' });
      return;
    }

    const [, orderCode, action] = data.split(':');
    const order = ordersByCode.get(orderCode);

    if (!order) {
      await bot.answerCallbackQuery(query.id, { text: 'Заказ не найден.' });
      return;
    }

    if (action === 'cooking') {
      await applyOrderStatus(orderCode, 'cooking', { comment: 'Заказ готовится' });
      await bot.answerCallbackQuery(query.id, { text: `Заказ №${orderCode} переведён в статус "Готовится".` });
      await bot.sendMessage(managerChatId, `Статус заказа №${orderCode} обновлён: готовится.`);
      return;
    }

    if (action === 'courier') {
      pendingEtaByManager.set(managerChatId, { orderCode });
      await bot.answerCallbackQuery(query.id, { text: 'Введите, сколько минут осталось до клиента.' });
      await bot.sendMessage(managerChatId, `Заказ №${orderCode} передан курьеру. Напишите, пожалуйста, сколько минут осталось до клиента.`);
      return;
    }

    if (action === 'delivered') {
      await applyOrderStatus(orderCode, 'delivered', { comment: 'Заказ доставлен' });
      await bot.answerCallbackQuery(query.id, { text: `Заказ №${orderCode} отмечен как доставленный.` });
      await bot.sendMessage(managerChatId, `Статус заказа №${orderCode} обновлён: доставлен.`);
      return;
    }

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error('Callback query error:', error);
    await bot.answerCallbackQuery(query.id, { text: 'Не удалось обработать действие.' });
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = String(msg.text || '').trim();
  if (!text || text === '/start') return;

  const session = getSession(chatId);

  try {
    if (chatId === MANAGER_ID && pendingEtaByManager.has(chatId)) {
      const pending = pendingEtaByManager.get(chatId);
      const etaMinutes = Number(text);

      if (!Number.isInteger(etaMinutes) || etaMinutes < 1 || etaMinutes > 300) {
        await bot.sendMessage(chatId, 'Введите, пожалуйста, количество минут целым числом, например: 25.');
        return;
      }

      pendingEtaByManager.delete(chatId);
      const order = await applyOrderStatus(pending.orderCode, 'courier_assigned', {
        etaMinutes,
        comment: `Осталось около ${etaMinutes} мин.`
      });

      if (!order) {
        await bot.sendMessage(chatId, 'Не удалось найти заказ для обновления статуса.');
        return;
      }

      await bot.sendMessage(chatId, `Статус заказа №${order.orderCode} обновлён: передан курьеру, осталось около ${etaMinutes} минут.`);
      return;
    }

    if (text === '⬅️ Главное меню') {
      await goHome(chatId);
      return;
    }

    if (text === '❌ Отменить' || text === '❌ Отменить заказ') {
      await goHome(chatId, 'Действие отменено. Если захотите вернуться, я на месте.');
      return;
    }

    if (text === CONTACT_MANAGER_TEXT) {
      await contactManager(chatId, session, msg.from);
      return;
    }

    if (text === '📋 Меню') {
      await safeSendMenu(chatId);
      await bot.sendMessage(chatId, 'Если захотите, сразу помогу оформить заказ или бронь.', mainKeyboard);
      return;
    }

    if (text === 'ℹ️ Помощь') {
      await bot.sendMessage(
        chatId,
        `Я могу:\n` +
        `• принять заказ на доставку\n` +
        `• помочь с бронью столика\n` +
        `• подсказать по меню\n\n` +
        `Заказы на доставку принимаются с 08:00 до 02:00 по Алматы.\n` +
        `Сейчас в ресторане: ${getCurrentTimeText()}`,
        mainKeyboard
      );
      return;
    }

    if (text === CREATOR_TEXT) {
      await bot.sendMessage(
        chatId,
        'Мой создатель-великий человек Нурали и мой юзернейм @bmfqq',
        mainKeyboard
      );
      return;
    }

    if (text === '🍕 Заказать еду') {
      await startOrder(chatId);
      return;
    }

    if (text === TRACK_ORDER_TEXT) {
      const order = getLatestOrderForChat(chatId);
      await bot.sendMessage(chatId, buildOrderTrackingText(order), mainKeyboard);

      if (order) {
        await notifyManagers(
          `Клиент интересуется статусом заказа №${order.orderCode}.\n👤 ${order.name}\n📞 ${order.phone}\n🆔 Chat ID: ${order.chatId}`,
          buildManagerOrderStatusKeyboard(order.orderCode)
        );
      }
      return;
    }

    if (text === REPEAT_ORDER_TEXT) {
      const previousOrder = getLatestOrderForRepeat(chatId);
      if (!previousOrder) {
        await bot.sendMessage(chatId, 'Пока не нашёл предыдущих заказов для повтора.', mainKeyboard);
        return;
      }

      session.data = {
        orderItems: (previousOrder.orderItems || []).map((item) => ({ ...item })),
        total: previousOrder.total,
        orderMenuSection: null,
        name: previousOrder.name,
        phone: previousOrder.phone,
        address: previousOrder.address,
        entrance: previousOrder.entrance,
        floor: previousOrder.floor,
        apartment: previousOrder.apartment,
        intercom: previousOrder.intercom,
        deliveryTime: previousOrder.deliveryTime,
        comment: previousOrder.comment,
        paymentMethod: null
      };
      nextOrderStep(session, 'confirm');
      await bot.sendMessage(
        chatId,
        `Повторил ваш предыдущий заказ №${previousOrder.orderCode}.\n\n${summarizeOrder(session.data)}\n\nЕсли всё верно, подтвердите заказ. Если хотите что-то поменять, нажмите "✏️ Изменить заказ".`,
        confirmOrderKeyboard
      );
      return;
    }

    if (text === '🪑 Забронировать стол') {
      await startBookingChoice(chatId);
      return;
    }

    if (text === '🍽️ Забронировать + предзаказ блюд') {
      await startBooking(chatId, true);
      return;
    }

    if (text === '🪑 Просто забронировать стол') {
      await startBooking(chatId, false);
      return;
    }

    if (text === '✏️ Изменить заказ' && session.flow === 'order') {
      session.data = { orderItems: [], total: 0, orderMenuSection: null, paymentMethod: null };
      nextOrderStep(session, 'items');
      await bot.sendMessage(chatId, 'Начнём заново. Напишите, что хотите заказать. Можно писать свободно или выбрать раздел кнопками ниже. Когда закончите, нажмите "✅ Завершить выбор" или напишите "всё".', orderCategoryKeyboard);
      return;
    }

    if (text === '✅ Да, подтвердить заказ' && session.flow === 'order' && session.step === 'confirm') {
      nextOrderStep(session, 'payment');
      await bot.sendMessage(
        chatId,
        `Сумма вашего заказа: ${formatMoney(session.data.total)}.\nВыберите, пожалуйста, способ оплаты:`,
        paymentKeyboard
      );
      return;
    }

    if (text === CASH_PAYMENT_TEXT && session.flow === 'order' && session.step === 'payment') {
      await finalizeOrder(chatId, session, 'Наличными при получении');
      return;
    }

    if (text === CARD_PAYMENT_TEXT && session.flow === 'order' && session.step === 'payment') {
      await finalizeOrder(chatId, session, 'Картой/Kaspi QR');
      return;
    }

    if (text === '✏️ Изменить бронь' && (session.flow === 'booking_only' || session.flow === 'booking_with_food')) {
      const withFood = session.flow === 'booking_with_food';
      session.data = { withFood };
      nextBookingStep(session, 'name', withFood);
      await bot.sendMessage(chatId, 'Начнём заново. Напишите, пожалуйста, ваше имя.', cancelKeyboard);
      return;
    }

    if (text === '✅ Да, подтвердить бронь' && (session.flow === 'booking_only' || session.flow === 'booking_with_food') && session.step === 'confirm') {
      await saveBooking(session.data);

      const preorderBlock = session.data.preorderItems && session.data.preorderItems.length > 0
        ? `\n🍽️ Предзаказ:\n${formatOrderItems(session.data.preorderItems)}\n\n💰 Предзаказ на сумму: ${formatMoney(session.data.preorderTotal)}`
        : '';

      const managerMsg =
        `🔔 Новая бронь!\n\n` +
        `👤 Гость: ${session.data.name}\n` +
        `📞 Телефон: ${session.data.phone}\n` +
        `🪑 Столик: №${session.data.tableNum}\n` +
        `👥 Гостей: ${session.data.guests}\n` +
        `📅 Дата: ${session.data.date}\n` +
        `⏰ Время: ${session.data.time}${preorderBlock}`;

      await notifyManagers(managerMsg);
      await goHome(chatId, '✅ Бронь подтверждена. Будем рады вас видеть!');
      return;
    }

    if (session.flow === 'order') {
      await handleOrderFlow(chatId, text, session);
      return;
    }

    if (session.flow === 'booking_only' || session.flow === 'booking_with_food') {
      await handleBookingFlow(chatId, text, session);
      return;
    }

    if (session.flow === 'booking_choice') {
      await bot.sendMessage(chatId, 'Пожалуйста, выберите один из вариантов на клавиатуре ниже.', bookingKeyboard);
      return;
    }

    pushHistoryEntry(session, 'user', text);
    const answer = await answerMenuQuestion(text, session);
    await bot.sendMessage(chatId, answer, mainKeyboard);
    pushHistoryEntry(session, 'assistant', answer);
  } catch (error) {
    console.error('Bot error:', error);

    if (error.message === 'TABLE_ALREADY_TAKEN') {
      const withFood = session.flow === 'booking_with_food';
      session.data.tableNum = await chooseAvailableTable(session.data.guests, session.data.date, session.data.time);

      if (!session.data.tableNum) {
        await bot.sendMessage(chatId, 'Пока вы подтверждали бронь, свободные столики на это время закончились. Попробуйте другую дату или время.', mainKeyboard);
        resetSession(chatId);
        return;
      }

      nextBookingStep(session, 'confirm', withFood);
      await bot.sendMessage(
        chatId,
        `Пока мы подтверждали бронь, изначальный столик уже заняли. Я подобрал свободный столик №${session.data.tableNum}.\n\n${summarizeBooking(session.data)}`,
        confirmBookingKeyboard
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      'Произошла ошибка при обработке запроса. Попробуйте ещё раз или вернитесь в главное меню.',
      mainKeyboard
    );
  }
});

console.log('Надёжный бот для кафе запущен!');
