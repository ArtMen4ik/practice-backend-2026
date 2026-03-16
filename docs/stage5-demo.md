# Stage 5 Demo

## Что показывать

1. Клонирование репозитория
2. Запуск одной командой: `docker-compose up --build`
3. Проверка ответа API на `GET /`
4. Открытие Swagger UI на `http://localhost:3000/docs`
5. Запуск тестов командой `npm test`

## Какие тесты включены

- `GET /auth/me` без токена возвращает `401`
- `GET /auth/me` с токеном возвращает текущего пользователя
- `GET /bookings` без токена возвращает `401`
- `POST /bookings` создаёт бронирование
- `POST /bookings` возвращает `409 TIME_CONFLICT` при пересечении
- `POST /bookings` возвращает `400 VALIDATION_ERROR` для даты в прошлом

## Ссылки для демонстрации

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs/openapi.json`
