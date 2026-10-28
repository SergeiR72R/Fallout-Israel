# Задание для Claude в Chrome: пробные кадры анимации героя в Google Flow

Ты работаешь в браузере пользователя. Задача: проверить, может ли Google Flow (https://labs.google/fx/tools/flow) нарисовать кадры анимации главного героя изометрической RPG «Хамсин» (стиль Fallout 2). Результат сравнят со спрайтами из Blender. Нужен **только главный герой**, никаких других персонажей.

Работай по списку сверху вниз: он по приоритету. Если кредиты кончатся, важное уже будет сделано.

---

## 1. Правила

### 1.1. Подготовка
1. На Google Диске в папке **«Ассеты Фоллаут»** создай подпапку `sprites-test`.
2. В той же папке открой документ **«Отчёт генерации»** (если его нет — создай) и добавь в конец раздел **«Спрайты героя»** для отчёта (раздел 5).
3. Во Flow открой проект **«Хамсин»** (если его нет — создай).

### 1.2. Генерация
- Промпты ниже на английском. **Копируй их целиком, без перевода и сокращений.** Блоки `[HERO]`, `[VIEW]` и `[BG]` подставляй из раздела 2 дословно.
- Картинки: **самая качественная модель изображений** во Flow, **максимальное разрешение**. По 2–4 варианта на промпт.
- Видео: модель видео Flow (Veo), **1080p**, 16:9. По 2 варианта на промпт, если хватает кредитов.
- Где сказано «с референсом», добавь картинку `hero-ref` из галереи проекта как ингредиент (Ingredients) или как первый кадр (Frames to video), смотря что указано. Загружать файлы с компьютера не нужно — бери из галереи Flow.
- На ассет максимум 3 попытки. Не получилось — отметь в отчёте «не удалось» и иди дальше.

### 1.3. Сохранение
- Скачай выбранный вариант в максимальном качестве, переименуй **точно как указано** (латиница, строчные) и положи в `Ассеты Фоллаут/sprites-test`.
- Если загрузить на Диск не получается, оставь файлы в «Загрузках» с правильными именами и перечисли их в отчёте.
- Upscayl не запускай.

### 1.4. Чего не делать
- Не покупай кредиты и не меняй тариф.
- Не меняй и не удаляй чужие файлы, ничем не делись.

---

## 2. Общие блоки (подставлять дословно)

**[HERO]**
```
The character: a lean young man about 24 years old, light olive-brown skin, short dark-brown hair, clean-shaven. He wears a dark navy-blue one-piece utility jumpsuit with a bright orange vertical stripe down the centre of the chest along the zipper, a dark charcoal collar and cuffs, long sleeves. A worn brown leather belt with two small pouches, an empty brown leather pistol holster on his right hip. Scuffed dark-brown leather work boots. Realistic proportions, about 7.5 heads tall. Gritty, dusty, pre-rendered 1990s CRPG look like the characters of Fallout 2 (1998), realistic materials, soft painterly detail. No text, no logos, no weapons in hands.
```

**[VIEW]**
```
Camera: orthographic isometric game camera looking down at the character from 30 degrees above the horizon (like the camera in Fallout 2 and Diablo 2), no perspective distortion. Full body visible from head to boots, the character small and centred in the frame with plenty of empty space around him, the feet always at the same spot in the lower middle of the frame. Light from the upper left.
```

**[BG]**
```
Background: one perfectly flat, uniform pure chroma-key green colour (#00FF00) filling the whole frame, no floor, no horizon, no gradient, no texture, no shadow on the background, no props.
```

**[NEGATIVE]** — если во Flow есть поле «что исключить»:
```
perspective, fisheye, close-up, cropped feet, cropped head, floor, ground, shadow, text, letters, watermark, UI, cartoon, anime, cel shading, extra limbs, extra fingers, weapon, gun in hand
```

---

## 3. Как выбирать

- Герой **целиком** в кадре, ноги не обрезаны, вокруг пустое место.
- Ракурс — **сверху под углом** (видна макушка и плечи сверху), а не строго сбоку и не снизу.
- Фон — **ровный зелёный**, без пола, теней и градиента.
- Одежда как в описании: тёмно-синий комбинезон, **оранжевая полоса по центру груди**, коричневый ремень, кобура справа, коричневые ботинки.
- Анатомия без ошибок: две руки, две ноги, пять пальцев, нормальные колени и стопы.
- В видео: камера **неподвижна**, герой **идёт на месте** (как на беговой дорожке) и **не уходит из кадра**, ноги **шагают** (колени сгибаются, стопы отрываются от земли), руки **свободно качаются вдоль тела**, а не сложены перед собой.

---

## 4. Список

### A. Эталон героя — приоритет 1

1. `hero-ref.png` — картинка 1:1, мин. 2048×2048.
```
[HERO] He stands in a relaxed neutral pose, arms hanging naturally at his sides, three-quarter view facing toward the lower right of the image. [VIEW] [BG]
```
Выбери самый удачный вариант — он станет эталоном для всего остального.

2. `hero-turnaround.png` — картинка 16:9, мин. 2752×1536, **с референсом** `hero-ref` (как ингредиент).
```
Character turnaround sheet of the same character: six full-body views of him standing in a relaxed neutral pose with arms at his sides, evenly spaced in one row, rotated in 60-degree steps: facing toward the viewer, facing lower right, facing upper right, facing away from the viewer, facing upper left, facing lower left. All six exactly the same size, the feet of all six on one horizontal line. [HERO] [VIEW] [BG]
```

### B. Видео ходьбы на месте — приоритет 2

Режим **Frames to video**: первый кадр — `hero-ref` (или вариант из `hero-turnaround` в нужном направлении, если Flow позволяет выбрать часть картинки — если нет, просто `hero-ref`). Если первый кадр нельзя задать, используй `hero-ref` как ингредиент.

3. `hero-walk-se.mp4` — к зрителю вправо-вниз.
```
The character walks in place on the spot, as if on an invisible treadmill, with a natural relaxed walking cycle: legs stepping with clearly bending knees, feet lifting off and landing heel first, arms swinging loosely at his sides opposite to the legs, slight up-and-down bob of the body. He faces toward the lower right of the frame the whole time and never moves across the frame. The camera is completely locked, no zoom, no pan. [VIEW] [BG] [HERO]
```

4. `hero-walk-s.mp4` — прямо к зрителю. Тот же промпт, но замени `faces toward the lower right of the frame` на `faces straight toward the viewer`.

5. `hero-walk-n.mp4` — от зрителя. Тот же промпт, но замени на `faces straight away from the viewer, we see his back`.

6. `hero-walk-e.mp4` — вправо, профиль. Тот же промпт, но замени на `faces to the right of the frame, seen in side profile from above`.

### C. Видео бега на месте — приоритет 3

7. `hero-run-se.mp4` — с первым кадром `hero-ref`.
```
The character runs in place on the spot, as if on an invisible treadmill, with an energetic running cycle: knees lifting high, feet pushing off, elbows bent at 90 degrees and arms pumping forward and back along his sides, body leaning slightly forward. He faces toward the lower right of the frame the whole time and never moves across the frame. The camera is completely locked, no zoom, no pan. [VIEW] [BG] [HERO]
```

### D. Раскадровка ходьбы картинкой — приоритет 4 (для сравнения)

8. `hero-walk-sheet.png` — картинка 16:9, мин. 2752×1536, **с референсом** `hero-ref` (как ингредиент).
```
Sprite sheet for a 1998 isometric CRPG: one row of eight full-body frames of the same character showing one complete walking cycle, left to right: contact, down, passing, up, contact with the other leg, down, passing, up. In every frame he faces toward the lower right, legs clearly stepping with bending knees, arms swinging loosely at his sides opposite to the legs. All eight frames exactly the same size and evenly spaced, the feet on one horizontal line. [HERO] [VIEW] [BG]
```

### E. Стрельба — приоритет 5

9. `hero-shoot-se.mp4` — с первым кадром `hero-ref`.
```
The character quickly draws a 9mm pistol from the holster on his right hip, raises it with both hands toward the lower right, fires one shot with a small muzzle flash and recoil, then lowers the pistol. He stays on the same spot. The camera is completely locked, no zoom, no pan. [VIEW] [BG] [HERO]
```

### F. Иконки предметов — приоритет 6 (не спрайты, но нужны игре)

Квадрат 1:1, мин. 512 px. Клади в папку `Ассеты Фоллаут/icons` (не в `sprites-test`). Здесь блоки `[HERO]`, `[VIEW]`, `[BG]` **не нужны**. Шаблон промпта (вместо `{ITEM}` подставь описание из таблицы):
```
Inventory icon for a 1998 CRPG like Fallout 2: {ITEM}, three-quarter view, centred, isolated on a pure black background, pre-rendered 3D look with painted realistic textures, worn and dusty, warm light from the upper left. Square image. No text, no shadow on the background.
```
Хороший вариант: один предмет по центру на **чисто чёрном** фоне, без текста.

| Файл | {ITEM} |
|---|---|
| `sting.png` | the severed glossy black stinger of a giant scorpion, curved, with a sharp tip and a drop of venom |
| `machete.png` | a long rusty machete with a wide blade and a wrapped leather handle |
| `uzi.png` | a worn Uzi submachine gun with a scratched black finish, folded metal stock and a long magazine |
| `sawnoff.png` | a sawn-off double-barrel shotgun with short cut barrels and a worn wooden stock |
| `galil.png` | a worn Israeli Galil assault rifle with a folding stock, carry handle and bipod |
| `shell.png` | a handful of red 12-gauge shotgun shells with brass bases |
| `ammo556.png` | a small stripper clip of 5.56 mm rifle cartridges with brass casings |
| `tireArmor.png` | crude body armour made of cut car tyre pieces wired together into a vest |
| `metalArmor.png` | crude body armour made of hammered car body sheet metal plates riveted together |

---

## 5. Отчёт

В раздел «Спрайты героя» документа «Отчёт генерации» для каждого файла запиши одну строку:

`имя файла — готово / не удалось (почему) — заметка (что получилось хорошо, что плохо: ракурс, фон, ноги, руки)`

В конце: сколько кредитов потрачено (если видно) и какие файлы остались в «Загрузках». Потом сообщи пользователю, что всё готово.
