# Code Review — Payment Control

**Дата:** 30.05.2026
**Стек:** Frontend — Vue 3 (CDN) внутри Telegram Web App; Backend — n8n workflows; Хранилище — Google Sheets + n8n DataTable; Интеграция — 1C OData; OCR — Google Document AI + OpenAI LangChain.

---

## 1. Саммари

Проект решает реальную бизнес-задачу: загрузка счета пользователем из TG WebApp → OCR → согласование двумя аппруверами → запись в 1С. Архитектура простая и рабочая, но содержит **критические уязвимости в аутентификации и авторизации**, а также ряд архитектурных проблем (хардкод имён аппруверов, отсутствие аудита, дублирование кода во фронтенде). Перед расширением на других пользователей/контуров требуется доработка ИБ.

**Оценка зрелости:**
- Функциональность: 4/5
- ИБ: 1.5/5 (критические дыры)
- Поддерживаемость: 2.5/5 (хардкод и копипаста)
- Эксплуатация / наблюдаемость: 2/5 (есть error workflow, но нет audit trail)

---

## 2. Уязвимости и риски

### 2.1. КРИТИЧЕСКИЕ

| # | Категория | Где | Риск | Статус |
|---|-----------|-----|------|--------|
| C1 | **Подмена пользователя (auth bypass)** | `1.Entry`, `2.Auth`, `4. Get invoices`, `6. Approve`, `7. Upload approve` | `tg_data` принимается без проверки HMAC-подписи Telegram. Любой клиент с curl может подделать `user=...` и зайти под чужим `tg_id`, забрать чужие счета, отправить решение от имени другого аппрувера. Это самая опасная дыра. | 🔖 sub-workflow создан, но не подключён к parent-вебхукам |
| C2 | **Отсутствие авторизации при approve** | `7. Upload approve.json` | В payload приходит `approver: "approver"` — фронт сам решает, кто аппрувер; роутинг идёт по полю `approver_name` без сверки с `tg_id` отправителя. Любой авторизованный пользователь может писать в колонки «Статус Дамели/Даурен Б». | ✅ узлы `Is Approver?` + `Respond: 403` + роутинг по `approver_slot` |
| C3 | **Plaintext-пароли в DataTable** | `2.Auth` (`p_c_creds`, поле `pass`) | Сравнение `pass` напрямую — пароли хранятся в открытом виде. Утечка БД n8n = утечка всех учёток. | 🔖 добавлен только trim; bcrypt не реализован |
| C4 | **CORS `allowedOrigins: "*"`** | Все вебхуки (`check-auth`, `login`, `upload-invoice`, `get-invoices`, `get-pending-invoices`, `submit-decision`) | В сочетании с C1 позволяет CSRF/XS-Leaks с любого сайта. Для TG WebApp нужен whitelist (`https://web.telegram.org`, ваш домен фронта). | ✅ все 6 webhook-узлов обновлены |

### 2.2. ВЫСОКИЕ

| # | Категория | Где | Риск | Статус |
|---|-----------|-----|------|--------|
| H1 | Нет валидации файлов на бэкенде | `3.Upload-invoice` | Принимается любой бинарник; на фронте указан `accept="image/*,application/pdf"`, но это обходится. Нет проверки MIME, размера, антивирусного сканирования. Возможна загрузка вредоносных PDF / ZIP-бомб. | ✅ узлы `Validate File` + `Respond: Invalid File` (415/413) |
| H2 | Хардкод секретов и идентификаторов | `5.to 1C` | Hostname `srv4.generis.kz`, GUID-ы организаций/банков/групп зашиты прямо в expressions. При смене окружения — переписать workflow. Ключи 1С храните только в n8n credentials, не в JSON выражениях. | 🔖 |
| H3 | Возможная инъекция в 1C JSON | `5.to 1C` | Поля из Google Sheets подставляются в тело запроса 1С через `{{ $json.field }}` без экранирования. Если в счёте есть кавычка или `\n` — JSON ломается; в худшем случае — управляемое поведение OData. | 🔖 |
| H4 | Логи с PII в браузерной консоли | `ApproverDashboard.js` (`submitDecision`) | `console.log` печатает `requestData`, заголовки ответа, сырое тело. В Telegram WebApp это попадает в дев-консоль/логи провайдера. | ✅ все `console.log` с данными удалены |
| H5 | Утечка деталей в error workflow | `error_paymentcontrol.json` | В уведомления уходит execution URL и стек. Если канал WhatsApp/TG не строго приватный — утечка внутренней структуры. | ✅ узел `Send a text message` — URL и стек убраны |
| H6 | Нет rate-limit / brute-force защиты | `2.Auth` (`/login`) | Логин неограничен по попыткам. Подбор пароля тривиален. | 🔖 |

### 2.3. СРЕДНИЕ

- 🔖 **M1.** Хардкод имён аппруверов «Дамели», «Даурен Б» в 5+ местах (фронт + 4 workflow). Добавление третьего согласующего = переписать всю систему. Нужна модель ролей/permissions в `p_c_creds`. *(backend-роутинг переведён на `approver_slot`, но шаблоны фронта по-прежнему хардкодят имена)*
- 🔖 **M2.** Approve-логика в `5.1.to 1C` срабатывает по факту значений в колонках листа — кто угодно с доступом к Google Sheets может одобрить счёт минуя бот.
- 🔖 **M3.** Нет аудита: кто, когда, с какого `tg_id` поставил статус. Только текущее значение в колонке. *(`auditLog.json` sub-workflow создан, но не подключён к parent-workflow)*
- ✅ **M4.** Дубликаты кода: `UserDashboard.js`, `AdminDashboard.js`, `ApproverDashboard.js` содержат идентичные методы (`getSuccessMessage`, `formatAmount`, `filterDocumentsByPeriod`, `sendFiles`, и т.д.). ~70% дублирования.
- ✅ **M5.** Нет HTTP-кодов и осмысленных error-кодов в ответах вебхуков (есть только `Respond: Error` без тела в `2.Auth`).
- ✅ **M6.** В фронте URL n8n зашиты в каждом компоненте отдельно — нет единого `config.js`.
- 🔖 **M7.** Vue и telegram-web-app.js подключены с CDN без `integrity` (SRI). Компрометация CDN = подмена JS. *(добавлен только `crossorigin="anonymous"`, хеш `integrity` не вычислен)*
- 🔖 **M8.** `is_active` обновляется на `true` при логине, но нет процесса разлогина / истечения сессии. Сессия живёт «вечно».

### 2.4. НИЗКИЕ

- 🔖 **L1.** Период фильтрации (`week/month/all`) запрашивается с бэка как `'all'` всегда, фильтрация на клиенте — лишний трафик при большом объёме.
- ✅ **L2.** Закомментированные имена файлов (`// filepath: ...`) в `app.js`.
- 🔖 **L3.** В `ApproverDashboard.js` иконка кнопки «Статус» — мусорный символ `�` (битая кодировка).
- ✅ **L4.** `console.log` в проде.
- ✅ **L5.** Папка `manual_backup/` коммитится — версионирование уже делает git, бэкап не нужен.
- 🔖 **L6.** `getMyStatusText` всегда возвращает `'Не рассмотрено'` — мёртвый код / недоделанная логика.
- ✅ **L7.** Нет `<meta name="referrer">` и CSP-заголовков.

---

## 3. Предложения

### 3.1. Безопасность (priority: now)

1. 🔖 **Валидация Telegram initData** — на каждом вебхуке проверять HMAC по [официальной схеме](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app). Один общий sub-workflow `validateInitData` с входом `tg_data` и выходом `{user, isValid}`. Все остальные вебхуки вызывают его первым шагом и сразу возвращают 401 если `isValid = false`. **Узлы для правки:** все Webhook-узлы в 1.Entry, 2.Auth, 3.Upload-invoice, 4. Get invoices, 6. Approve, 7. Upload approve. *(файл `validateInitData.json` создан; вызовы из parent-workflow не добавлены)*
2. 🔖 **Хеширование паролей** — заменить поле `pass` на `pass_hash` (bcrypt/argon2). В n8n использовать Crypto-узел. Миграция: одноразовый workflow, который захеширует существующие пароли. **Узлы для правки:** `Find Login in Credentials`, `Are Credentials OK?1` в `2.Auth`. *(добавлен только `Normalize Input` — trim пароля; bcrypt не реализован)*
3. ✅ **CORS whitelist** — заменить `allowedOrigins: "*"` на конкретные домены. **Узлы для правки:** все Webhook-узлы во всех workflow.
4. ✅ **Авторизация в `7. Upload approve`** — определять имя аппрувера по `tg_id` из валидированного initData, а не из тела. Сверять с ролью из `p_c_creds`. Возвращать 403 если роль ≠ `approver`. **Узлы для правки:** `Webhook (Submit Decision)` и Switch `Approver Router`.
5. 🔖 **Rate limit на `/login` и `/check-auth`** — n8n не имеет встроенного, поставить Cloudflare/nginx перед n8n или использовать `@n8n/rate-limit` community node. Минимум: 5 попыток / 15 минут на IP+login.
6. ✅ **Валидация загрузки** — в `3.Upload-invoice` добавить If-узел: `mimeType ∈ {pdf, jpeg, png}`, `size < 10MB`. Возвращать 415/413.
7. ✅ **Убрать `console.log` с PII** из `ApproverDashboard.js` (`submitDecision`).
8. 🔖 **SRI на CDN** — добавить `integrity="sha384-..."` к `vue.global.js`. Для `telegram-web-app.js` это не работает (URL без версии), допустимо оставить. *(добавлен только `crossorigin="anonymous"`, хеш не вычислен)*

### 3.2. Архитектура (priority: next)

9. 🔖 **Модель ролей вместо имён** — в `p_c_creds` добавить поле `is_approver: boolean` и `approver_slot: 1|2`. Колонки в Google Sheets оставить как есть, но мапить через таблицу. Это устранит хардкод «Дамели/Даурен Б» в 5 местах. *(backend-роутинг переведён на `approver_slot`; шаблоны фронта не обновлены)*
10. 🔖 **Audit log** — отдельный лист «Журнал»: timestamp, tg_id, login, действие, document_id, old_status, new_status. Добавить во все workflow, изменяющие данные. *(`auditLog.json` sub-workflow создан; вызовы из parent-workflow не добавлены)*
11. ✅ **Единый config на фронте** — `config.js` с одним `WEBHOOK_BASE = 'https://n8n.eurasiantech.kz/webhook'` и методами-помощниками. Убрать дубль URL из 4 файлов.
12. ✅ **Рефакторинг дашбордов** — выделить общий миксин/композаблу `useInvoiceUpload()` и `useDocumentList()`. Сократит код на ~40%.
13. 🔖 **Сессии** — таблица `sessions` (token, tg_id, expires_at). Бот выдаёт токен после логина, фронт хранит в `Telegram.WebApp.CloudStorage`. Истечение — 12-24 часа. Сейчас `is_active=true` — фактически вечная сессия.
14. 🔖 **Перенести 1C creds в n8n credentials** — basic-auth и URL вынести из expressions в HTTP Request → Credential. **Узлы:** все HTTP Request к `srv4.generis.kz` в `5.to 1C`.
15. 🔖 **Идемпотентность загрузки** — в `3.Upload-invoice` хешировать содержимое файла (sha256) и проверять по полю `file_hash` в листе. Сейчас детект «уже загружен» неявный (по 400), часто ложно срабатывает.

### 3.3. Качество (priority: later)

16. ✅ Удалить `manual_backup/` из репо, добавить в `.gitignore`.
17. 🔖 Включить ESLint + Prettier, настроить `husky` pre-commit.
18. 🔖 Поднять Vue из CDN на сборку (Vite) — даст tree-shaking, бандлинг, hashing для cache-busting.
19. 🔖 Документация: `README.md` с описанием ролей, диаграммой потока (mermaid), how-to для добавления аппрувера.
20. 🔖 Добавить smoke-тесты вебхуков (Postman/Newman или n8n test-workflow): успешный логин, отказ по неверному паролю, попытка спуфинга tg_data, дубликат загрузки.

---

## 4. Дорожная карта (рекомендация)

| Спринт | Что |
|--------|-----|
| **1 (ИБ-фикс)** | C1, C2, C3, C4, H1, H4 |
| **2 (укрепление)** | H2, H3, H5, H6, M3 (audit), сессии (13) |
| **3 (рефакторинг)** | M1, M4, M6, M7, конфиг + миксины |
| **4 (DX/инфра)** | Vite-сборка, README, smoke-тесты, ESLint |

---

## 5. Ключевые файлы и привязки

- Фронт: [index.html](index.html), [app.js](app.js), [UserDashboard.js](UserDashboard.js), [AdminDashboard.js](AdminDashboard.js), [ApproverDashboard.js](ApproverDashboard.js)
- Бэк (n8n): [1.Entry.json](n8n_flows/1.Entry.json), [2.Auth.json](n8n_flows/2.Auth.json), [3.Upload-invoice.json](n8n_flows/3.Upload-invoice.json), [4. Get invoices.json](n8n_flows/4.%20Get%20invoices.json), [5.to 1C.json](n8n_flows/5.to%201C.json), [5.1.to 1C.json](n8n_flows/5.1.to%201C.json), [6. Approve.json](n8n_flows/6.%20Approve.json), [7. Upload approve.json](n8n_flows/7.%20Upload%20approve.json), [error_paymentcontrol.json](n8n_flows/error_paymentcontrol.json)

---

> **Главное:** до выноса в продуктив на больше 2 пользователей — закрыть пункты C1–C4. Без проверки HMAC initData приложение фактически не аутентифицирует пользователя.
