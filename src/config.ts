// Геометрия камеры и мира.
//
// Ракурс снят с Fallout 2: тайл пола там 80×36 пикселей, его рёбра идут с
// наклоном 1:4 и 3:4. Ортографическая камера даёт ровно такую картинку при
// повороте на 30° относительно сетки тайлов и наклоне asin(√3/4) ≈ 25.66°.
// Все фоны для игры должны рисоваться в этом ракурсе (см. docs/guides).

export const CAM_YAW = Math.PI / 6;
export const CAM_PITCH = Math.asin(Math.sqrt(3) / 4);
export const SIN_PITCH = Math.sin(CAM_PITCH);

/** Радиус гекса (центр → вершина) в метрах. Гекс шириной 1 м, как в Fallout: человек ≈ 1.7 гекса ростом на экране. */
export const HEX_R = 0.5;

/** Пикселей на метр при высоте экрана 1080. При 1440p/4K всё масштабируется пропорционально. */
export const PPU_1080 = 90;

export const WALK_SPEED = 2.6; // м/с
export const RUN_SPEED = 5.0;

export const GAME_TITLE = 'ХАМСИН';
export const GAME_SUBTITLE = 'постъядерная ролевая игра';
