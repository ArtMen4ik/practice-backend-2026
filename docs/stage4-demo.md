# Stage 4 Demo

## Подготовленные данные

- `admin@example.com` / `admin123`
- `client@example.com` / `client123`
- `photo@example.com` / `photo123`
- Фотограф `Art Photo` в городе `Kazan`
- Услуги `Portrait 1h` и `Family 2h`

Если база пустая, сначала выполнить миграции и `prisma db seed`.

## Единые правила списков

Все list-endpoints используют одинаковые query-параметры:

- `page` — номер страницы, начиная с `1`
- `limit` — размер страницы, от `1` до `100`
- `sortBy` — поле сортировки из разрешённого набора для конкретного endpoint
- `sortOrder` — `asc` или `desc`

Во всех ответах списков возвращается:

- `data` — элементы
- `meta.page`
- `meta.limit`
- `meta.total`
- `meta.totalPages`
- `meta.sortBy`
- `meta.sortOrder`
- `meta.filters`

## Сценарий демо

1. Выполнить `Auth / Login admin` и `Auth / Login client`, сохранить `token` в переменные коллекции `adminToken` и `clientToken`.
2. Выполнить `Photographers / List`. Взять `data[0].id` и сохранить в `photographerId`.
3. Выполнить `Services / List by photographer`. Взять нужную услугу и сохранить её `id` в `serviceId`.
4. Выполнить `Search / Available photographers` для будущего слота. Это успешный сценарий поиска.
5. Выполнить `Bookings / Create booking` под клиентом. Сохранить `data.id` в `bookingId`.
6. Выполнить `Bookings / My bookings filtered` с `status=PENDING`. Это сценарий фильтрации списка.
7. Выполнить `Bookings / Complete booking` под админом.
8. Выполнить `Reviews / Create review` под клиентом.
9. Выполнить `Photographers / Reviews`. Проверить `meta.averageRating` и `meta.reviewCount`.
10. Выполнить `Photographers / Schedule` для диапазона, где попадает созданная бронь.
11. Выполнить `Search / Empty result` для уже занятого интервала с `minRating=5` или для несуществующего сочетания фильтров. Это сценарий пустого результата.

## Что показывать по шагам

- Поиск свободных фотографов по времени, городу и услуге
- Пагинацию/сортировку/фильтрацию на списках фотографов, услуг и броней
- Расписание фотографа с `busySlots` и `freeSlots`
- Отзыв после завершённой брони
- Средний рейтинг фотографа в карточке и в списке отзывов
