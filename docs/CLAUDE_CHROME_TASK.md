# Задание для Claude в Chrome: генерация ассетов «Хамсина» в Google Flow

Ты работаешь в браузере пользователя. Твоя задача — сгенерировать в Google Flow (https://labs.google/fx/tools/flow) ассеты для изометрической ролевой игры «Хамсин» (постъядерный Израиль, стиль Fallout 2), выбрать лучшие варианты и сохранить их в папку Google Диска **«Ассеты Фоллаут»** с правильными именами. В конце — короткий отчёт.

Работай по списку ниже сверху вниз. Список — по приоритету: если кредиты Flow или время закончатся, важное уже будет сделано.

---

## 1. Правила работы

### 1.1. Подготовка (один раз)
1. Открой Google Диск (https://drive.google.com). Если папки **«Ассеты Фоллаут»** нет — создай её в «Моём диске». Внутри создай подпапки: `portraits`, `icons`, `backgrounds`, `worldmap`, `video`, `upscale`.
2. Создай в папке «Ассеты Фоллаут» документ Google Docs **«Отчёт генерации»** — в него будешь записывать, что сделано (см. раздел 4).
3. Открой Google Flow, создай новый проект **«Хамсин»**.

### 1.2. Как генерировать
- Промпты ниже — на английском. **Копируй их целиком, без перевода и сокращений.** Блоки `[STYLE]`, `[CAMERA]` и `[PORTRAIT]` подставляй из раздела 2 — дословно.
- Для картинок выбирай **самую качественную модель изображений, доступную во Flow**, и **максимальное разрешение** (2K/4K, если есть). Соотношение сторон указано у каждого ассета.
- Генерируй **по 2–4 варианта** на промпт и выбирай лучший по критериям из раздела 3. Если ни один не подходит — перегенерируй (максимум 3 попытки на ассет, потом отметь в отчёте «не удалось» и иди дальше).
- Для видео используй модель видео Flow (Veo). Если есть выбор, ставь качество 1080p.
- Видео «говорящих голов» делай **из уже сгенерированного во Flow портрета** (режим «кадр → видео»: портрет как первый кадр). Портрет выбирай прямо из галереи проекта — загружать файл с компьютера не нужно.

### 1.3. Как сохранять
- Скачай выбранный вариант в максимальном доступном качестве (оригинал / upscaled, если Flow предлагает).
- Переименуй файл **точно как указано** в списке (латиница, строчные буквы) и положи в указанную подпапку на Google Диске.
- Если картинка меньше требуемого размера (указан у ассета как «мин.»), положи её **ещё и в подпапку `upscale`** — пользователь потом увеличит её в программе Upscayl пакетно. Запусти Upscayl сам ты не можешь — это программа на компьютере, не трогай её.
- Если загрузить файл на Диск через браузер не получается (окно выбора файла не открывается), оставь файлы в папке «Загрузки» с правильными именами и напиши в отчёте, какие файлы там лежат — пользователь перенесёт их сам.

### 1.4. Чего не делать
- Не меняй и не удаляй чужие файлы на Диске.
- Не покупай кредиты и не меняй тариф. Если кредиты кончаются — остановись и напиши об этом в отчёте.
- Не публикуй ничего и не делись ссылками.

---

## 2. Общие блоки (подставлять дословно)

**[STYLE]**
```
Art style: 1990s pre-rendered isometric CRPG, exactly like Fallout 2 (1998) and Fallout 1 (1997). Gritty, dusty, post-apocalyptic. Desaturated warm palette: sand, ochre, rust, olive drab, bone white, weathered concrete grey. Hard late-afternoon sunlight from the upper left, soft long shadows falling to the lower right. Slightly grainy, painterly-realistic textures, worn and sun-bleached surfaces. Retro-futuristic 1960s–70s Israeli aesthetic frozen in time. No text, no letters, no UI, no watermark, no logos.
```

**[CAMERA]**
```
Camera: classic 2:1 isometric game view, orthographic, no perspective distortion, parallel lines stay parallel. Camera rotated 45 degrees and tilted 30 degrees down from the horizon, so any walls and edges follow the two diagonals of the image at a 1:2 slope (26.6 degrees). Seen from high above like a classic isometric RPG map, the whole scene is in sharp focus.
```

**[PORTRAIT]**
```
Close-up head-and-shoulders portrait for a 1998 CRPG "talking head" dialogue screen, styled like the sculpted, pre-rendered talking heads of Fallout 1 and 2: slightly exaggerated, highly detailed, sculpted-clay realism with painted textures. Dark warm-brown background with a soft vignette, warm key light from the upper left, rim light from the right. The character looks straight at the viewer, mouth closed. 16:9 frame, face in the centre. No text.
```

**[NEGATIVE]** — если во Flow есть поле «что исключить»:
```
perspective, fisheye, vanishing point, side view, text, letters, signature, watermark, UI, HUD, blurry, cartoon, anime, cel shading, neon, modern cars, smartphones
```

---

## 3. Как выбирать лучший вариант

- **Фоны локаций:** ракурс строго изометрический (стены и края — по диагоналям картинки), **нет людей и животных**, нет текста, нет перспективы «уходящей вдаль». Большая часть площади — проходимая земля (песок, утоптанные тропы), препятствия не загромождают центр.
- **Портреты:** лицо по центру, рот закрыт, фон тёмный и однородный, нет текста, нет лишних рук и деформаций лица.
- **Видео голов:** камера неподвижна, лицо не «плывёт», нет текста и субтитров, в ролике «говорит» губы двигаются, в ролике «молчит» — нет.
- **Иконки:** один предмет по центру на **чисто чёрном** фоне, без теней на фоне и без текста.
- **Видео вступления:** соответствует описанию сцены, нет текста/субтитров/логотипов.

---

## 4. Отчёт

В документ «Отчёт генерации» для каждого ассета записывай одну строку:

`имя файла — готово / в upscale / не удалось (почему) — заметка`

В конце добавь: сколько кредитов Flow потрачено (если видно), какие файлы остались в «Загрузках», что стоит переделать.

---

## 5. Список ассетов

### A. «Говорящие головы» для диалогов — приоритет 1

Для каждого персонажа: портрет (картинка) → два видео из этого портрета.

**A1. Батья — старейшина кибуца**
- `portraits/batya.png` — 16:9, мин. 1920 px по ширине:
```
[PORTRAIT] An elderly Israeli kibbutz woman about 70, deeply wrinkled sun-tanned face, short white hair under a faded blue cotton tembel bucket hat, sharp stern but kind eyes, thin lips. Sun-bleached khaki work shirt collar.
```
- `portraits/batya-idle.mp4` — видео из `batya.png`, 8 секунд:
```
The character stays in the same framing, static locked-off camera, no camera movement, no zoom. Subtle idle motion only: breathing, slow blinking, small natural head movements, eyes look at the viewer. Mouth stays closed. Background unchanged. No music, no speech, no text, seamless loop.
```
- `portraits/batya-talk.mp4` — видео из `batya.png`, 8 секунд:
```
The character stays in the same framing, static locked-off camera, no camera movement, no zoom. The character is talking calmly to the viewer: natural lip and jaw movement, small head nods and expressive eyebrows, occasional blinks. Background unchanged. No music, no subtitles, no text, seamless loop.
```

**A2. Шломо — часовой кибуца**
- `portraits/shlomo.png` — 16:9:
```
[PORTRAIT] A tough bearded Israeli guard in his 40s, very dark sun-tanned skin, thick black beard, tired squinting eyes, a dented olive-green military helmet, faded olive 1970s army uniform collar and a canvas ammo vest strap.
```
- `portraits/shlomo-idle.mp4`, `portraits/shlomo-talk.mp4` — как у Батьи (те же промпты видео).

**A3. Мордехай — караванщик из Беэр-Шевы**
- `portraits/mordechai.png` — 16:9:
```
[PORTRAIT] A shrewd desert caravan trader in his 50s, weathered olive skin, grey-streaked short beard, clever calculating eyes with crow's feet, a faint knowing smile with the mouth closed, an old dusty olive military helmet pushed back, a heavy canvas vest with many pouches and a brass compass on a cord.
```
- `portraits/mordechai-idle.mp4`, `portraits/mordechai-talk.mp4` — те же промпты видео.

### B. Иконки предметов — приоритет 2

Все — квадрат 1:1, мин. 512 px, папка `icons/`. Шаблон промпта (вместо `{ITEM}` подставь описание из таблицы):
```
Inventory icon for a 1998 CRPG like Fallout 2: {ITEM}, three-quarter view, centred, isolated on a pure black background, pre-rendered 3D look with painted realistic textures, worn and dusty, warm light from the upper left. Square image. No text, no shadow on the background.
```

| Файл | {ITEM} |
|---|---|
| `icons/pistol9.png` | a worn 9mm semi-automatic pistol with a scratched black finish and a wooden grip |
| `icons/knife.png` | an old military combat knife with a serrated edge and a worn olive handle |
| `icons/ammo9.png` | a small cardboard box of 9mm pistol cartridges, a few brass bullets lying in front |
| `icons/stim.png` | a military auto-injector syringe tube with an olive body and a red cap |
| `icons/loof.png` | a dented olive-green military meat ration can with a faded label without text |
| `icons/water.png` | a dented aluminium army canteen with a canvas cover and a screw cap |
| `icons/jacket.png` | a worn brown leather jacket with patched elbows |
| `icons/vest.png` | an olive-green military ballistic vest with ceramic plates, one plate cracked |
| `icons/sting.png` | the severed glossy black stinger of a giant scorpion |
| `icons/asimon.png` | a stack of old brass telephone tokens, each with a slot cut through the middle |

### C. Фоны случайных встреч в пустыне — приоритет 3

Все — 16:9, **максимальное разрешение**, мин. 3000 px по ширине (меньше — дубль в `upscale/`). Папка `backgrounds/`. Это карты, по которым ходят персонажи: **нужно много свободной земли**.

**C1.** `backgrounds/desert-scorpions.png`
```
Isometric game background of an open stretch of the Negev desert after a nuclear war: wind-rippled sand and cracked dry earth, scattered boulders and a few low rock outcrops near the edges, dead thorny shrubs, the bleached skeleton of a camel, several shallow sand burrows with scattered bones in the right half — a giant scorpion nest. Lots of open walkable ground in the centre. Empty scene, no people, no animals.
[STYLE] [CAMERA]
```

**C2.** `backgrounds/desert-raiders.png`
```
Isometric game background: a raiders' camp beside a broken desert highway in the Negev: cracked asphalt with faded lane markings running diagonally, a burnt-out 1960s bus on its side, a smouldering campfire ring of stones, patched tarp lean-tos, rusty oil drums, a pile of looted crates, sandbag cover. Open walkable sand around the camp. Empty scene, no people, no animals.
[STYLE] [CAMERA]
```

**C3.** `backgrounds/desert-caravan.png`
```
Isometric game background: a caravan rest stop in the desert: a dry well with a stone rim and a wooden winch, an old acacia tree, a few bundles and water jerrycans stacked under a patched canvas awning, camel hitching posts, tracks of hooves and tyres in the sand. Lots of open walkable ground. Empty scene, no people, no animals.
[STYLE] [CAMERA]
```

**C4.** `backgrounds/desert-ruins.png`
```
Isometric game background: the ruins of a 1960s roadside petrol station in the Negev desert: a collapsed flat concrete canopy on pillars, two rusted fuel pumps without readable text, a small half-ruined whitewashed office building without a roof, scattered tyres and car parts, sand drifting over cracked concrete. Open walkable sand around it. Empty scene, no people, no animals.
[STYLE] [CAMERA]
```

### D. Карта мира — приоритет 4

**D1.** `worldmap/worldmap.png` — 16:10 (если нет 16:10 — 16:9), максимальное разрешение:
```
A hand-painted world map of the northern Negev desert for a 1998 post-apocalyptic CRPG world map screen, like the world map of Fallout 2, seen straight from above. The Mediterranean sea along the left edge with a sandy coastline, the long narrow Dead Sea near the right edge with white salt shores, rocky brown highlands in the south and east, dry riverbeds (wadis) winding across the sand, faded broken highways crossing the map diagonally, tiny ruined towns as dark dots. Muted ochre, sand and rust palette, slightly worn paper texture, subtle grid. No text, no labels, no legend, no compass rose, no UI.
```

### E. Вступительный ролик — приоритет 5

Шесть видео по 8 секунд, 16:9, папка `video/`, файлы `intro-1.mp4` … `intro-6.mp4`. Без текста и субтитров.

1. `video/intro-1.mp4`
```
Slow cinematic push-in on a peaceful 1960s-style Israeli kibbutz at golden hour, children's swings, a concrete water tower, palm trees. Suddenly the whole sky flashes pure white and everything is washed out. Retro film grain, muted colors, no text.
```
2. `video/intro-2.mp4`
```
Inside a 1960s concrete civil-defense shelter, families in retro clothes hurry down narrow stairs, a heavy round steel blast door marked with the number 7 slowly swings shut with a deep echo. Flickering yellow lamps, film grain, no text.
```
3. `video/intro-3.mp4`
```
A howling desert sandstorm sweeps over the ruins of a city, skeletons of buildings, rusted cars half-buried in sand, the sun a dim red disc. Slow drone shot, film grain, no text.
```
4. `video/intro-4.mp4`
```
Close-up of an old industrial water desalination machine inside a concrete bunker: a pressure gauge needle drops, a cracked filter membrane leaks drops of water, a red warning lamp starts blinking. Moody, film grain, no text.
```
5. `video/intro-5.mp4`
```
A council of tired people in blue-grey jumpsuits with orange stripes stands in a dim concrete hall and turns to look at one young person standing alone in the centre. Dramatic lighting, film grain, no text.
```
6. `video/intro-6.mp4`
```
The round steel hatch of an underground shelter opens from inside, blinding desert sunlight floods in, a silhouette in a jumpsuit climbs out into the dust storm and looks at the ruined kibbutz. Film grain, no text.
```

---

Когда закончишь (или кончатся кредиты) — допиши отчёт и сообщи пользователю: сколько ассетов готово, что лежит в `upscale/`, что не получилось.
