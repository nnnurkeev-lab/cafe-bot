require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const MENU_PHOTO_ID = process.env.MENU_PHOTO_ID;
const MANAGER_ID = Number(process.env.MANAGER_ID || 7217238312);
const MY_ID = Number(process.env.MY_ID || 979390128);
const TIME_ZONE = 'Asia/Almaty';
const MIN_ORDER_TOTAL = 4000;
const CONTACT_MANAGER_TEXT = '👨‍💼 Связаться с менеджером';

if (!TELEGRAM_TOKEN) throw new Error('TELEGRAM_TOKEN is required');
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL and SUPABASE_KEY are required');

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

const sessions = new Map();

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
  { name: 'Мясное ассорти', aliases: ['мясное ассорти'], price: 4290 },
  { name: 'Конское ассорти', aliases: ['конское ассорти'], price: 4390 },
  { name: 'Рыбное ассорти', aliases: ['рыбное ассорти'], price: 4490 },
  { name: 'Сырная доска', aliases: ['сырная доска'], price: 3990 },
  { name: 'Русская закуска', aliases: ['русская закуска'], price: 2290 },
  { name: 'Кавказская закуска', aliases: ['кавказская закуска'], price: 2590 },
  { name: 'Ассорти солений', aliases: ['ассорти солений'], price: 2390 },
  { name: 'Рулетики по-грузински', aliases: ['рулетики по-грузински'], price: 2390 },
  { name: 'Рулетики с сёмгой', aliases: ['рулетики с сёмгой', 'рулетики с семгой'], price: 3090 },
  { name: 'Казы', aliases: ['казы'], price: 2090 },
  { name: 'Оливки', aliases: ['оливки'], price: 790 },
  { name: 'Запеченные мозговые кости', aliases: ['запеченные мозговые кости'], price: 2790 },
  { name: 'Жульен с курицей', aliases: ['жульен с курицей'], price: 2390 },
  { name: 'Жульен с грибами', aliases: ['жульен с грибами'], price: 2390 },
  { name: 'Мини-чебуреки', aliases: ['мини-чебуреки', 'мини чебуреки'], price: 2090 },
  { name: 'Крылышки в соусе терияки', aliases: ['крылышки в соусе терияки'], price: 2690 },
  { name: 'Крылышки в соусе свит-чили', aliases: ['крылышки в соусе свит-чили', 'крылышки в соусе свит чили'], price: 2590 },
  { name: 'Острые крылышки в хрустящей панировке', aliases: ['острые крылышки в хрустящей панировке', 'острые крылышки'], price: 2590 },
  { name: 'Креветки к пиву', aliases: ['креветки к пиву'], price: 2990 },
  { name: 'Сырные палочки', aliases: ['сырные палочки'], price: 2190 },
  { name: 'Куриные стрипсы', aliases: ['куриные стрипсы'], price: 2090 },
  { name: 'Луковые кольца', aliases: ['луковые кольца'], price: 1690 },
  { name: 'Королевские креветки в темпуре', aliases: ['королевские креветки в темпуре'], price: 3890 },
  { name: 'Мойва на шпажках', aliases: ['мойва на шпажках'], price: 2090 },
  { name: 'Хрустящие шампиньоны с чесночным соусом', aliases: ['хрустящие шампиньоны с чесночным соусом', 'хрустящие шампиньоны'], price: 2090 },
  { name: 'Шампиньоны запеченные под сыром', aliases: ['шампиньоны запеченные под сыром'], price: 2290 },
  { name: 'Долма', aliases: ['долма'], price: 2290 },
  { name: 'Картофельная доска', aliases: ['картофельная доска'], price: 3990 }
];

const MAIN_KEYBOARD_ROWS = [
  [{ text: '🍕 Заказать еду' }, { text: '🪑 Забронировать стол' }],
  [{ text: '📋 Меню' }, { text: 'ℹ️ Помощь' }],
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

const confirmBookingKeyboard = createKeyboard([
  [{ text: '✅ Да, подтвердить бронь' }, { text: '✏️ Изменить бронь' }],
  [{ text: CONTACT_MANAGER_TEXT }],
  [{ text: '❌ Отменить' }, { text: '⬅️ Главное меню' }]
]);

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

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('ru-RU')} тг`;
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

function isValidPhone(text) {
  const digits = String(text || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 12;
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

function parseDate(text) {
  const match = String(text || '').trim().match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric'
  }).format(new Date()));

  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return {
    day,
    month,
    year,
    value: `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
  };
}

function parseTime(text) {
  const match = String(text || '').trim().match(/^(\d{1,2}):(\d{2})$/);
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

function isBookingTimeAllowed(parsedTime) {
  if (!parsedTime) return false;
  return parsedTime.hours >= 8 || parsedTime.hours < 2;
}

function looksLikeOrderInput(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  if (/^\d+\s*[xх*]\s+.+$/i.test(String(text || '').trim())) {
    return true;
  }

  return isAllMenuRequest(text) || parseNaturalOrderText(text).items.length > 0 || Boolean(findMenuItemByAlias(text));
}

function isDoneOrderingText(text) {
  const normalized = normalizeText(text);
  return ['все', 'всё', 'готово', 'это все', 'это всё', 'хватит'].includes(normalized);
}

function isOrderSummaryQuestion(text) {
  const normalized = normalizeText(text);
  return (
    normalized.includes('какой мой заказ') ||
    normalized.includes('что у меня в заказе') ||
    normalized.includes('что в заказе') ||
    normalized.includes('что я заказал') ||
    normalized.includes('что мы заказали') ||
    normalized.includes('итого') ||
    normalized.includes('покажи заказ') ||
    normalized.includes('мой заказ')
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

  const cleaned = lines.map((line) => line.replace(/^[^:]+:\s*/u, '').trim());

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
    `⏰ Время доставки: ${data.deliveryTime}\n` +
    `💬 Комментарий: ${data.comment || 'нет'}`
  );
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

async function saveOrder(data) {
  const payload = {
    type: 'order',
    client_name: data.name,
    phone: data.phone,
    delivery_address: data.address,
    entrance: data.entrance,
    floor: data.floor,
    apartment: data.apartment,
    intercom: data.intercom,
    order_items: data.orderItems.map((item) => `${item.quantity} x ${item.name}`).join(', '),
    time: data.deliveryTime,
    comment: data.comment || 'нет'
  };

  const { error } = await supabase.from('bookings_cafe').insert(payload);
  if (error) throw new Error(`Failed to save order: ${error.message}`);
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

async function notifyManagers(text) {
  const targets = [MANAGER_ID, MY_ID].filter(Boolean);
  await Promise.allSettled(targets.map((id) => bot.sendMessage(id, text)));
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
    total: 0
  };
  nextOrderStep(session, 'items');

  await safeSendMenu(chatId);
  await bot.sendMessage(
    chatId,
    'Напишите, что хотите заказать. Можно писать свободно, например: "хочу сырную доску и куриные стрипсы". Когда закончите, напишите "всё".',
    cancelKeyboard
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
    case 'items': {
      if (isOrderSummaryQuestion(text)) {
        data.total = calculateOrderTotal(data.orderItems);
        const reply = summarizeCurrentCart(data);
        await bot.sendMessage(chatId, reply, cancelKeyboard);
        pushHistoryEntry(session, 'assistant', reply);
        return;
      }

      if (isDoneOrderingText(text)) {
        if (!data.orderItems || data.orderItems.length === 0) {
          const reply = 'Пока у вас нет ни одной позиции в заказе. Напишите, что хотите заказать.';
          await bot.sendMessage(chatId, reply);
          pushHistoryEntry(session, 'assistant', reply);
          return;
        }

        data.total = calculateOrderTotal(data.orderItems);

        if (data.total < MIN_ORDER_TOTAL) {
          const reply = `Сейчас в заказе ${formatMoney(data.total)}. Минимальная сумма доставки — ${formatMoney(MIN_ORDER_TOTAL)}.\nДобавьте, пожалуйста, ещё позиции или отмените заказ.`;
          await bot.sendMessage(chatId, reply, cancelKeyboard);
          pushHistoryEntry(session, 'assistant', reply);
          return;
        }

        nextOrderStep(session, 'delivery_details');
        const reply = `Ваш заказ:\n${formatOrderItems(data.orderItems)}\n\nИтого: ${formatMoney(data.total)}.\n\nТеперь отправьте одним сообщением данные для доставки, каждую строку с новой строки:\nИмя\nТелефон\nАдрес\nПодъезд\nЭтаж\nКвартира\nДомофон\nВремя доставки\nКомментарий\n\nЕсли чего-то нет, напишите "нет".`;
        await bot.sendMessage(chatId, reply);
        pushHistoryEntry(session, 'assistant', reply);
        return;
      }

      if (!looksLikeOrderInput(text)) {
        const answer = await answerMenuQuestion(text, session);
        const reply = `${answer}\n\nКогда определитесь, просто напишите нужные блюда. Когда закончите, отправьте "всё".`;
        await bot.sendMessage(chatId, reply, cancelKeyboard);
        pushHistoryEntry(session, 'assistant', reply);
        return;
      }

      const parsed = parseFlexibleOrderInput(text);

      if (parsed.items.length === 0) {
        const reply = 'Не получилось понять, какую позицию вы хотите добавить. Напишите название блюда так, как вам удобно.';
        await bot.sendMessage(chatId, reply);
        pushHistoryEntry(session, 'assistant', reply);
        return;
      }

      if (parsed.unknown.length > 0) {
        if (parsed.items.length === 0) {
          await bot.sendMessage(
            chatId,
            `${formatUnknownItemsMessage(parsed.unknown)}\n\nНапишите другие позиции, и я с радостью помогу собрать заказ.`,
            cancelKeyboard
          );
          pushHistoryEntry(session, 'assistant', `${formatUnknownItemsMessage(parsed.unknown)} Напишите другие позиции, и я с радостью помогу собрать заказ.`);
          return;
        }
      }

      data.orderItems = upsertOrderItems(data.orderItems, parsed.items);
      data.total = calculateOrderTotal(data.orderItems);
      const unknownBlock = parsed.unknown.length > 0 ? `\n\n${formatUnknownItemsMessage(parsed.unknown)}` : '';
      const reply = isAllMenuRequest(text)
        ? `Добавил в заказ все позиции из меню по 1 порции.\n\n${formatOrderItems(parsed.items)}\n\nСейчас в заказе на ${formatMoney(data.total)}. Если хотите, можете убрать лишнее через "Изменить заказ" или сразу отправить "всё".${unknownBlock}`
        : `Добавил в заказ:\n${formatOrderItems(parsed.items)}\n\nСейчас в заказе на ${formatMoney(data.total)}. Если хотите что-то ещё, напишите следующую позицию. Когда закончите, отправьте "всё".${unknownBlock}`;
      await bot.sendMessage(chatId, reply, cancelKeyboard);
      pushHistoryEntry(session, 'assistant', reply);
      return;
    }

    case 'delivery_details': {
      const parsedDetails = parseDeliveryDetails(text);
      if (parsedDetails.error === 'NOT_ENOUGH_FIELDS') {
        await bot.sendMessage(
          chatId,
          'Не получилось разобрать все данные доставки. Можете отправить их одним сообщением в свободной форме или по строкам:\nИмя\nТелефон\nАдрес\nПодъезд\nЭтаж\nКвартира\nДомофон\nВремя доставки\nКомментарий'
        );
        return;
      }
      if (parsedDetails.error === 'INVALID_NAME') {
        await bot.sendMessage(chatId, 'Не удалось распознать имя. Пожалуйста, отправьте все данные ещё раз одним сообщением.');
        return;
      }
      if (parsedDetails.error === 'INVALID_PHONE') {
        await bot.sendMessage(chatId, 'Номер телефона выглядит некорректно. Пожалуйста, отправьте все данные ещё раз одним сообщением.');
        return;
      }
      if (parsedDetails.error === 'INVALID_ADDRESS') {
        await bot.sendMessage(chatId, 'Адрес выглядит слишком коротким. Пожалуйста, отправьте все данные ещё раз одним сообщением.');
        return;
      }
      if (parsedDetails.error === 'INVALID_TIME') {
        await bot.sendMessage(chatId, 'Ресторан, к сожалению, принимает заказы только с 08:00 до 02:00. Пожалуйста, укажите время доставки в этом интервале и отправьте данные ещё раз одним сообщением.');
        return;
      }

      Object.assign(data, parsedDetails.data);
      nextOrderStep(session, 'confirm');
      await bot.sendMessage(chatId, `${summarizeOrder(data)}\n\nЕсли всё верно, подтвердите заказ.`, confirmOrderKeyboard);
      return;
    }

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
      if (text.trim().length < 2) {
        await bot.sendMessage(chatId, 'Пожалуйста, укажите имя не короче 2 символов.');
        return;
      }
      data.name = text.trim();
      nextBookingStep(session, 'phone', withFood);
      await bot.sendMessage(chatId, 'Укажите номер телефона.');
      return;

    case 'phone':
      if (!isValidPhone(text)) {
        await bot.sendMessage(chatId, 'Пожалуйста, укажите корректный номер телефона.');
        return;
      }
      data.phone = normalizePhone(text);
      nextBookingStep(session, 'date', withFood);
      await bot.sendMessage(chatId, 'Укажите дату в формате ДД.ММ или ДД.ММ.ГГГГ.');
      return;

    case 'date': {
      const parsedDate = parseDate(text);
      if (!parsedDate) {
        await bot.sendMessage(chatId, 'Не удалось распознать дату. Используйте формат ДД.ММ или ДД.ММ.ГГГГ.');
        return;
      }
      data.date = parsedDate.value;
      nextBookingStep(session, 'time', withFood);
      await bot.sendMessage(chatId, 'Укажите время в формате ЧЧ:ММ.');
      return;
    }

    case 'time': {
      const parsedTime = parseTime(text);
      if (!parsedTime || !isBookingTimeAllowed(parsedTime)) {
        await bot.sendMessage(chatId, 'Бронь принимается в часы работы: с 08:00 до 02:00. Укажите время в формате ЧЧ:ММ.');
        return;
      }
      data.time = parsedTime.value;
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
        nextBookingStep(session, 'preorder', true);
        await bot.sendMessage(
          chatId,
          `Подобрал столик №${data.tableNum}. Теперь можете оформить предзаказ так же, как обычный заказ: пишите позиции свободно, например "хочу казы и сырные палочки" или "2 x Казы". Когда закончите, отправьте "всё". Если предзаказ не нужен, напишите "нет".`,
          cancelKeyboard
        );
      } else {
        nextBookingStep(session, 'confirm', false);
        await bot.sendMessage(chatId, summarizeBooking(data), confirmBookingKeyboard);
      }
      return;

    case 'preorder':
      if (isOrderSummaryQuestion(text)) {
        data.preorderTotal = calculateOrderTotal(data.preorderItems);
        await bot.sendMessage(chatId, summarizeCurrentPreorder(data), cancelKeyboard);
        return;
      }

      if (normalizeText(text) === 'нет' && (!data.preorderItems || data.preorderItems.length === 0)) {
        data.preorderItems = [];
        data.preorderTotal = 0;
        nextBookingStep(session, 'confirm', true);
        await bot.sendMessage(chatId, summarizeBooking(data), confirmBookingKeyboard);
        return;
      }

      if (isDoneOrderingText(text)) {
        data.preorderTotal = calculateOrderTotal(data.preorderItems);
        nextBookingStep(session, 'confirm', true);
        await bot.sendMessage(chatId, summarizeBooking(data), confirmBookingKeyboard);
        return;
      }

      if (!looksLikeOrderInput(text)) {
        const answer = await answerMenuQuestion(text, session);
        await bot.sendMessage(
          chatId,
          `${answer}\n\nЕсли хотите добавить предзаказ, просто напишите нужные блюда. Когда закончите, отправьте "всё". Если предзаказ не нужен, напишите "нет".`,
          cancelKeyboard
        );
        return;
      }

      const parsed = parseFlexibleOrderInput(text);
      if (parsed.items.length === 0) {
        await bot.sendMessage(chatId, 'Не получилось понять, какие позиции добавить в предзаказ. Напишите блюда так, как вам удобно.');
        return;
      }

      if (parsed.unknown.length > 0 && parsed.items.length === 0) {
        await bot.sendMessage(
          chatId,
          `${formatUnknownItemsMessage(parsed.unknown)}\n\nНапишите другие позиции, и я помогу собрать предзаказ.`,
          cancelKeyboard
        );
        return;
      }

      data.preorderItems = upsertOrderItems(data.preorderItems, parsed.items);
      data.preorderTotal = calculateOrderTotal(data.preorderItems);
      {
        const unknownBlock = parsed.unknown.length > 0 ? `\n\n${formatUnknownItemsMessage(parsed.unknown)}` : '';
        const reply = isAllMenuRequest(text)
          ? `Добавил в предзаказ все позиции из меню по 1 порции.\n\n${formatOrderItems(parsed.items)}\n\nСейчас в предзаказе на ${formatMoney(data.preorderTotal)}. Если хотите что-то ещё, напишите следующую позицию. Когда закончите, отправьте "всё".${unknownBlock}`
          : `Добавил в предзаказ:\n${formatOrderItems(parsed.items)}\n\nСейчас в предзаказе на ${formatMoney(data.preorderTotal)}. Если хотите что-то ещё, напишите следующую позицию. Когда закончите, отправьте "всё".${unknownBlock}`;
        await bot.sendMessage(chatId, reply, cancelKeyboard);
      }
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

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = String(msg.text || '').trim();
  if (!text || text === '/start') return;

  const session = getSession(chatId);

  try {
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

    if (text === '🍕 Заказать еду') {
      await startOrder(chatId);
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
      session.data = { orderItems: [], total: 0 };
      nextOrderStep(session, 'items');
      await bot.sendMessage(chatId, 'Начнём заново. Напишите, что хотите заказать. Когда закончите, отправьте "всё".', cancelKeyboard);
      return;
    }

    if (text === '✅ Да, подтвердить заказ' && session.flow === 'order' && session.step === 'confirm') {
      await saveOrder(session.data);

      const managerMsg =
        `🔔 Новый заказ!\n\n` +
        `👤 Клиент: ${session.data.name}\n` +
        `📞 Телефон: ${session.data.phone}\n` +
        `📍 Адрес: ${session.data.address}\n` +
        `🚪 Подъезд: ${session.data.entrance}\n` +
        `🏢 Этаж: ${session.data.floor}\n` +
        `🏠 Квартира: ${session.data.apartment}\n` +
        `🔢 Домофон: ${session.data.intercom}\n` +
        `🍽️ Позиции:\n${formatOrderItems(session.data.orderItems)}\n\n` +
        `💰 Сумма: ${formatMoney(session.data.total)}\n` +
        `⏰ Время: ${session.data.deliveryTime}\n` +
        `💬 Комментарий: ${session.data.comment || 'нет'}`;

      await notifyManagers(managerMsg);
      await goHome(chatId, '✅ Заказ подтверждён. Ожидайте звонка для подтверждения. Спасибо, что выбрали нас!');
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
