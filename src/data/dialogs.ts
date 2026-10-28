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
  /** Сколько предметов у героя; take забирает и возвращает, сколько забрал. */
  count(item: string): number;
  take(item: string, qty: number): number;
  /** Сколько ОЖ не хватает до полного; heal без числа лечит полностью. */
  hurt(): number;
  heal(n?: number): void;
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
    desc: (c) => (c.flag('membraneLead')
      ? 'Найти мембрану для опреснителя миклата № 7. Ицик-Мусорщик говорит, что мембраны хранились на складе опреснительного завода в Ашдоде, на побережье. Там «светится».'
      : c.flag('knowsBeersheva')
      ? 'Найти мембрану для опреснителя миклата № 7. Батья советует искать Ицика-Мусорщика в Беэр-Шеве.'
      : 'Найти мембрану для опреснителя миклата № 7. Без неё убежище умрёт от жажды.'),
  },
  stings: {
    title: 'Жала для Ицика',
    desc: (c) => (c.quest('stings') === 'done'
      ? 'Ицик получил жала и рассказал, где искать мембрану.'
      : `Ицик-Мусорщик в Беэр-Шеве просит три жала гигантских скорпионов. Взамен расскажет, где искать мембрану, и заплатит 100 асимонов. Сейчас у вас: ${Math.min(3, c.count('sting'))} из 3.`),
  },
};

const dumb = (c: DialogCtx) => c.stat('in') <= 3;
/** Сколько берёт Док Ави за лечение. */
const healCost = (c: DialogCtx) => Math.max(10, c.hurt() * 2);
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
  bsGuard: {
    start: (c) => (c.flag('metBsGuard') ? 'again' : 'first'),
    nodes: {
      first: {
        onEnter: (c) => c.set('metBsGuard'),
        text: '— Стой. Комбинезон приметный — из миклата, значит. Это Беэр-Шева. Правила простые: оружие в городе не доставать, драку начнёшь — весь город против тебя. Торгуй, пей чай, плати врачу. Всё.',
        options: [
          { text: 'Кто здесь торгует довоенной техникой?', show: smart, next: 'itzik' },
          { text: 'Где можно отдохнуть?', show: smart, next: 'tea' },
          { text: 'У тебя большая пушка!', show: dumb, next: 'dumb' },
          { text: 'Понял.', next: 'end' },
        ],
      },
      again: {
        text: '— Правила помнишь? Вот и хорошо.',
        options: [
          { text: 'Где найти довоенную технику?', show: smart, next: 'itzik' },
          { text: 'Где отдохнуть и подлечиться?', show: smart, next: 'tea' },
          { text: 'Помню.', next: 'end' },
        ],
      },
      itzik: {
        text: '— Ицик-Мусорщик. Сидит на рынке перед старым вокзалом. Сто раз подумай, прежде чем ему верить, и пересчитай сдачу.',
        options: [{ text: 'Спасибо.', next: 'again' }],
      },
      tea: {
        text: '— Чайхана Наамы у южной стены. Слухи там бесплатно, вода — нет. Ранен — иди к Доку Ави, белый контейнер справа.',
        options: [{ text: 'Спасибо.', next: 'again' }],
      },
      dumb: {
        text: '— Большая. И стреляет. Иди уже.',
        options: [{ text: 'Иду!', next: 'end' }],
      },
    },
  },
  itzik: {
    start: (c) => {
      if (c.quest('stings') === 'active') return c.count('sting') >= 3 ? 'stingsReady' : 'stingsWait';
      if (c.quest('stings') === 'done') return 'after';
      return c.flag('metItzik') ? 'again' : 'first';
    },
    nodes: {
      first: {
        onEnter: (c) => c.set('metItzik'),
        text: (c) => `Худой человек сдвигает лупу на лоб и разглядывает вас, как товар.\n\n— Ицик. Покупаю всё, что старше ста лет, продаю всё, что ещё стреляет. Чего ${c.g('хочет миклатник', 'хочет миклатница')}?`,
        options: [
          { text: 'Мне нужна мембрана для опреснителя.', show: (c) => smart(c) && !c.flag('membraneLead'), next: 'membrane' },
          { text: 'Покажи товар.', next: 'barter' },
          { text: 'Ты мусорщик? Фу!', show: dumb, next: 'dumb' },
          { text: 'Ничего.', next: 'end' },
        ],
      },
      again: {
        text: '— Опять ты. Есть что продать?',
        options: [
          { text: 'Про мембрану…', show: (c) => smart(c) && !c.flag('membraneLead'), next: 'membrane' },
          { text: 'Расскажи ещё раз, где искать мембрану.', show: (c) => c.flag('membraneLead'), next: 'lead' },
          { text: 'Покажи товар.', next: 'barter' },
          { text: 'Пока.', next: 'end' },
        ],
      },
      membrane: {
        text: '— Мембрана… — Ицик долго протирает лупу. — Может, я знаю, где их искать. А может, и нет. Знание стоит денег. Двести асимонов. Или услуга.',
        options: [
          { text: 'Вот двести асимонов.', show: (c) => c.count('asimon') >= 200, act: (c) => { c.take('asimon', 200); }, next: 'lead' },
          { text: 'Ты сам ничего не знаешь. Иначе давно бы продал её, а не торговался.', next: (c) => (c.skill('speech') >= 55 ? 'speechWin' : 'speechFail') },
          { text: 'Какая услуга?', show: (c) => c.quest('stings') === 'none', next: 'job' },
          { text: 'Подумаю.', next: 'end' },
        ],
      },
      speechWin: {
        onEnter: (c) => { if (!c.flag('itzikSpeech')) { c.set('itzikSpeech'); c.xp(100); } },
        text: '— Ха! — Ицик хлопает ладонью по прилавку. — Будь у меня мембрана, я бы уже пил чай в Иерусалиме. Ладно, умник, слушай бесплатно.',
        options: [{ text: 'Слушаю.', next: 'lead' }],
      },
      speechFail: {
        text: '— Хорошая попытка, миклатник. Деньги или услуга.',
        options: [{ text: 'Ладно.', next: 'membrane' }],
      },
      job: {
        text: '— Знахари платят мне за жала гигантских скорпионов: из них варят противоядие. Принеси три жала — расскажу, где искать мембрану, и накину сотню асимонов сверху.',
        options: [
          { text: 'Договорились.', act: (c) => c.setQuest('stings', 'active'), next: 'end' },
          { text: 'Не сейчас.', next: 'end' },
        ],
      },
      stingsWait: {
        text: (c) => `— Жала принёс? Три штуки, не меньше. ${c.count('sting') ? `Вижу у тебя ${c.count('sting')} — мало.` : 'Пока не вижу ни одного.'}`,
        options: [
          { text: 'Может, договоримся иначе?', next: 'membrane' },
          { text: 'Покажи товар.', next: 'barter' },
          { text: 'Скоро будут.', next: 'end' },
        ],
      },
      stingsReady: {
        text: '— О! Целых три, и свежие. Давай сюда.',
        options: [{
          text: 'Держи.',
          act: (c) => { c.take('sting', 3); c.give('asimon', 100); c.xp(150); c.setQuest('stings', 'done'); },
          next: 'lead',
        }],
      },
      lead: {
        onEnter: (c) => { c.set('membraneLead'); c.set('knowsCoast'); },
        text: '— Слушай. До войны мембраны делали на опреснительном заводе в Ашдоде, на побережье. Там был склад запчастей: ящики с мембранами, запаянные в вакуум. Сто лет никто туда не совался — светится. Но если кто и найдёт там целую мембрану, то только такой псих, как ты. Принесёшь лишнюю — куплю.',
        options: [{ text: 'Спасибо, Ицик.', next: 'again' }],
      },
      after: {
        text: '— Жала ушли знахарям за хорошие деньги. Ты мне нравишься, миклатник. Заходи ещё.',
        options: [
          { text: 'Напомни, где искать мембрану.', next: 'lead' },
          { text: 'Покажи товар.', next: 'barter' },
          { text: 'Пока.', next: 'end' },
        ],
      },
      dumb: {
        text: '— Мусорщик, мусорщик. А ты — покупатель? Асимоны покажи.',
        options: [{ text: 'Вот!', next: 'barter' }, { text: 'Не покажу!', next: 'end' }],
      },
    },
  },
  naama: {
    start: (c) => (c.flag('metNaama') ? 'again' : 'first'),
    nodes: {
      first: {
        onEnter: (c) => c.set('metNaama'),
        text: '— Садись, путник, — женщина в цветастом платке наливает чай из закопчённого финджана. — Я Наама. Чай с мятой — асимон, вода — пятнадцать. Слухи бесплатно, если хорошо слушаешь.',
        options: [
          { text: 'Чаю, пожалуйста. (1 асимон)', show: (c) => c.count('asimon') >= 1, act: (c) => { c.take('asimon', 1); c.heal(3); }, next: 'tea' },
          { text: 'Какие слухи ходят?', show: smart, next: 'rumors' },
          { text: 'Что у тебя есть?', next: 'barter' },
          { text: 'Мне пора.', next: 'end' },
        ],
      },
      again: {
        text: '— Снова ты. Чаю?',
        options: [
          { text: 'Да, чаю. (1 асимон)', show: (c) => c.count('asimon') >= 1, act: (c) => { c.take('asimon', 1); c.heal(3); }, next: 'tea' },
          { text: 'Что нового?', show: smart, next: 'rumors' },
          { text: 'Что у тебя есть?', next: 'barter' },
          { text: 'В другой раз.', next: 'end' },
        ],
      },
      tea: {
        text: 'Сладкий горячий чай с мятой. Песок на зубах хрустит уже не так противно.',
        options: [{ text: 'Спасибо.', next: 'again' }],
      },
      rumors: {
        onEnter: (c) => c.set('heardSons'),
        text: '— На юге, у Мёртвого моря, режут соль кристаллами, и бродят там то ли люди, то ли нет. С запада приходят Сыны Бетона — молятся на старые бункеры, говорят, у них есть рабочая довоенная техника. С таким комбинезоном, как у тебя, им лучше не попадаться: решат, что ты святыня, и не отпустят.',
        options: [
          { text: 'А про Ашдод что говорят?', show: (c) => c.flag('membraneLead'), next: 'ashdod' },
          { text: 'Спасибо.', next: 'again' },
        ],
      },
      ashdod: {
        text: '— Ашдод? — Наама перестаёт наливать. — Оттуда возвращаются с язвами. Если пойдёшь — возьми побольше воды и не ночуй под открытым небом. Там по ночам светится сам воздух.',
        options: [{ text: 'Учту.', next: 'again' }],
      },
    },
  },
  doctor: {
    start: (c) => (c.flag('metDoctor') ? 'again' : 'first'),
    nodes: {
      first: {
        onEnter: (c) => c.set('metDoctor'),
        text: '— Док Ави. Лечу всё, кроме глупости: огнестрел, укусы, ожоги. Плата вперёд.',
        options: [
          { text: (c) => `Подлечи меня. (${healCost(c)} асимонов)`, show: (c) => c.hurt() > 0, next: (c) => (c.count('asimon') >= healCost(c) ? 'heal' : 'poor') },
          { text: 'Продашь шприц-тюбики?', next: 'barter' },
          { text: 'Пока ничего не нужно.', next: 'end' },
        ],
      },
      again: {
        text: '— Опять продырявили? Показывай.',
        options: [
          { text: (c) => `Подлечи меня. (${healCost(c)} асимонов)`, show: (c) => c.hurt() > 0, next: (c) => (c.count('asimon') >= healCost(c) ? 'heal' : 'poor') },
          { text: 'Продашь шприц-тюбики?', next: 'barter' },
          { text: 'Я в порядке.', next: 'end' },
        ],
      },
      heal: {
        onEnter: (c) => { c.take('asimon', healCost(c)); c.heal(); },
        text: '— Готово. Шов не мочить, под пули не лезть. Хотя бы до завтра.',
        options: [{ text: 'Спасибо, док.', next: 'end' }],
      },
      poor: {
        text: '— Асимонов не хватает. Приходи, когда будут. Или купи у меня шприц-тюбик и уколи себя сам — дешевле не станет, но хоть быстро.',
        options: [{ text: 'Понятно.', next: 'end' }],
      },
    },
  },
};

