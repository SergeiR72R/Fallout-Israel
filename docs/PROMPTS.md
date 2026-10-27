# Промпты для Google Flow

Промпты написаны на английском: генераторы изображений и видео понимают его лучше всего. Пояснения на русском.

**Главное правило: единый стиль.** К каждому промпту картинки добавляйте в конец блок **STYLE**. К каждому фону добавляйте ещё блок **CAMERA** и прикрепляйте эталон ракурса `docs/guides/grid.png`.

---

## 0. Общие блоки (копировать в конец промптов)

**STYLE**
```
Art style: 1990s pre-rendered isometric CRPG, exactly like Fallout 2 (1998) and Fallout 1 (1997). Gritty, dusty, post-apocalyptic. Desaturated warm palette: sand, ochre, rust, olive drab, bone white, weathered concrete grey. Hard late-afternoon sunlight from the upper left, soft long shadows falling to the lower right. Slightly grainy, painterly-realistic textures, worn and sun-bleached surfaces. Retro-futuristic 1960s–70s Israeli aesthetic frozen in time. No text, no letters, no UI, no watermark, no logos.
```

**CAMERA** (только для фонов локаций)
```
Camera: classic 2:1 isometric game view, orthographic, no perspective distortion, parallel lines stay parallel. Camera rotated 45 degrees and tilted 30 degrees down from the horizon, so building walls follow the two diagonals of the image at a 1:2 slope (26.6 degrees). Match the camera angle and scale of the attached reference image exactly.
```

> Ракурс сверен по вашей библии стиля: Flow сам рисует именно так, и игра теперь использует тот же угол.

**NEGATIVE** (если в Flow есть поле «чего избегать»)
```
perspective, fisheye, vanishing point, top-down flat view, side view, characters, people, animals, text, letters, signature, watermark, UI, HUD, blurry, cartoon, anime, cel shading, neon, modern cars, smartphones
```

---

## 1. Библия стиля (сделать первой)

Цель — 8–10 картинок, по которым мы утвердим вид игры. **Первая партия (S1–S3) получена и одобрена** — лежит в `assets/incoming/style/`. Сгенерируйте по 2–4 варианта каждого промпта и выберите лучшие. Прикрепите `docs/guides/grid.png` как референс ракурса.

**S1. Руины кибуца, общий вид**
```
Isometric game background of a ruined kibbutz in the northern Negev desert, 100 years after a nuclear war. A rusty concrete water tower on four legs, a half-collapsed communal dining hall with 1960s brutalist concrete walls, dry palm trees, a rusted three-wheeled Tempo pickup truck, sandbags, scattered rubble, cracked dry earth with footpaths. Empty scene, no people.
[STYLE] [CAMERA]
```

**S2. Вход в миклат (убежище)**
```
Isometric game background: entrance to an underground civil-defense shelter ("miklat") half-buried in desert sand. Heavy round steel blast hatch with the number 7 stencilled on it, concrete ventilation shafts, a faded Hebrew warning sign (illegible), rusted barbed wire, wind-blown sand drifts. Empty scene, no people.
[STYLE] [CAMERA]
```

**S3. Интерьер миклата**
```
Isometric game interior: corridor of a 1960s Israeli underground fallout shelter, bare concrete walls painted pale green on the lower half, yellow emergency lamps in wire cages, rows of steel bunk beds, a large industrial water desalination unit with pipes and pressure gauges, a massive circular blast door. Cutaway view with no ceiling, like Fallout 2 interiors. Empty scene, no people.
[STYLE] [CAMERA]
```

**S4. Рынок Беэр-Шевы**
```
Isometric game background: post-apocalyptic trading town built from rusted shipping containers and the ruins of an old Ottoman-era stone railway station. Market stalls under patched tarps, camel hitching posts, water barrels, a scrap-metal watchtower, hand-painted signs without readable text. Empty scene, no people.
[STYLE] [CAMERA]
```

**S5. Солёные равнины Мёртвого моря**
```
Isometric game background: cracked white salt flats of the Dead Sea at dusk, crusted salt formations, a ruined mineral factory with collapsed conveyor belts and rusted silos, a dried-up shoreline with stranded boats. Empty scene, no people.
[STYLE] [CAMERA]
```

---

## 2. Фон первой локации: перерисовка заготовки (основной способ)

**Как это работает.** Я строю локацию из простых 3D-блоков. Вы перерисовываете картинку во Flow в финальный арт, сохраняя композицию. После этого стены, проходы и предметы на картинке совпадают с игровой сеткой. Персонажи заходят за стены, а пули упираются в укрытия.

Файлы-заготовки:
- `docs/guides/kibbutz-blockout.png` — цветная заготовка;
- `docs/guides/kibbutz-clay.png` — серая «пластилиновая» версия. Попробуйте обе: иногда серая перерисовывается чище.

Порядок:
1. В Flow откройте генерацию **изображения** и прикрепите заготовку как референс/исходник (редактирование изображения).
2. Вставьте промпт ниже.
3. Сохраните результат в **максимальном разрешении**. Если Flow даёт меньше 3500 пикселей по ширине, увеличьте картинку вдвое любым апскейлером (например, бесплатным Upscayl).
4. Загрузите файл как `assets/incoming/backgrounds/kibbutz.png`.

**B1. Кибуц Нахаль-Ор (перерисовка заготовки)** — ✅ сделано, способ работает: перерисовка совпала с заготовкой почти до пикселя.
```
Repaint this 3D blockout into a finished, highly detailed game background. KEEP EXACTLY the same composition, camera angle, framing, image size, and the position, size and silhouette of every object — every wall, doorway, the water tower, palms, truck, barrels, crates, sandbags and rubble must stay exactly where they are. Only replace the flat placeholder materials with realistic detail:
- ground: dry cracked desert earth and sand with trodden footpaths, small stones, tufts of dead grass;
- walls: ruined 1960s kibbutz buildings of whitewashed concrete and plaster, cracked, stained, partly collapsed, exposed rebar, broken window frames;
- the floor inside the ruins: old patterned floor tiles covered with sand;
- water tower: rusted concrete tank on concrete legs, streaks of rust and water stains;
- palms: dry date palms with drooping brown fronds;
- the truck: a rusted 1960s three-wheeled Tempo pickup, faded blue paint;
- crates: one wooden orange crate, one olive-green military ammo crate with a padlock.
Keep the black area outside the map black. Do not add any people, animals or text.
[STYLE]
```

> Если Flow «уплывает» от композиции, ослабьте творческую свободу (если есть такая настройка) или перерисовывайте частями: я могу нарезать заготовку на 4 фрагмента.

---

## 3. Персонажи для 3D-моделей

Схема: картинка-«разворот» (turnaround) → сервис «картинка → 3D» (Meshy, Tripo или Hunyuan3D) → автоматический риг и анимации в Mixamo (бесплатно, только для людей).

Требования к картинке: персонаж целиком, в A-позе (руки слегка разведены), ровный светлый фон, мягкий свет без жёстких теней, без оружия в руках (оружие — отдельной моделью).

**C1. Герой (мужчина)**
```
Character turnaround sheet for a 3D model: front view, side view and back view of the same character, full body, A-pose, arms slightly away from the body, standing on a plain light grey background, soft even studio lighting, no shadows. A young man of about 25, short dark hair, light stubble, Mediterranean features, lean build. Wears a blue-grey utility jumpsuit with a vertical orange stripe down the chest, a round patch with the number 7 on the left shoulder, a wide brown leather belt with pouches, dusty brown work boots. 1990s pre-rendered CRPG character design like Fallout 2, realistic proportions, gritty and worn. No weapons, no text.
```

**C2. Героиня (женщина)** — тот же промпт, но первые предложения заменить на:
```
A young woman of about 23, dark curly hair tied back, Mediterranean features, athletic build.
```

**C3. Батья — старейшина кибуца**
```
Character turnaround sheet for a 3D model: front, side and back view, full body, A-pose, plain light grey background, soft even lighting, no shadows. An elderly Israeli kibbutz woman about 70 years old, short white hair, deeply sun-tanned wrinkled face, sharp stern eyes, wiry build. Wears a faded blue cotton "tembel" bucket hat, a sun-bleached khaki work shirt with rolled sleeves, patched work trousers, old leather sandals, a knife in a sheath on her belt. 1990s pre-rendered CRPG character design like Fallout 2, realistic, gritty and worn. No text.
```

**C4. Шломо — часовой**
```
Character turnaround sheet for a 3D model: front, side and back view, full body, A-pose, plain light grey background, soft even lighting, no shadows. A bearded man in his 40s, very dark sun-tanned skin, thick black beard. Wears an old dented olive-green military helmet, a faded olive-drab 1970s army uniform with patches and repairs, a canvas ammo vest, heavy boots. 1990s pre-rendered CRPG character design like Fallout 2, realistic, gritty and worn. No weapons, no text.
```

**C5. Мародёр пустыни (враг)**
```
Character turnaround sheet for a 3D model: front, side and back view, full body, A-pose, plain light grey background, soft even lighting, no shadows. A post-apocalyptic desert raider: lean man with a shaved head and a dusty keffiyeh-style scarf over the lower face, scavenged armor made of a car tire, leather straps and sheet metal plates, mismatched gloves, goggles on the forehead. 1990s pre-rendered CRPG enemy design like Fallout 2, gritty, menacing. No weapons, no text.
```

**C6. Гигантский скорпион** (для 3D; анимировать его буду я сам, в Mixamo он не нужен)
```
3D model reference sheet of a giant mutant desert scorpion the size of a large dog: top view and side view on a plain light grey background, soft even lighting, no shadows. Sand-yellow and brown segmented chitin armor with scars, two large pincers, eight legs, a thick segmented tail curled up over the back with a glossy black stinger. Realistic, gritty, 1990s CRPG creature design like Fallout 2 radscorpions. No text.
```

**Анимации из Mixamo** (для людей; скачать в FBX, «With Skin» для первой, «Without Skin» для остальных):
`Idle`, `Walking`, `Running`, `Pistol Idle`, `Shooting` (пистолет), `Rifle Aiming Idle`, `Firing Rifle`, `Punching`, `Stabbing`, `Hit Reaction`, `Dying` (2 разных), `Picking Up`, `Talking`.

---

## 4. «Говорящие головы» для диалогов (портрет + видео)

Как в Fallout: ключевые персонажи говорят анимированным портретом. Схема: сначала **портрет-картинка**, потом из него **видео** (Flow → кадр в видео).

**H1. Портрет Батьи (картинка)**
```
Close-up head-and-shoulders portrait for a 1998 CRPG "talking head" dialogue screen, styled like the sculpted, pre-rendered talking heads of Fallout 1 and 2: slightly exaggerated, highly detailed, sculpted-clay realism with painted textures. An elderly Israeli kibbutz woman about 70, deeply wrinkled sun-tanned face, short white hair under a faded blue cotton tembel bucket hat, sharp stern but kind eyes, thin lips. Khaki work shirt collar. Dark warm-brown background with a soft vignette, warm key light from the upper left, rim light from the right. She looks straight at the viewer, mouth closed, neutral expression. 16:9 frame, face in the centre. No text.
```

**H2. Портрет Шломо (картинка)**
```
Close-up head-and-shoulders portrait for a 1998 CRPG "talking head" dialogue screen, styled like the sculpted, pre-rendered talking heads of Fallout 1 and 2: slightly exaggerated, highly detailed, sculpted-clay realism with painted textures. A tough bearded Israeli guard in his 40s, very dark sun-tanned skin, thick black beard, tired squinting eyes, a dented olive-green military helmet, faded olive uniform collar. Dark warm-brown background with a soft vignette, warm key light from the upper left. He looks straight at the viewer, mouth closed. 16:9 frame, face in the centre. No text.
```

**Видео из портрета (Veo в Flow).** Прикрепите портрет как **первый кадр**. Для каждого персонажа нужны два ролика по 8 секунд:

**V1. Ожидание (молчит)**
```
The character stays in the same framing, static locked-off camera, no camera movement, no zoom. Subtle idle motion only: breathing, slow blinking, small natural head movements, eyes look at the viewer. Mouth stays closed. Background unchanged. No music, no speech, seamless loop.
```

**V2. Разговор (говорит)**
```
The character stays in the same framing, static locked-off camera, no camera movement, no zoom. The character is talking calmly to the viewer: natural lip and jaw movement, small head nods and expressive eyebrows, occasional blinks. Background unchanged. No music, seamless loop.
```

Сохраните видео как `assets/incoming/portraits/batya-idle.mp4`, `batya-talk.mp4` и так же для остальных. Игра будет показывать «говорящий» ролик, пока печатается реплика, и «ожидание» — пока вы выбираете ответ.

---

## 5. Иконки предметов

Требования: предмет по центру, вид три четверти, **чистый чёрный фон** (я вырежу его сам), квадрат, без теней на фоне.

Шаблон:
```
Inventory icon for a 1998 CRPG like Fallout 2: [ПРЕДМЕТ], three-quarter view, centred, isolated on a pure black background, pre-rendered 3D look with painted realistic textures, worn and dusty, warm light from the upper left. Square image. No text, no shadow on the background.
```

Вместо [ПРЕДМЕТ] подставьте:

| Файл | Предмет |
|---|---|
| `pistol9.png` | a worn 9mm semi-automatic pistol with a scratched black finish and a wooden grip |
| `knife.png` | an old military combat knife with a serrated edge and a worn olive handle |
| `ammo9.png` | a small cardboard box of 9mm pistol cartridges, a few brass bullets lying in front |
| `stim.png` | a military auto-injector syringe tube with an olive body and a red cap |
| `loof.png` | a dented olive-green military meat ration can with a faded label without text |
| `jacket.png` | a worn brown leather jacket with patched elbows |
| `vest.png` | an olive-green military ballistic vest with ceramic plates, one plate cracked |
| `sting.png` | the severed glossy black stinger of a giant scorpion |
| `asimon.png` | a stack of old brass telephone tokens, each with a slot cut through the middle |

Загрузите в `assets/incoming/icons/`.

---

## 6. Главное меню и вступление

**M1. Фон главного меню (картинка, 16:9)**
```
Cinematic matte painting for a video game main menu, 16:9: a ruined kibbutz water tower silhouetted against a blood-orange dusty sunset sky over the Negev desert, a violent sandstorm (khamsin) rolling in on the horizon, broken palm trees, the rusted round blast hatch of an underground shelter in the foreground sand. Empty left third of the image for the menu. Moody, gritty, 1990s CRPG box-art feel like Fallout 2. No text, no people.
```

**Вступительный ролик (Veo, 6 сцен по 8 секунд).** Каждая сцена — отдельная генерация. Потом я соберу их с текстом и голосом за кадром.

1. ```Slow cinematic push-in on a peaceful 1960s-style Israeli kibbutz at golden hour, children's swings, a water tower, palm trees. Suddenly the whole sky flashes pure white and everything is washed out. Retro film grain, muted colors, no text.```
2. ```Inside a 1960s concrete civil-defense shelter, families in retro clothes hurry down narrow stairs, a heavy round steel blast door marked with the number 7 slowly swings shut with a deep echo. Flickering yellow lamps, film grain, no text.```
3. ```A howling desert sandstorm sweeps over the ruins of a city, skeletons of buildings, rusted cars half-buried in sand, the sun a dim red disc. Slow drone shot, film grain, no text.```
4. ```Close-up of an old industrial water desalination machine inside a concrete bunker: a pressure gauge needle drops, a cracked filter membrane leaks drops of water, a red warning lamp starts blinking. Moody, film grain, no text.```
5. ```A council of tired people in blue-grey jumpsuits with orange stripes stands in a dim concrete hall and turns to look at one young person standing alone in the centre. Dramatic lighting, film grain, no text.```
6. ```The round steel hatch of an underground shelter opens from inside, blinding desert sunlight floods in, a silhouette in a jumpsuit climbs out into the dust storm and looks at the ruined kibbutz. Film grain, no text.```

Сохраните как `assets/incoming/video/intro-1.mp4` … `intro-6.mp4`.

---

## 7. Текстуры интерфейса (по желанию)

**U1. Металл панели (бесшовная текстура)**
```
Seamless tileable texture of an old worn industrial metal panel, dark gunmetal grey with brown rust stains, scratches, chipped paint, rivets along the edges, flat front view, even lighting, square. No text.
```

---

## Технические требования (коротко)

| Что | Формат | Размер | Куда |
|---|---|---|---|
| Фон локации | PNG | как заготовка, лучше ×2 | `assets/incoming/backgrounds/` |
| Разворот персонажа | PNG | от 1024 по высоте | `assets/incoming/characters/` |
| 3D-модель | GLB (или FBX) | — | `assets/incoming/models/` |
| Анимации Mixamo | FBX | — | `assets/incoming/models/<имя>/` |
| Портрет | PNG | 16:9, от 1920 | `assets/incoming/portraits/` |
| Видео головы | MP4 | 16:9, 8 с | `assets/incoming/portraits/` |
| Иконка | PNG | квадрат, от 512 | `assets/incoming/icons/` |
| Видео вступления | MP4 | 16:9 | `assets/incoming/video/` |
