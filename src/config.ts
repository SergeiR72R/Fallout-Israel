// Геометрия камеры и мира.
//
// Классическая изометрия 2:1 (как в Fallout 2 «на глаз», Diablo 2, Baldur's Gate):
// поворот 45°, наклон 30°, стены идут по двум диагоналям с наклоном 1:2.
// Именно в этом ракурсе стабильно рисуют генераторы картинок (проверено на
// библии стиля из Flow), поэтому фоны ложатся на игровую сетку без подгонки.
//
// Точный ракурс Fallout 2 (тайл 80×36, асимметричные диагонали 1:4 и 3:4):
//   CAM_YAW = Math.PI / 6, CAM_PITCH = Math.asin(Math.sqrt(3) / 4).

export const CAM_YAW = Math.PI / 4;
export const CAM_PITCH = Math.PI / 6;
export const SIN_PITCH = Math.sin(CAM_PITCH);

/** Радиус гекса (центр → вершина) в метрах. Гекс шириной 1 м, как в Fallout: человек ≈ 1.7 гекса ростом на экране. */
export const HEX_R = 0.5;

/** Пикселей на метр при высоте экрана 1080. При 1440p/4K всё масштабируется пропорционально. */
export const PPU_1080 = 90;

export const WALK_SPEED = 2.6; // м/с
export const RUN_SPEED = 5.0;

export const GAME_TITLE = 'ХАМСИН';
export const GAME_SUBTITLE = 'постъядерная ролевая игра';
