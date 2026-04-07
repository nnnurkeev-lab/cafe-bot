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
   - `MANAGER_WEB_PASSWORD`
4. Railway сам выполнит `npm install` и запустит `npm start`

## Панель менеджера

- После запуска веб-панель доступна по адресу `/manager`
- Для входа используется пароль из `MANAGER_WEB_PASSWORD`
- Панель показывает заказы по статусам: `Ожидающие`, `В процессе`, `Готовы`, `В пути`, `Завершённые`
- Из панели можно менять статусы, а бот отправит клиенту обновление в Telegram

## Важно

- Не загружайте `.env` в GitHub
- Бот использует long polling Telegram, поэтому должен постоянно работать в одном облачном процессе
- Для сохранения заказов и броней в Supabase должна существовать таблица `bookings_cafe`
