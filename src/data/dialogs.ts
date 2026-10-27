// Диалоги в стиле Fallout: ветки, проверки навыков без подсказок,
// особые реплики для героя с низким Интеллектом.

import type { SkillId, StatId } from '../rules/stats';

export type QuestState = 'none' | 'active' | 'done';

export interface DialogCtx {
  flag(f: string): boolean;
  set(f: string): void;
  stat(id: StatId): number;
  skill(id: SkillId): number;
  quest(id: string): QuestState;
  setQuest(id: string, s: QuestState): void;
  give(item: string, qty: number): void;
  xp(n: number): void;
  /** Выбрать форму по полу героя: g('сделал', 'сделала'). */
  g(m: string, f: string): string;
  name: string;
  scorpionsDead(): boolean;
}

type T = string | ((c: DialogCtx) => string);

export interface DOption {
  text: T;
  show?: (c: DialogCtx) => boolean;
  next?: T;
  act?: (c: DialogCtx) => void;
}

export interface DNode {
  text: T;
  options: DOption[];
  onEnter?: (c: DialogCtx) => void;
}

export interface DialogDef {
  start: (c: DialogCtx) => string;
  nodes: Record<string, DNode>;
}

export const QUESTS: Record<string, { title: string; desc: (c: DialogCtx) => string }> = {
  tower: {
    title: 'Скорпионы у водонапорной башни',
    desc: (c) => (c.quest('tower') === 'done'
      ? 'Гнездо у башни уничтожено. Кибуц снова может брать воду.'
      : `Батья просит перебить гигантских скорпионов у водонапорной башни. Награда: ${c.flag('reward100') ? 100 : 50} асимонов.`),
  },
  membrane: {
    title: 'Мембрана для опреснителя',
    desc: (c) => (c.flag('knowsBeersheva')
      ? 'Найти мембрану для опреснителя миклата № 7. Батья советует искать Ицика-Мусорщика в Беэр-Шеве.'
      : 'Найти мембрану для опреснителя миклата № 7. Без неё убежище умрёт от жажды.'),
  },
};

const dumb = (c: DialogCtx) => c.stat('in') <= 3;
const smart = (c: DialogCtx) => c.stat('in') > 3;

export const DIALOGS: Record<string, DialogDef> = {
  batya: {
    start: (c) => {
      if (c.quest('tower') === 'active') return c.scorpionsDead() ? 'done' : 'progress';
      if (c.quest('tower') === 'done') return 'after';
      return c.flag('metBatya') ? 'again' : 'first';
    },
    nodes: {
      first: {
        onEnter: (c) => c.set('metBatya'),
        text: (c) => `Старуха в выцветшей панамке оглядывает вас с головы до ног.\n\n— Миклат открылся впервые за сто лет, и оттуда ${c.g('вылез мальчишка', 'вылезла девчонка')} в комбинезоне. Ну, здравствуй. Я Батья. Старшая в том, что осталось от Нахаль-Ора.`,
        options: [
          { text: 'Кто вы такие? Что здесь произошло?', show: smart, next: 'about' },
          { text: 'Я ищу мембрану для опреснителя. Без неё моё убежище умрёт от жажды.', show: smart, next: 'membrane' },
          { text: 'Ты бабушка? Я кушать хочу.', show: dumb, next: 'dumb' },
          { text: 'Мне пора.', next: 'end' },
        ],
      },
      again: {
        text: '— Снова ты. Чего тебе?',
        options: [
          { text: 'Расскажите ещё раз, что здесь случилось.', show: smart, next: 'about' },
          { text: 'Про мембрану…', show: (c) => smart(c) && !c.flag('knowsBeersheva'), next: 'membrane' },
          { text: 'Насчёт скорпионов…', show: smart, next: 'questOffer' },
          { text: 'Бабушка, дай кушать.', show: (c) => dumb(c) && !c.flag('gotLoof'), next: 'dumb' },
          { text: 'Ничего. До встречи.', next: 'end' },
        ],
      },
      about: {
        text: '— Что произошло? Война, вот что. Сто лет назад небо стало белым, а потом пришёл хамсин, который так и не кончился.\n\nМы — потомки тех, кто не успел добежать до миклатов. Живём тем, что даёт башня. Только к башне уже неделю не подойти: там гнездо скорпионов. Огромных, с собаку.',
        options: [
          { text: 'Я могу разобраться со скорпионами.', next: 'questOffer' },
          { text: 'А мембрана? Где её искать?', show: (c) => !c.flag('knowsBeersheva'), next: 'membrane' },
          { text: 'Понятно. До встречи.', next: 'end' },
        ],
      },
      membrane: {
        onEnter: (c) => c.set('knowsBeersheva'),
        text: '— Мембрана? Хм. Довоенные опреснители стояли на побережье, но туда никто не ходит — там светится по ночам.\n\nГоворят, торговцы в Беэр-Шеве меняют любую довоенную технику. Дойдёшь — спроси Ицика-Мусорщика. Но сначала помоги нам, а мы поможем тебе.',
        options: [
          { text: 'Чем помочь?', show: (c) => c.quest('tower') === 'none', next: 'questOffer' },
          { text: 'Спасибо. Мне пора.', next: 'end' },
        ],
      },
      questOffer: {
        text: (c) => (c.quest('tower') === 'active'
          ? '— Уговор уже есть. Иди к башне.'
          : '— Убей тварей у башни. Всех до одной. Заплачу пятьдесят асимонов.\n\nИ вот что: на складе стоит армейский ящик. Ключ потерян ещё при моей бабке. Сумеешь вскрыть — всё, что внутри, твоё.'),
        options: [
          { text: 'Договорились.', show: (c) => c.quest('tower') === 'none', act: (c) => c.setQuest('tower', 'active'), next: 'accepted' },
          {
            text: 'Пятьдесят асимонов за гнездо гигантских скорпионов? Вы шутите. Сто — и по рукам.',
            show: (c) => c.quest('tower') === 'none' && !c.flag('haggled'),
            act: (c) => c.set('haggled'),
            next: (c) => (c.skill('speech') >= 50 ? 'haggleOk' : 'haggleFail'),
          },
          { text: 'Мне это неинтересно.', show: (c) => c.quest('tower') === 'none', next: 'end' },
          { text: 'Иду.', show: (c) => c.quest('tower') === 'active', next: 'end' },
        ],
      },
      haggleOk: {
        onEnter: (c) => { c.set('reward100'); c.setQuest('tower', 'active'); },
        text: '— Ну и хуцпа! — Батья неожиданно смеётся. — Ладно. Сто. Но только если всех.',
        options: [{ text: 'По рукам.', next: 'end' }],
      },
      haggleFail: {
        text: '— Пятьдесят, и не торгуйся. Здесь тебе не шук.',
        options: [
          { text: 'Ладно, пятьдесят.', act: (c) => c.setQuest('tower', 'active'), next: 'accepted' },
          { text: 'Тогда без меня.', next: 'end' },
        ],
      },
      accepted: {
        text: '— Башня — на северо-востоке, за складом. Слышишь шуршание — значит, пришёл. Удачи, миклатник.',
        options: [{ text: 'Скоро вернусь.', next: 'end' }],
      },
      progress: {
        text: '— У башни всё ещё шуршат. Иди уже, пока вода не протухла.',
        options: [
          { text: 'Иду.', next: 'end' },
          { text: 'Расскажите про мембрану.', show: (c) => smart(c) && !c.flag('knowsBeersheva'), next: 'membrane' },
        ],
      },
      done: {
        onEnter: (c) => {
          c.setQuest('tower', 'done');
          c.give('asimon', c.flag('reward100') ? 100 : 50);
          c.xp(500);
        },
        text: (c) => `— Тишина у башни! Сто лет такой не было. Держи, ${c.g('заслужил', 'заслужила')}.\n\nБатья отсчитывает асимоны — по одному, будто прощается с каждым.`,
        options: [
          { text: 'Спасибо. Расскажите про мембрану.', show: (c) => !c.flag('knowsBeersheva'), next: 'membrane' },
          { text: 'Рад был помочь.', next: 'end' },
        ],
      },
      after: {
        text: (c) => `— Вода снова наша. Ты всегда ${c.g('желанный гость', 'желанная гостья')} в Нахаль-Оре, ${c.name}.`,
        options: [
          { text: 'Расскажите про мембрану.', show: (c) => !c.flag('knowsBeersheva'), next: 'membrane' },
          { text: 'До встречи.', next: 'end' },
        ],
      },
      dumb: {
        onEnter: (c) => { if (!c.flag('gotLoof')) { c.set('gotLoof'); c.give('loof', 1); } },
        text: '— Бедняжка… Сто лет взаперти, и вот что выросло. На, держи банку «Лоф» и иди с миром.',
        options: [{ text: 'Ням!', next: 'end' }],
      },
    },
  },
};
