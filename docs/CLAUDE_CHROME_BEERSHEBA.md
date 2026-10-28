# Задание для Claude в Chrome: ассеты Беэр-Шевы в Google Flow

Ты работаешь в браузере пользователя. Задача: сгенерировать в Google Flow (https://labs.google/fx/tools/flow), проект **«Хамсин»**, ассеты для города Беэр-Шева из изометрической RPG «Хамсин» (постъядерный Израиль, стиль Fallout 2) и сохранить их в папку Google Диска **«Ассеты Фоллаут»**. Работай по списку сверху вниз (по приоритету). В конце — отчёт.

## 1. Правила

- Промпты на английском — **копируй целиком, без перевода**. Блоки `[STYLE]` и `[PORTRAIT]` подставляй из раздела 2 дословно.
- Картинки: самая качественная модель изображений, максимальное разрешение, 2–4 варианта. Видео: Veo, 1080p.
- «Говорящие головы»: видео делай в режиме **Frames to video**, первым кадром — портрет этого персонажа из галереи проекта.
- На ассет максимум 3 попытки, потом «не удалось» в отчёте.
- Перед скачиванием переименуй ассет во Flow **точно как указано** (латиница). Скачай в максимальном качестве. Положи на Диск в указанную подпапку `Ассеты Фоллаут/…`. Если загрузка на Диск не выходит — оставь в «Загрузках» и перечисли файлы в отчёте.
- Не покупай кредиты, не меняй тариф, не удаляй чужие файлы, ничем не делись. Upscayl не запускай.

## 2. Общие блоки

**[STYLE]**
```
Art style: 1990s pre-rendered isometric CRPG, exactly like Fallout 2 (1998) and Fallout 1 (1997). Gritty, dusty, post-apocalyptic. Desaturated warm palette: sand, ochre, rust, olive drab, bone white, weathered concrete grey. Hard late-afternoon sunlight from the upper left, soft long shadows falling to the lower right. Slightly grainy, painterly-realistic textures, worn and sun-bleached surfaces. Retro-futuristic 1960s–70s Israeli aesthetic frozen in time. No text, no letters, no UI, no watermark, no logos.
```

**[PORTRAIT]**
```
Close-up head-and-shoulders portrait for a 1998 CRPG "talking head" dialogue screen, styled like the sculpted, pre-rendered talking heads of Fallout 1 and 2: slightly exaggerated, highly detailed, sculpted-clay realism with painted textures. Dark warm-brown background with a soft vignette, warm key light from the upper left, rim light from the right. The character looks straight at the viewer, mouth closed. 16:9 frame, face in the centre. No text.
```

**Видео «молчит»** (`…-idle.mp4`, 8 с):
```
The character stays in the same framing, static locked-off camera, no camera movement, no zoom. Subtle idle motion only: breathing, slow blinking, small natural head movements, eyes look at the viewer. Mouth stays closed. Background unchanged. No music, no speech, no text, seamless loop.
```

**Видео «говорит»** (`…-talk.mp4`, 8 с):
```
The character stays in the same framing, static locked-off camera, no camera movement, no zoom. The character is talking calmly to the viewer: natural lip and jaw movement, small head nods and expressive eyebrows, occasional blinks. Background unchanged. No music, no subtitles, no text, seamless loop.
```

## 3. Как выбирать

- Портрет: лицо по центру, рот закрыт, тёмный однородный фон, без текста, без лишних рук и искажений лица; одежда и приметы как в описании.
- Видео: камера неподвижна, лицо не «плывёт», в «говорит» губы двигаются, в «молчит» — нет.
- Фон города: композиция совпадает с заготовкой (см. раздел 4, C), нет людей и текста.

## 4. Список

### A. «Говорящие головы» — приоритет 1 (папка `portraits`)

**A1. Ицик-Мусорщик — торговец довоенной техникой**
- `itzik.png`:
```
[PORTRAIT] A thin wiry Israeli junk dealer in his 50s, sharp hawk nose, sunken cheeks, sly narrow eyes, stubble, a jeweller's magnifying loupe pushed up on his forehead, a ring of old brass keys on a cord around his neck, a greasy patched work vest over a faded striped shirt.
```
- `itzik-idle.mp4`, `itzik-talk.mp4` — из `itzik.png`.

**A2. Наама — хозяйка чайханы**
- `naama.png`:
```
[PORTRAIT] A warm but shrewd Yemenite-Israeli woman in her 40s, dark expressive eyes lined with kohl, a colourful patterned headscarf tied at the back, small gold earrings, a faint knowing smile with the mouth closed, a faded embroidered dress collar.
```
- `naama-idle.mp4`, `naama-talk.mp4` — из `naama.png`.

**A3. Док Ави — врач Беэр-Шевы**
- `doctor.png`:
```
[PORTRAIT] A tired Israeli field doctor in his late 40s, short greying hair, round wire-rimmed glasses, calm intelligent eyes with dark circles, a washed-out white doctor's coat over an olive military chest rig, a stethoscope around his neck.
```
- `doctor-idle.mp4`, `doctor-talk.mp4` — из `doctor.png`.

### B. Иконки — приоритет 2 (папка `icons`, квадрат 1:1, мин. 512 px)

Шаблон (вместо `{ITEM}` — описание):
```
Inventory icon for a 1998 CRPG like Fallout 2: {ITEM}, three-quarter view, centred, isolated on a pure black background, pre-rendered 3D look with painted realistic textures, worn and dusty, warm light from the upper left. Square image. No text, no shadow on the background.
```
Сделай только те, которых ещё нет в папке `icons`: `sting.png`, `machete.png`, `uzi.png`, `sawnoff.png`, `galil.png`, `shell.png`, `ammo556.png`, `tireArmor.png`, `metalArmor.png`. Описания — в задании `CLAUDE_CHROME_SPRITES.md`, раздел F; если его нет под рукой — пропусти этот раздел.

### C. Фон города — приоритет 3 (папка `backgrounds`)

Нужна заготовка `beersheba-blockout` — пользователь заранее загрузит её в галерею проекта «Хамсин». Если её там нет — пропусти этот пункт и напиши об этом в отчёте.

`beersheba.png` — картинка **с референсом** `beersheba-blockout` (как ингредиент или исходник для редактирования), соотношение сторон как у заготовки (ближе всего 1:1), максимальное разрешение:
```
Repaint this 3D blockout into a finished, highly detailed game background. KEEP EXACTLY the same composition, camera angle, framing, image size, and the position, size and silhouette of every object — every shipping container, building, palm, car, stall, barrel and sandbag must stay exactly where they are. Only replace the flat placeholder materials with realistic detail:
- ground: packed desert sand and dust of a busy market town, trodden paths, scattered litter, old tyre tracks;
- the coloured boxes: rusty dented steel shipping containers in faded red, blue, green and ochre, with corrugated walls, peeling paint and stencilled numbers without readable text; tall boxes are two containers stacked;
- the big stone building at the top: an old Ottoman-era railway station of pale limestone blocks with arched windows, partly ruined, tiled floor covered with sand inside;
- the small building at the bottom left: a tea house of whitewashed plaster with a patched canvas awning over the door, low stools inside;
- the white box at the bottom right: a white-painted clinic container with a faded red Star of David painted on the door;
- the low brown boxes in the middle: wooden market stalls with patched cloth awnings, crates of dates and spare parts;
- the car: a rusted 1960s Susita station wagon without wheels;
- palms: dusty date palms; sandbags: worn sandbag barricades at the town gate on the left.
Keep the black area outside the map black. Do not add any people, animals or text.
[STYLE]
```

## 5. Отчёт

В документ «Отчёт генерации» (папка «Ассеты Фоллаут») добавь раздел **«Беэр-Шева»**: по строке на файл — `имя — готово / не удалось (почему) — заметка`. В конце: сколько кредитов потрачено и какие файлы остались в «Загрузках». Сообщи пользователю, что всё готово.
