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
          { text: 'Можно у вас что-нибудь выменять?', next: 'barter' },
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
          { text: 'Можно у вас что-нибудь выменять?', next: 'barter' },
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
  trader: {
    start: (c) => (c.flag('metTrader') ? 'again' : 'first'),
    nodes: {
      first: {
        onEnter: (c) => c.set('metTrader'),
        text: '— Шалом, путник. Мордехай, караван из Беэр-Шевы. Вода, патроны, шприц-тюбики. Покупаю, продаю, не обманываю. Почти.',
        options: [
          { text: 'Покажи товар.', next: 'barter' },
          { text: 'Расскажи про Беэр-Шеву.', show: (c) => c.stat('in') > 3, next: 'beersheba' },
          { text: 'Ты не встречал мембрану для опреснителя?', show: (c) => c.stat('in') > 3, next: 'membrane' },
          { text: 'Ты дядя с водой? Дай воды!', show: (c) => c.stat('in') <= 3, next: 'dumb' },
          { text: 'Прощай.', next: 'end' },
        ],
      },
      again: {
        text: '— А, миклатник. Ещё жив? Хорошо для торговли.',
        options: [
          { text: 'Покажи товар.', next: 'barter' },
          { text: 'Расскажи про Беэр-Шеву.', show: (c) => c.stat('in') > 3, next: 'beersheba' },
          { text: 'Что слышно на побережье?', show: (c) => c.stat('in') > 3, next: 'coast' },
          { text: 'Прощай.', next: 'end' },
        ],
      },
      beersheba: {
        onEnter: (c) => c.set('knowsBeersheva'),
        text: '— Беэр-Шева — это контейнеры, рынок у старого турецкого вокзала и много людей, которые хотят твои асимоны. Иди на юго-восток по старому шоссе, не промахнёшься. Дня полтора пешком.',
        options: [
          { text: 'А мембрана?', next: 'membrane' },
          { text: 'Спасибо.', next: 'again' },
        ],
      },
      membrane: {
        onEnter: (c) => c.set('knowsBeersheva'),
        text: '— Мембрана… Довоенная техника — это к Ицику-Мусорщику. Он торгует на рынке Беэр-Шевы. Только у Ицика ничего не бывает дёшево.',
        options: [
          { text: 'Что ещё знаешь?', next: 'coast' },
          { text: 'Понятно.', next: 'again' },
        ],
      },
      coast: {
        onEnter: (c) => c.set('knowsCoast'),
        text: '— На побережье стоят большие опреснители, ещё довоенные. Только там всё светится, а у кого светятся руки — долго не живёт. Я туда не хожу. И тебе не советую.',
        options: [{ text: 'Учту.', next: 'again' }],
      },
      dumb: {
        text: '— Воды? Вода стоит асимонов, дружок. Асимоны есть? Нет? Тогда смотри и не трогай.',
        options: [{ text: 'Хочу смотреть!', next: 'barter' }, { text: 'Пока!', next: 'end' }],
      },
    },
  },
  shlomo: {
    start: (c) => (c.flag('metShlomo') ? 'again' : 'first'),
    nodes: {
      first: {
        onEnter: (c) => c.set('metShlomo'),
        text: (c) => `Часовой щурится, не убирая руку с пистолета.\n\n— Из миклата, значит. Сто лет никто оттуда не выходил, а теперь ${c.g('вылез', 'вылезла')}. Я Шломо. Стою у ворот, чтобы всякая дрянь из пустоши не лезла к нам.`,
        options: [
          { text: 'Что за дрянь?', next: 'danger' },
          { text: 'Где мне найти главного?', next: 'batya' },
          { text: 'Ты солдат?', show: (c) => c.stat('in') <= 3, next: 'dumb' },
          { text: 'Счастливо оставаться.', next: 'end' },
        ],
      },
      again: {
        text: '— Ну? Опять ты.',
        options: [
          { text: 'Что опасного в округе?', next: 'danger' },
          { text: 'Ничего, просто проходил мимо.', next: 'end' },
        ],
      },
      danger: {
        text: (c) => (c.scorpionsDead()
          ? '— У башни теперь тихо — твоя работа? Уважаю. А в пустоши — мародёры с дороги на Беэр-Шеву. Увидишь дым костра у шоссе — обходи.'
          : '— У водонапорной башни — гнездо скорпионов. Здоровые, как собаки. Одна матка — с телёнка. А дальше, в пустоши, — мародёры. Увидишь дым костра у шоссе — обходи.'),
        options: [{ text: 'Спасибо, учту.', next: 'end' }],
      },
      batya: {
        text: '— Главная у нас Батья. У столовой её найдёшь, в синей панамке. Только не спорь с ней — она этого не любит.',
        options: [{ text: 'Понял.', next: 'end' }],
      },
      dumb: {
        text: '— Солдат, солдат. Иди уже, не мешай службе.',
        options: [{ text: 'Есть!', next: 'end' }],
      },
    },
  },
};

