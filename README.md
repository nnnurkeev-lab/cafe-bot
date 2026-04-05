# Cafe Bot

Telegram-бот кафе на Node.js с хранением заказов и броней в Supabase.

## Локальный запуск

1. Скопируйте `.env.example` в `.env`
2. Заполните переменные окружения
3. Установите зависимости:

```bash
npm install
```

4. Запустите бота:

```bash
npm start
```

## Деплой в Railway

1. Загрузите проект в GitHub
2. В Railway создайте новый проект из GitHub-репозитория
3. В разделе Variables добавьте:
   - `TELEGRAM_TOKEN`
   - `OPENAI_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `MENU_PHOTO_ID`
   - `MANAGER_ID`
   - `MY_ID`
4. Railway сам выполнит `npm install` и запустит `npm start`

## Важно

- Не загружайте `.env` в GitHub
- Бот использует long polling Telegram, поэтому должен постоянно работать в одном облачном процессе
- Для сохранения заказов и броней в Supabase должна существовать таблица `bookings_cafe`
