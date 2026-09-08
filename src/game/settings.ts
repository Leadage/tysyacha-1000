/**
 * Договорённости (правила) и интерфейсные настройки.
 * Каждая настройка из этого файла реально влияет на игру — «мёртвых» опций нет.
 */

export type SettingType = 'bool' | 'number' | 'enum';

export interface SettingMeta {
  id: keyof RuleSettings;
  title: string;
  description: string;
  type: SettingType;
  defaultValue: boolean | number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string | number; label: string }[];
  group: string;
}

export interface RuleSettings {
  // --- Общее ---
  playersCount: 3 | 4;
  aiLevel: 'novice' | 'medium' | 'strong';

  // --- Торговля ---
  noJumpBids: boolean; // прыжки в торговле запрещены (только +5)
  bidAbove120WithoutMarriage: boolean; // торг больше 120 без марьяжа
  silenceEnabled: boolean; // молчание при большом минусе
  silenceThreshold: number; // ... если у игрока меньше N

  // --- Прикуп / показ ---
  hideTalonAt100: boolean; // не показывать прикуп при 100
  hideTalonWhenDark: boolean; // не показывать прикуп при тёмной
  blindDiscard: boolean; // снос карт втёмную (соперники не видят чужую карту)

  // --- Роспись ---
  rospisBy60: boolean; // расписывать по 60 очков
  rospisNoDeduct: boolean; // не вычитать заказ при росписи
  rospisLimit3: boolean; // только 3 росписи на игру
  rospisPenaltyOnThird: boolean; // штраф при третьей росписи
  rospisWhenBarrel: boolean; // можно расписывать, если кто-то на бочке
  rospisWhenGolden: boolean; // можно расписывать при золотом
  rospisWhenDark: boolean; // можно расписывать при игре втёмную

  // --- Марьяжи ---
  marriageFromFirstMove: boolean; // можно хвалить с первого хода
  aceMarriage: boolean; // тузовый марьяж (200)
  noLeadForeignTrump: boolean; // нельзя ходить с чужих козырей

  // --- Подсчёт ---
  roundOwnGame: boolean; // округлять очки при своей игре
  winMoreThan1000: boolean; // для победы надо набрать больше 1000

  // --- Болты ---
  boltMode: 'off' | 'consecutive3' | 'total3'; // режим штрафа за болты
  boltNoOwnGame: boolean; // болт на своей игре не считается
  boltGoldenDouble: boolean; // болт на золотом считается за два
  penaltyAmount: number; // сумма штрафа (0..500)

  // --- Бочка ---
  barrelScore: 880 | 900; // количество очков в бочке
  barrelAttempts: number; // попыток на бочке
  barrelKnockOff: boolean; // сброс с бочки, если на неё влез другой
  noSimultaneousBarrel: boolean; // нельзя одновременно влезать на бочку
  resetAfter3Barrels: boolean; // сброс на ноль после 3-х бочек

  // --- Самосвал ---
  dumpEnabled: boolean; // сброс на ноль при достижении N
  dumpScore: number; // ... N (по умолчанию 555)
  dumpNegative: boolean; // сброс на ноль и при -N

  // --- Золотой кон ---
  goldenEnabled: boolean;
  goldenCanRaise: boolean; // можно увеличивать заказ на золотом
  goldenResetIfNobody: boolean; // обнулять очки, если никто не взял золотой

  // --- Игра втёмную ---
  darkEnabled: boolean; // разрешить игру втёмную
  darkMinScore: number; // для игры втёмную надо иметь не менее N очков
  darkWhenBarrel: boolean; // можно темнить, если кто-то на бочке

  // --- Пересдача ---
  redealLowHand: boolean; // пересдача, если на руках меньше N
  redealLowHandValue: number;
  redealFourNines: boolean; // пересдача, если 4 девятки на руках
  redealFourNinesAfterDiscard: boolean; // пересдача при 4 девятках после сноса
  redealTwoNinesTalon: boolean; // пересдача, если 2 девятки в прикупе
  redealWeakTalon: boolean; // пересдача, если в прикупе меньше N
  redealWeakTalonValue: number;
  redealOnlyAt100: boolean; // пересдача только на 100

  // --- Четверо игроков ---
  talonSitterMarriage: boolean; // добавлять стоимость марьяжа в прикупе
  talonSitterHalfMarriage: boolean; // добавлять стоимость половинки марьяжа
}

export interface UiSettings {
  confirmDark: boolean;
  confirmSameContract: boolean;
  confirmLowBarrelContract: boolean;
  confirmNoMarriage: boolean;
  showTableLegend: boolean;
  showReplayButton: boolean;
  showPassButton: boolean;
  autoClick: boolean;
  trickDelayMs: number;
  talonDelayMs: number;
  sound: boolean;
  tableColor: string;
  backgroundImage: string;
  escapeTitle: string;
  playerName: string;
  botNames: string[];
}

export const DEFAULT_RULES: RuleSettings = {
  playersCount: 3,
  aiLevel: 'medium',

  noJumpBids: false,
  bidAbove120WithoutMarriage: false,
  silenceEnabled: true,
  silenceThreshold: -120,

  hideTalonAt100: false,
  hideTalonWhenDark: true,
  blindDiscard: true,

  rospisBy60: true,
  rospisNoDeduct: false,
  rospisLimit3: true,
  rospisPenaltyOnThird: false,
  rospisWhenBarrel: true,
  rospisWhenGolden: false,
  rospisWhenDark: false,

  marriageFromFirstMove: false,
  aceMarriage: false,
  noLeadForeignTrump: false,

  roundOwnGame: false,
  winMoreThan1000: false,

  boltMode: 'consecutive3',
  boltNoOwnGame: true,
  boltGoldenDouble: false,
  penaltyAmount: 120,

  barrelScore: 880,
  barrelAttempts: 3,
  barrelKnockOff: false,
  noSimultaneousBarrel: false,
  resetAfter3Barrels: false,

  dumpEnabled: true,
  dumpScore: 555,
  dumpNegative: false,

  goldenEnabled: false,
  goldenCanRaise: false,
  goldenResetIfNobody: false,

  darkEnabled: true,
  darkMinScore: 240,
  darkWhenBarrel: false,

  redealLowHand: true,
  redealLowHandValue: 14,
  redealFourNines: true,
  redealFourNinesAfterDiscard: false,
  redealTwoNinesTalon: false,
  redealWeakTalon: true,
  redealWeakTalonValue: 5,
  redealOnlyAt100: true,

  talonSitterMarriage: false,
  talonSitterHalfMarriage: false,
};

export const DEFAULT_UI: UiSettings = {
  confirmDark: true,
  confirmSameContract: false,
  confirmLowBarrelContract: true,
  confirmNoMarriage: true,
  showTableLegend: true,
  showReplayButton: true,
  showPassButton: false,
  autoClick: false,
  trickDelayMs: 900,
  talonDelayMs: 1800,
  sound: true,
  tableColor: '#3a9a3a',
  backgroundImage: '',
  escapeTitle: 'Microsoft Excel',
  playerName: 'Игрок',
  botNames: ['Lisa', 'Homer', 'Bart'],
};

/** Метаданные всех договорённостей — используются окном «Договорённости». */
export const RULE_META: SettingMeta[] = [
  {
    id: 'playersCount',
    title: 'Количество игроков',
    description:
      'Втроём — классический вариант: каждый получает 7 карт, 3 карты в прикуп. Вчетвером — раздающий не играет, «сидит на прикупе» и получает стоимость карт прикупа.',
    type: 'enum',
    defaultValue: 3,
    options: [
      { value: 3, label: '3 игрока' },
      { value: 4, label: '4 игрока' },
    ],
    group: 'Общее',
  },
  {
    id: 'aiLevel',
    title: 'Уровень компьютера',
    description:
      'Новичок — простая эвристика с небольшими ошибками. Средний — считает вышедшие карты. Сильный — полный подсчёт карт, оценка неизвестных, просмотр на несколько ходов вперёд.',
    type: 'enum',
    defaultValue: 'medium',
    options: [
      { value: 'novice', label: 'Новичок' },
      { value: 'medium', label: 'Средний' },
      { value: 'strong', label: 'Сильный' },
    ],
    group: 'Общее',
  },

  {
    id: 'noJumpBids',
    title: 'Прыжки в торговле запрещены',
    description:
      'Включено: следующая ставка может быть строго на 5 больше предыдущей. Выключено: разрешается повышать сразу на любую величину, кратную 5 (например, 100 → 115).',
    type: 'bool',
    defaultValue: false,
    group: 'Торговля',
  },
  {
    id: 'bidAbove120WithoutMarriage',
    title: 'Торг больше 120 без марьяжа',
    description:
      'Выключено (классика): нельзя торговаться выше, чем 120 плюс стоимость марьяжей на руке. Включено: ограничение снимается, торговаться можно на любую сумму.',
    type: 'bool',
    defaultValue: false,
    group: 'Торговля',
  },
  {
    id: 'silenceEnabled',
    title: 'Молчание при большом минусе',
    description:
      'Игрок, чей общий счёт меньше заданного числа, не участвует в повышении торгов и автоматически пасует (кроме обязательного заказа 100).',
    type: 'bool',
    defaultValue: true,
    group: 'Торговля',
  },
  {
    id: 'silenceThreshold',
    title: 'Молчание, если у игрока меньше',
    description: 'Порог общего счёта, ниже которого игрок обязан молчать в торговле.',
    type: 'number',
    defaultValue: -120,
    min: -1000,
    max: 0,
    step: 10,
    group: 'Торговля',
  },

  {
    id: 'hideTalonAt100',
    title: 'Не показывать прикуп при 100',
    description:
      'Если победитель торгов получил прикуп на обязательном заказе 100 и сам не повышал ставку, содержимое прикупа соперникам не раскрывается.',
    type: 'bool',
    defaultValue: false,
    group: 'Прикуп',
  },
  {
    id: 'hideTalonWhenDark',
    title: 'Не показывать прикуп при тёмной',
    description: 'При игре втёмную содержимое прикупа соперникам не показывается.',
    type: 'bool',
    defaultValue: true,
    group: 'Прикуп',
  },
  {
    id: 'blindDiscard',
    title: 'Снос карт втёмную',
    description:
      'Соперник видит только ту карту, которую получил сам, и не знает, какая карта досталась другому сопернику. Компьютерные игроки тоже не получают эту информацию.',
    type: 'bool',
    defaultValue: true,
    group: 'Прикуп',
  },

  {
    id: 'rospisBy60',
    title: 'Расписывать по 60 очков',
    description:
      'Включено: при росписи каждый соперник получает по 60 очков. Выключено: соперники делят между собой величину заказа (половина округляется до кратного пяти).',
    type: 'bool',
    defaultValue: true,
    group: 'Роспись',
  },
  {
    id: 'rospisNoDeduct',
    title: 'Не вычитать заказ при росписи',
    description:
      'Включено: у расписывающего заказ из счёта не вычитается. Выключено: из его счёта вычитается величина заказа.',
    type: 'bool',
    defaultValue: false,
    group: 'Роспись',
  },
  {
    id: 'rospisLimit3',
    title: 'Только 3 росписи на игру',
    description: 'После трёх росписей игрок больше не может расписывать до конца партии.',
    type: 'bool',
    defaultValue: true,
    group: 'Роспись',
  },
  {
    id: 'rospisPenaltyOnThird',
    title: 'Штраф при третьей росписи',
    description: 'При третьей росписи дополнительно вычитается сумма штрафа.',
    type: 'bool',
    defaultValue: false,
    group: 'Роспись',
  },
  {
    id: 'rospisWhenBarrel',
    title: 'Можно расписывать, если кто-то на бочке',
    description: 'Разрешает роспись в конах, когда хотя бы один игрок сидит на бочке.',
    type: 'bool',
    defaultValue: true,
    group: 'Роспись',
  },
  {
    id: 'rospisWhenGolden',
    title: 'Можно расписывать при золотом',
    description: 'Разрешает роспись во время золотого кона.',
    type: 'bool',
    defaultValue: false,
    group: 'Роспись',
  },
  {
    id: 'rospisWhenDark',
    title: 'Можно расписывать при игре втёмную',
    description: 'Разрешает роспись, если заказ был объявлен втёмную.',
    type: 'bool',
    defaultValue: false,
    group: 'Роспись',
  },

  {
    id: 'marriageFromFirstMove',
    title: 'Можно хвалить с первого хода',
    description:
      'Включено: марьяж можно объявить сразу. Выключено (классика): сначала нужно взять хотя бы одну взятку в текущем кону.',
    type: 'bool',
    defaultValue: false,
    group: 'Марьяжи',
  },
  {
    id: 'aceMarriage',
    title: 'Тузовый марьяж',
    description:
      'Игрок, у которого на руках все четыре туза, при своём ходе может сыграть туза и объявить тузовый марьяж — 200 очков. Козырь при этом не меняется.',
    type: 'bool',
    defaultValue: false,
    group: 'Марьяжи',
  },
  {
    id: 'noLeadForeignTrump',
    title: 'Нельзя ходить с чужих козырей',
    description:
      'Если козырную масть объявил другой игрок, нельзя начинать взятку картой этой масти при наличии карт других мастей.',
    type: 'bool',
    defaultValue: false,
    group: 'Марьяжи',
  },

  {
    id: 'roundOwnGame',
    title: 'Округлять очки при своей игре',
    description:
      'Включено: набранные играющим очки сначала округляются до кратного пяти (98 → 100), и только потом сравниваются с заказом. Выключено — строгий классический режим.',
    type: 'bool',
    defaultValue: false,
    group: 'Подсчёт',
  },
  {
    id: 'winMoreThan1000',
    title: 'Для победы надо набрать больше 1000',
    description: 'Включено: победа только при счёте 1005 и выше. Выключено: достаточно ровно 1000.',
    type: 'bool',
    defaultValue: false,
    group: 'Подсчёт',
  },

  {
    id: 'boltMode',
    title: 'Штраф за болты',
    description:
      '«Три подряд» — штраф после трёх нулевых конов подряд. «Три за игру» — штраф при третьем болте за партию (не обязательно подряд). После штрафа счётчик обнуляется.',
    type: 'enum',
    defaultValue: 'consecutive3',
    options: [
      { value: 'off', label: 'Без штрафа' },
      { value: 'consecutive3', label: 'Штраф при 3 нулевых подряд' },
      { value: 'total3', label: 'Штраф при 3-м нулевом за игру' },
    ],
    group: 'Болты',
  },
  {
    id: 'boltNoOwnGame',
    title: 'Болт на своей игре не считается',
    description:
      'Если игрок был победителем торгов и не взял ни одной взятки, отдельный болт ему не записывается.',
    type: 'bool',
    defaultValue: true,
    group: 'Болты',
  },
  {
    id: 'boltGoldenDouble',
    title: 'Болт на золотом считается за два',
    description: 'Нулевой результат во время золотого кона засчитывается как два болта.',
    type: 'bool',
    defaultValue: false,
    group: 'Болты',
  },
  {
    id: 'penaltyAmount',
    title: 'Сумма штрафа',
    description:
      'Величина стандартного штрафа: за болты, за слёт с бочки, за третью роспись. Допустимо 0–500.',
    type: 'number',
    defaultValue: 120,
    min: 0,
    max: 500,
    step: 5,
    group: 'Болты',
  },

  {
    id: 'barrelScore',
    title: 'Количество очков в бочке',
    description:
      'При 880 для победы с бочки нужен заказ не меньше 120. При 900 — не меньше 100 (или 105, если для победы требуется больше 1000).',
    type: 'enum',
    defaultValue: 880,
    options: [
      { value: 880, label: '880' },
      { value: 900, label: '900' },
    ],
    group: 'Бочка',
  },
  {
    id: 'barrelAttempts',
    title: 'Попыток на бочке',
    description:
      'Сколько конов даётся игроку, чтобы выйти с бочки. Если за это время он не выиграл — штраф и слёт с бочки.',
    type: 'number',
    defaultValue: 3,
    min: 1,
    max: 5,
    step: 1,
    group: 'Бочка',
  },
  {
    id: 'barrelKnockOff',
    title: 'Сброс с бочки, если на неё влез другой',
    description:
      'Если один игрок уже сидит на бочке, а другой достигает бочки, прежний слетает с бочки и получает штраф.',
    type: 'bool',
    defaultValue: false,
    group: 'Бочка',
  },
  {
    id: 'noSimultaneousBarrel',
    title: 'Нельзя одновременно влезать на бочку',
    description:
      'Если за один расчёт на бочку должны сесть двое или трое, все они получают штраф и на бочке не остаются.',
    type: 'bool',
    defaultValue: false,
    group: 'Бочка',
  },
  {
    id: 'resetAfter3Barrels',
    title: 'Сброс на ноль после 3-х бочек',
    description: 'Если игрок трижды сел на бочку и трижды с неё слетел, его общий счёт становится 0.',
    type: 'bool',
    defaultValue: false,
    group: 'Бочка',
  },

  {
    id: 'dumpEnabled',
    title: 'Сброс на ноль при достижении N (самосвал)',
    description: 'Если после кона результат игрока равен ровно N, его счёт обнуляется. В таблице отмечается буквой Z.',
    type: 'bool',
    defaultValue: true,
    group: 'Самосвал',
  },
  {
    id: 'dumpScore',
    title: 'Число самосвала',
    description: 'Точное значение счёта, при котором происходит обнуление.',
    type: 'number',
    defaultValue: 555,
    min: 100,
    max: 900,
    step: 5,
    group: 'Самосвал',
  },
  {
    id: 'dumpNegative',
    title: 'Самосвал и при минус N',
    description: 'Обнулять счёт также при результате ровно −N (например, −555 → 0).',
    type: 'bool',
    defaultValue: false,
    group: 'Самосвал',
  },

  {
    id: 'goldenEnabled',
    title: 'Золотой кон',
    description:
      'Партия начинается золотым кругом: каждый игрок по очереди обязан сыграть заказ 120. Набранные и потерянные очки удваиваются.',
    type: 'bool',
    defaultValue: false,
    group: 'Золотой кон',
  },
  {
    id: 'goldenCanRaise',
    title: 'Можно увеличивать заказ на золотом',
    description: 'Включено: игрок может увеличить обязательный заказ 120. Выключено: играет строго 120.',
    type: 'bool',
    defaultValue: false,
    group: 'Золотой кон',
  },
  {
    id: 'goldenResetIfNobody',
    title: 'Обнулять очки, если никто не взял золотой',
    description: 'Если никто из игроков не выполнил обязательный золотой заказ, счёт обнуляется и золотой круг начинается заново.',
    type: 'bool',
    defaultValue: false,
    group: 'Золотой кон',
  },

  {
    id: 'darkEnabled',
    title: 'Разрешить игру втёмную',
    description:
      'До просмотра своих карт игрок с обязательным заказом может объявить «Втёмную 120». Если его никто не перебил, результат раздачи удваивается.',
    type: 'bool',
    defaultValue: true,
    group: 'Втёмную',
  },
  {
    id: 'darkMinScore',
    title: 'Для игры втёмную надо иметь не менее',
    description: 'Минимальный общий счёт игрока, при котором ему разрешено темнить.',
    type: 'number',
    defaultValue: 240,
    min: 0,
    max: 900,
    step: 10,
    group: 'Втёмную',
  },
  {
    id: 'darkWhenBarrel',
    title: 'Можно темнить, если кто-то на бочке',
    description: 'Разрешает объявлять тёмную в конах, когда хотя бы один игрок сидит на бочке.',
    type: 'bool',
    defaultValue: false,
    group: 'Втёмную',
  },

  {
    id: 'redealLowHand',
    title: 'Пересдача, если на руках меньше N',
    description: 'Игрок может потребовать пересдачу, если суммарная стоимость его 7 карт меньше заданного числа.',
    type: 'bool',
    defaultValue: true,
    group: 'Пересдача',
  },
  {
    id: 'redealLowHandValue',
    title: 'Порог стоимости руки',
    description: 'Суммарная стоимость карт на руке, ниже которой можно требовать пересдачу.',
    type: 'number',
    defaultValue: 14,
    min: 0,
    max: 40,
    step: 1,
    group: 'Пересдача',
  },
  {
    id: 'redealFourNines',
    title: 'Пересдача, если 4 девятки на руках',
    description: 'Игрок, получивший при раздаче все четыре девятки, может потребовать пересдачу.',
    type: 'bool',
    defaultValue: true,
    group: 'Пересдача',
  },
  {
    id: 'redealFourNinesAfterDiscard',
    title: 'Пересдача при 4 девятках после сноса',
    description: 'Пересдачу можно потребовать, если четыре девятки собрались после получения карты от победителя торгов.',
    type: 'bool',
    defaultValue: false,
    group: 'Пересдача',
  },
  {
    id: 'redealTwoNinesTalon',
    title: 'Пересдача, если 2 девятки в прикупе',
    description: 'Победитель торгов после открытия прикупа может потребовать пересдачу, если в прикупе минимум две девятки.',
    type: 'bool',
    defaultValue: false,
    group: 'Пересдача',
  },
  {
    id: 'redealWeakTalon',
    title: 'Пересдача, если в прикупе меньше N',
    description: 'Победитель торгов может потребовать пересдачу, если суммарная стоимость трёх карт прикупа меньше заданного числа.',
    type: 'bool',
    defaultValue: true,
    group: 'Пересдача',
  },
  {
    id: 'redealWeakTalonValue',
    title: 'Порог стоимости прикупа',
    description: 'Суммарная стоимость прикупа, ниже которой разрешена пересдача.',
    type: 'number',
    defaultValue: 5,
    min: 0,
    max: 30,
    step: 1,
    group: 'Пересдача',
  },
  {
    id: 'redealOnlyAt100',
    title: 'Пересдача только на 100',
    description:
      'Включено: правила пересдачи по прикупу работают, только если игрок получил прикуп на обязательном заказе 100 и сам не повышал ставку.',
    type: 'bool',
    defaultValue: true,
    group: 'Пересдача',
  },

  {
    id: 'talonSitterMarriage',
    title: 'Добавлять стоимость марьяжа в прикупе',
    description: 'При игре вчетвером: если в прикупе оказались король и дама одной масти, сидящий на прикупе получает стоимость этого марьяжа.',
    type: 'bool',
    defaultValue: false,
    group: 'Вчетвером',
  },
  {
    id: 'talonSitterHalfMarriage',
    title: 'Добавлять стоимость половинки марьяжа',
    description: 'При игре вчетвером: если в прикупе только король либо только дама, сидящий получает половину стоимости соответствующего марьяжа.',
    type: 'bool',
    defaultValue: false,
    group: 'Вчетвером',
  },
];

export const RULE_GROUPS = [
  'Общее',
  'Торговля',
  'Прикуп',
  'Роспись',
  'Марьяжи',
  'Подсчёт',
  'Болты',
  'Бочка',
  'Самосвал',
  'Золотой кон',
  'Втёмную',
  'Пересдача',
  'Вчетвером',
];

export function normalizeRules(raw: Partial<RuleSettings> | null | undefined): RuleSettings {
  const r: RuleSettings = { ...DEFAULT_RULES, ...(raw || {}) };
  // защита от битых значений из localStorage
  if (r.playersCount !== 3 && r.playersCount !== 4) r.playersCount = 3;
  if (r.barrelScore !== 880 && r.barrelScore !== 900) r.barrelScore = 880;
  r.penaltyAmount = clamp(r.penaltyAmount, 0, 500);
  r.darkMinScore = clamp(r.darkMinScore, 0, 900);
  r.dumpScore = clamp(r.dumpScore, 100, 900);
  r.barrelAttempts = clamp(r.barrelAttempts, 1, 5);
  r.redealLowHandValue = clamp(r.redealLowHandValue, 0, 40);
  r.redealWeakTalonValue = clamp(r.redealWeakTalonValue, 0, 30);
  r.silenceThreshold = clamp(r.silenceThreshold, -1000, 0);
  if (!['off', 'consecutive3', 'total3'].includes(r.boltMode)) r.boltMode = 'consecutive3';
  if (!['novice', 'medium', 'strong'].includes(r.aiLevel)) r.aiLevel = 'medium';
  return r;
}

export function normalizeUi(raw: Partial<UiSettings> | null | undefined): UiSettings {
  const u: UiSettings = { ...DEFAULT_UI, ...(raw || {}) };
  u.trickDelayMs = clamp(u.trickDelayMs, 0, 5000);
  u.talonDelayMs = clamp(u.talonDelayMs, 0, 10000);
  if (!Array.isArray(u.botNames) || u.botNames.length < 3) u.botNames = [...DEFAULT_UI.botNames];
  return u;
}

function clamp(v: number, lo: number, hi: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
