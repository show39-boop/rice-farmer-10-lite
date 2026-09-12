"use strict";

const MAX_YEARS = 5;
const PERIODS_PER_YEAR = 8;
const TOTAL_TURNS = MAX_YEARS * PERIODS_PER_YEAR;
const BASE_YIELD_KG = 450;
const ANNUAL_LABOR_HOURS = 1800;
const ANNUAL_LIVING_COST = 240;
const ACTION_POSITIVE_RATE = 1.2;
const ACTION_NEGATIVE_RATE = 0.85;
const TITLE_COUNT = 10;
let actionBalanceActive = false;
let previousRunLog = null;

const PERIODS = [
  { id: 1, label: "1〜2月", theme: "今年の経営計画", prompt: "今年の方針を決める時期。資金、農地、勉強のバランスが大事だ。", actions: ["study", "sales", "maintenance", "rest"] },
  { id: 2, label: "3〜4月", theme: "田んぼの準備", prompt: "耕起と代かきの準備。農機の状態も気になる。", actions: ["maintenance", "study", "waterPrep", "rest"] },
  { id: 3, label: "5月", theme: "田植え", prompt: "田植えの出来は一年を左右する。丁寧にいくか、広い面積を早くこなすか。", actions: ["carefulPlanting", "fastPlanting", "study", "maintenance", "rest"] },
  { id: 4, label: "6月", theme: "水と雑草", prompt: "水管理と除草の季節。初期生育を守りたい。", actions: ["water", "weeding", "study", "rest"] },
  { id: 5, label: "7月", theme: "夏の管理", prompt: "高温に備えながら、稲の勢いを伸ばす時期だ。", actions: ["water", "cultivationResearch", "sales", "rest"] },
  { id: 6, label: "8月", theme: "病害虫との戦い", prompt: "カメムシ、高温障害、台風。ここを乗り越えると収穫が見える。", actions: ["pestControl", "water", "sales", "rest"] },
  { id: 7, label: "9〜10月", theme: "収穫", prompt: "いよいよ稲刈り。収穫後に今年の収量と売上が出る。", actions: ["carefulHarvest", "fastHarvest", "maintenance", "askHelp"] },
  { id: 8, label: "11〜12月", theme: "販売と決算", prompt: "米を売り、決算して、来年に向けて整える。", actions: ["jaSales", "premiumSales"] }
];

const ACTIONS = {
  morningPatrol: {
    label: "早朝見回り",
    detail: "水と生育を確認",
    temporary: true,
    apply(s) {
      changeStat(s, "cultivation", 1);
      s.yearData.water += 1;
      s.yearData.yieldBonus += 8;
      consumeStamina(s, 4);
      return "早朝に田んぼを見回った。水と生育を確認。";
    }
  },
  soilCare: {
    label: "土づくり",
    detail: "収量安定 / 栽培UP",
    temporary: true,
    apply(s) {
      changeStat(s, "cultivation", 2);
      s.yearData.yieldBonus += 10;
      spendCash(s, 6, "土づくり費");
      return "土づくりをした。栽培力と収量の土台が上がった。";
    }
  },
  neighborHelp: {
    label: "地域の手伝い",
    detail: "信用UP / 農地相談",
    temporary: true,
    apply(s) {
      changeStat(s, "trust", 4);
      changeStat(s, "stamina", -5);
      return "地域の作業を手伝った。信用が上がった。";
    }
  },
  materialCheck: {
    label: "資材チェック",
    detail: "経営UP / 経費意識",
    temporary: true,
    apply(s) {
      changeStat(s, "management", 2);
      s.yearData.priceBonus += 0.01;
      return "資材を見直した。経営力が上がった。";
    }
  },
  directVisit: {
    label: "取引先訪問",
    detail: "信用UP / 価格UP",
    temporary: true,
    apply(s) {
      changeStat(s, "trust", 2);
      changeStat(s, "management", 1);
      s.yearData.priceBonus += 0.04;
      consumeStamina(s, 5);
      return "取引先を訪問した。販売価格の期待が上がった。";
    }
  },
  water: {
    label: "水管理",
    detail: "栽培+2 / 収量安定",
    apply(s) {
      changeStat(s, "cultivation", 2);
      s.yearData.yieldBonus += 12;
      s.yearData.water += 1;
      consumeStamina(s, 8);
      return "水管理を行った。栽培力+2、収量+12kg。";
    }
  },
  waterPrep: {
    label: "水管理準備",
    detail: "栽培+2 / 水管理準備",
    apply(s) {
      changeStat(s, "cultivation", 2);
      s.yearData.water += 1;
      consumeStamina(s, 5);
      return "水回りを整えた。栽培力+2。";
    }
  },
  study: {
    label: "勉強",
    detail: "栽培+2 / 経営+2",
    apply(s) {
      changeStat(s, "cultivation", 2);
      changeStat(s, "management", 2);
      consumeStamina(s, 4);
      s.counts.study += 1;
      return "勉強した。栽培力+2、経営力+2。";
    }
  },
  sales: {
    label: "営業",
    detail: "信用+4 / 経営+1 / 価格UP",
    apply(s) {
      changeStat(s, "trust", 4);
      changeStat(s, "management", 1);
      s.yearData.priceBonus += 0.03;
      consumeStamina(s, 6);
      s.counts.sales += 1;
      return "営業した。信用+4、販売補正+3%。";
    }
  },
  maintenance: {
    label: "機械整備",
    detail: "農機UP / 経営+1",
    apply(s) {
      spendCash(s, 10, "整備費");
      changeStat(s, "machine", 18);
      changeStat(s, "management", 1);
      s.counts.maintenance += 1;
      return "機械整備をした。農機コンディションUP。";
    }
  },
  rest: {
    label: "休養",
    detail: "体力+25",
    apply(s) {
      changeStat(s, "stamina", 25);
      s.counts.rest += 1;
      return "休養した。体力+25。";
    }
  },
  weeding: {
    label: "除草対策",
    detail: "収量安定 / 雑草対策",
    apply(s) {
      s.yearData.weedControl += 2;
      s.yearData.yieldBonus += 8;
      consumeStamina(s, 7);
      return "除草した。収量低下リスクDOWN。";
    }
  },
  pestControl: {
    label: "防除",
    detail: "病害虫対策 / 収量安定",
    apply(s) {
      spendCash(s, 12, "防除費");
      s.yearData.pestControl += 2;
      s.yearData.yieldBonus += 8;
      consumeStamina(s, 6);
      return "防除した。病害虫に備えた。";
    }
  },
  cultivationResearch: {
    label: "栽培研究",
    detail: "栽培+3 / 収量+10",
    apply(s) {
      changeStat(s, "cultivation", 3);
      s.yearData.yieldBonus += 10;
      consumeStamina(s, 5);
      return "栽培研究を試した。栽培力+3。";
    }
  },
  carefulPlanting: {
    label: "丁寧に田植え",
    detail: "収量+18 / 栽培+2",
    apply(s) {
      s.yearData.yieldBonus += 18;
      changeStat(s, "cultivation", 2);
      consumeStamina(s, 10);
      return "丁寧に田植えした。収量+18kg。";
    }
  },
  fastPlanting: {
    label: "スピード重視",
    detail: "体力節約 / 早く終える",
    apply(s) {
      s.yearData.yieldBonus += s.area > manageableArea(s) ? -8 : 4;
      changeStat(s, "machine", -6);
      consumeStamina(s, 5);
      return "早く田植えを終えた。大面積には助かる。";
    }
  },
  carefulHarvest: {
    label: "丁寧に収穫",
    detail: "収量+16 / 丁寧作業",
    apply(s) {
      s.yearData.yieldBonus += 16;
      changeStat(s, "machine", -5);
      consumeStamina(s, 10);
      return "丁寧に収穫した。収量+16kg。";
    }
  },
  fastHarvest: {
    label: "スピード収穫",
    detail: "体力節約 / 早く刈る",
    apply(s) {
      const bonus = s.machine >= 55 ? 4 : -16;
      s.yearData.yieldBonus += bonus;
      changeStat(s, "machine", -10);
      consumeStamina(s, 5);
      return bonus >= 0 ? "一気に収穫した。" : "機械に負担が出て収量が少し落ちた。";
    }
  },
  askHelp: {
    label: "応援を頼む",
    detail: "信用で費用変化 / 体力節約",
    apply(s) {
      const cost = s.trust >= 60 ? 12 : s.trust >= 40 ? 22 : 35;
      spendCash(s, cost, "応援費");
      changeStat(s, "trust", 1);
      s.yearData.yieldBonus += 8;
      return `応援を頼んだ。費用${cost}万円。`;
    }
  },
  jaSales: {
    label: "JA中心で販売",
    detail: "安定販売 / 信用+1 / 価格+1%",
    apply(s) {
      changeStat(s, "trust", 1);
      s.yearData.priceBonus += 0.01;
      return "JA中心で安定販売の準備をした。";
    }
  },
  premiumSales: {
    label: "高値販売",
    detail: "信用+3 / 価格+8% / 体力-10",
    apply(s) {
      changeStat(s, "trust", 3);
      changeStat(s, "management", 1);
      s.yearData.priceBonus += 0.08;
      consumeStamina(s, 11.8);
      return "高値販売を狙った。販売補正+8%。";
    }
  }
};

const WEATHER_TABLE = [
  { id: "sunny", label: "好天", yieldBonus: 30, weight: 20 },
  { id: "normal", label: "平年並み", yieldBonus: 0, weight: 38 },
  { id: "hot", label: "猛暑傾向", yieldBonus: -30, weight: 20 },
  { id: "rain", label: "長雨傾向", yieldBonus: -20, weight: 15 },
  { id: "typhoon", label: "台風多め", yieldBonus: "random", weight: 7 }
];

const PRICE_TABLE = [
  { label: "安値予想", yen: 13000, weight: 20 },
  { label: "平年並み", yen: 15500, weight: 50 },
  { label: "高値予想", yen: 19000, weight: 25 },
  { label: "超高値", yen: 25000, weight: 5 }
];

const ABILITIES = [
  { id: "waterSense", icon: "水", name: "水見の勘", condition: (s) => s.counts.water >= 3, description: "猛暑・水不足ダメージ半減", hint: "水管理を何度か続ける" },
  { id: "wellConnected", icon: "縁", name: "顔が広い", condition: (s) => s.trust >= 60, description: "農地イベントが出やすい", hint: "地域との信用を上げる" },
  { id: "mechanic", icon: "整", name: "整備上手", condition: (s) => s.counts.maintenance >= 3, description: "農機故障率DOWN", hint: "機械整備を重ねる" },
  { id: "numbers", icon: "数", name: "数字に強い", condition: (s) => s.management >= 60, description: "年間経費-10%", hint: "経営力を伸ばす" },
  { id: "ironman", icon: "体", name: "鉄人", condition: (s) => s.counts.highStaminaTurns >= 10, description: "体力消費DOWN", hint: "高い体力を保つ" },
  { id: "brandRice", icon: "米", name: "ブランド米", condition: (s) => s.cultivation >= 70 && s.trust >= 70, description: "販売価格+10%", hint: "栽培力と信用を両方伸ばす" }
];

const dom = {};
let state = createInitialState();

const LocalEventProvider = {
  getEvent(gameState) {
    const period = currentPeriod(gameState).id;
    const candidates = RICE_EVENTS.filter((event) => {
      const periodOk = !event.periods || event.periods.includes(period);
      const conditionOk = !event.condition || event.condition(gameState);
      return periodOk && conditionOk;
    });
    const weighted = candidates.flatMap((event) => Array(event.weight || 1).fill(event));
    return weighted.length ? randomItem(weighted) : null;
  },
  getLandEvent(gameState) {
    const ids = gameState.trust >= 55 ? ["retire_small", "retire_large", "landlord"] : ["retire_small", "landlord"];
    const candidates = RICE_EVENTS.filter((event) => ids.includes(event.id));
    return prepareLandEvent(randomItem(candidates), gameState);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindDom();
  bindEvents();
  render();
});

function bindDom() {
  [
    "restartTopButton", "headerYear", "headerPeriod", "headerTurn", "startScreen", "playScreen",
    "finalScreen", "startButton", "restartFinalButton", "finalShareButton", "cultivationValue", "managementValue",
    "staminaValue", "trustValue", "cashValue", "debtValue", "areaValue", "machineValue",
    "mobileYearPeriod", "mobileTurn", "mobileCultivation", "mobileManagement", "mobileStamina", "mobileTrust",
    "mobileCash", "mobileDebt", "mobileArea", "mobileMachine",
    "mobileForecastYieldValue", "mobileLastYieldValue", "mobileLastSalesValue", "mobileExpenseValue",
    "mobileAreaDataValue", "mobilePriceBonusValue", "mobileEfficiencyValue", "mobileRicePriceValue",
    "abilitiesList", "abilityCount", "yearValue", "periodValue", "periodTheme", "weatherValue", "priceValue",
    "dotStage", "weatherLayer", "fieldLayer", "actorSprite", "machineSprite", "effectLayer", "abilityNotice",
    "dotTitle", "dotHint", "eventTitle", "eventDescription", "turnResult", "eventChoices", "actionButtons", "continueButton",
    "harvestCard", "settlementCard", "forecastYieldValue", "lastYieldValue", "lastSalesValue",
    "expenseValue", "areaDataValue", "priceBonusValue", "efficiencyValue", "gameLog", "previousLogBox", "previousLog",
    "ruleBox", "finalTitle", "finalTitleCount", "finalSummary"
  ].forEach((id) => {
    dom[id] = document.getElementById(id);
  });
}

function bindEvents() {
  dom.startButton.addEventListener("click", startGame);
  dom.restartTopButton.addEventListener("click", startGame);
  dom.restartFinalButton.addEventListener("click", startGame);
  dom.finalShareButton.addEventListener("click", shareFinalResult);
  dom.continueButton.addEventListener("click", nextPeriod);
  dom.dotStage.addEventListener("click", skipDotAnimation);
  setupResponsiveRuleBox();
}

function setupResponsiveRuleBox() {
  if (!dom.ruleBox || !window.matchMedia) return;
  const media = window.matchMedia("(max-width: 640px)");
  const apply = () => {
    dom.ruleBox.open = !media.matches;
  };
  apply();
  if (media.addEventListener) media.addEventListener("change", apply);
}

function createInitialState() {
  return {
    screen: "start",
    year: 1,
    periodIndex: 0,
    turn: 1,
    cash: 300,
    debt: 0,
    area: 3,
    cultivation: 30,
    management: 30,
    stamina: 70,
    trust: 30,
    machine: 70,
    weather: null,
    price: null,
    pendingEvent: null,
    turnResult: null,
    abilityNotice: null,
    animation: null,
    animationSkip: null,
    awaitingContinue: false,
    harvestedThisYear: false,
    settledThisYear: false,
    lastHarvest: null,
    lastSettlement: null,
    harvests: [],
    settlements: [],
    timeline: [],
    logs: [],
    abilities: [],
    counts: {
      water: 0,
      study: 0,
      sales: 0,
      maintenance: 0,
      rest: 0,
      highStaminaTurns: 0
    },
    yearData: emptyYearState()
  };
}

function emptyYearState() {
  return {
    yieldBonus: 0,
    priceBonus: 0,
    eventCost: 0,
    repairCost: 0,
    water: 0,
    weedControl: 0,
    pestControl: 0,
    typhoonPrep: 0,
    landEventPeriods: [],
    landEventsDone: [],
    extraActionsByPeriod: {},
    priceAnnounced: false,
    forecastBeforeHarvest: null,
    sales: 0,
    expenses: 0,
    agriculturalIncome: 0,
    profit: 0
  };
}

function startGame() {
  rememberPreviousRun();
  state = createInitialState();
  state.screen = "play";
  dom.finalShareButton.textContent = "結果をシェア";
  startYear();
  addLog("1年目", "3町の田んぼを引き継いだ。");
  render();
}

function rememberPreviousRun() {
  if (!state || (!state.logs.length && !state.settlements.length)) return;
  const averageYield = state.harvests.length
    ? Math.round(state.harvests.reduce((sum, h) => sum + h.yieldKg, 0) / state.harvests.length)
    : 0;
  const netWorth = finalAssetSummary().netWorth;
  previousRunLog = {
    title: state.harvests.length ? judgeTitle(netWorth, averageYield) : "途中終了",
    summary: state.settlements.length
      ? `${state.settlements.length}年目まで / 面積${formatArea(state.area)}町 / 純資産${netWorth}万円 / 借金${state.debt}万円`
      : `${state.year}年目 ${currentPeriod().label}まで`,
    logs: state.logs.slice(0, 18)
  };
}

function startYear() {
  state.periodIndex = 0;
  state.harvestedThisYear = false;
  state.settledThisYear = false;
  state.pendingEvent = null;
  state.turnResult = null;
  state.awaitingContinue = false;
  state.weather = weightedRandom(WEATHER_TABLE);
  state.price = weightedRandom(PRICE_TABLE);
  state.yearData = emptyYearState();
  state.yearData.landEventPeriods = planLandEventPeriods();
  state.yearData.extraActionsByPeriod = planExtraActions();
  addLog(`${state.year}年目`, `天候は${state.weather.label}、米価は7月末に発表。`);
}

function currentPeriod(s = state) {
  return PERIODS[s.periodIndex];
}

function currentActionIds() {
  const period = currentPeriod();
  const extra = state.yearData.extraActionsByPeriod[period.id];
  if (!extra) return period.actions;
  if (period.actions.includes(extra)) return period.actions;
  return [extra, ...period.actions];
}

async function handleAction(actionId) {
  if (state.pendingEvent || state.awaitingContinue || state.screen !== "play") return;
  const action = ACTIONS[actionId];
  const before = resultSnapshot();
  if (!isFeaturedAction(actionId)) await playDotAnimation(actionId);
  const balanceBefore = actionBalanceSnapshot();
  actionBalanceActive = true;
  let message;
  try {
    message = action.apply(state);
  } finally {
    actionBalanceActive = false;
  }
  applyActionBalance(balanceBefore);
  afterActionBookkeeping(actionId);
  state.turnResult = {
    period: `${state.year}年目 ${currentPeriod().label}`,
    action: action.label,
    actionId,
    before,
    after: resultSnapshot(),
    messages: [message],
    event: "イベントなし"
  };
  addLog(currentPeriod().label, message);
  unlockAbilities();

  const event = getForcedLandEvent() || (shouldTriggerEvent() ? LocalEventProvider.getEvent(state) : null);
  if (event) {
    state.pendingEvent = event;
  } else {
    finishPeriod();
    await playFeaturedResult(actionId, before);
  }
  render();
}

function afterActionBookkeeping(actionId) {
  if (actionId === "water" || actionId === "waterPrep") state.counts.water += 1;
  if (state.stamina >= 70) state.counts.highStaminaTurns += 1;
  changeStat(state, "machine", -machineWearForPeriod() * ACTION_NEGATIVE_RATE);
  if (state.stamina < 20 && Math.random() < 0.35) {
    state.yearData.yieldBonus -= 16;
    addLog(currentPeriod().label, "体力不足で作業精度が落ちた。収量-16kg。");
  }
  borrowIfNeeded();
}

function shouldTriggerEvent() {
  const lastLog = state.logs[0]?.text || "";
  if (lastLog.includes("イベント")) return false;
  let chance = 0.34;
  if (state.stamina < 35) chance += 0.08;
  if (state.machine < 35) chance += 0.08;
  if (hasAbility(state, "wellConnected") && [1, 8].includes(currentPeriod().id)) chance += 0.12;
  return Math.random() < Math.min(chance, 0.52);
}

function planLandEventPeriods() {
  const firstEvent = randomItem([1, 2]);
  const periods = [firstEvent];
  if (Math.random() < 0.55) periods.push(8);
  return periods;
}

function planExtraActions() {
  const plans = {};
  PERIODS.forEach((period) => {
    if (period.id === 8) return;
    if (period.actions.length >= 5) return;
    if (Math.random() > 0.42) return;
    const candidatesByPeriod = {
      1: ["neighborHelp", "materialCheck", "directVisit"],
      2: ["soilCare", "materialCheck", "morningPatrol"],
      4: ["morningPatrol", "soilCare", "neighborHelp"],
      5: ["morningPatrol", "directVisit", "soilCare"],
      6: ["morningPatrol", "materialCheck", "neighborHelp"],
      7: ["neighborHelp", "materialCheck"],
    };
    const candidates = candidatesByPeriod[period.id] || ["morningPatrol", "neighborHelp", "materialCheck"];
    plans[period.id] = randomItem(candidates);
  });
  return plans;
}

function getForcedLandEvent() {
  const period = currentPeriod().id;
  if (!state.yearData.landEventPeriods.includes(period)) return null;
  if (state.yearData.landEventsDone.includes(period)) return null;
  state.yearData.landEventsDone.push(period);
  return LocalEventProvider.getLandEvent(state);
}

function prepareLandEvent(event, gameState) {
  if (!event || gameState.year > 3) return event;
  return {
    ...event,
    choices: event.choices.map((choice) => {
      if (!choice.landOffer || !choice.effects?.area) return choice;
      const originalArea = choice.effects.area;
      const offerArea = randomLandOfferArea();
      const costPerArea = Math.abs(choice.effects.cash || 0) / originalArea;
      const cashCost = choice.effects.cash ? -Math.max(8, Math.round(costPerArea * offerArea)) : 0;
      const text = choice.text.includes("だけ") ? `${offerArea}町だけ` : `${offerArea}町引き受ける`;
      const prefix = choice.result?.replace(/面積\+[0-9.]+町。/, "").trim() || "";
      return {
        ...choice,
        text,
        effects: { ...choice.effects, area: offerArea, cash: cashCost },
        result: `${prefix ? `${prefix} ` : ""}面積+${offerArea}町。`
      };
    })
  };
}

function randomLandOfferArea() {
  return round1(0.6 + Math.random() * 0.6);
}

async function resolveEvent(choiceIndex) {
  if (!state.pendingEvent) return;
  const event = state.pendingEvent;
  const choice = event.choices[choiceIndex];
  const beforeChoice = resultSnapshot();
  const message = applyChoice(choice);
  addLog(currentPeriod().label, `${event.title}。${message}`);
  if (state.turnResult) {
    state.turnResult.event = event.title;
    state.turnResult.messages.push(message);
    state.turnResult.after = resultSnapshot();
  }
  state.pendingEvent = null;
  unlockAbilities();
  if (choice.landOffer && choice.effects?.area > 0) {
    await EventAnimation.play("landExpansion", { areaBefore: beforeChoice.area, areaAfter: state.area, delta: choice.effects.area });
  }
  finishPeriod();
  await playFeaturedResult(state.turnResult?.actionId, state.turnResult?.before);
  render();
}

function isFeaturedAction(actionId) {
  return ["carefulHarvest", "fastHarvest", "askHelp", "jaSales", "premiumSales"].includes(actionId);
}

async function playFeaturedResult(actionId, before) {
  if (!window.EventAnimation || !actionId) return;
  if (["carefulHarvest", "fastHarvest", "askHelp"].includes(actionId) && state.lastHarvest?.year === state.year) {
    await EventAnimation.play("harvest", { yieldKg: state.lastHarvest.yieldKg, yieldDelta: state.lastHarvest.yieldDelta });
  }
  if (["jaSales", "premiumSales"].includes(actionId) && state.lastSettlement?.year === state.year) {
    await EventAnimation.play("sale", { salesYen: state.lastSettlement.sales * 10000, price: state.lastHarvest.price, cashBefore: before?.cash, cashAfter: state.cash });
  }
}

function applyChoice(choice) {
  if (choice.dynamic === "borrowMachine") {
    const cost = state.trust >= 60 ? 12 : state.trust >= 40 ? 24 : 38;
    spendCash(state, cost, "農機借用費");
    changeStat(state, "trust", state.trust >= 40 ? 1 : -1);
    return `近所から借りた。費用${cost}万円。`;
  }
  if (choice.effects) applyEffects(choice.effects);
  if (choice.risk) {
    const failed = Math.random() < choice.risk.probability;
    if (failed) {
      state.yearData.yieldBonus += choice.risk.yieldBonus || 0;
      return `${choice.result || "様子を見た。"} 失敗して収量${choice.risk.yieldBonus}kg。`;
    }
    return `${choice.result || "様子を見た。"} うまく切り抜けた。`;
  }
  return choice.result || "対応した。";
}

function applyEffects(effects) {
  Object.entries(effects).forEach(([key, value]) => {
    if (key === "cash") spendCash(state, Math.abs(value), value < 0 ? "イベント費" : "収入", value > 0);
    if (key === "area") state.area = round1(state.area + value);
    if (key === "yieldBonus") state.yearData.yieldBonus += value;
    if (key === "priceBonus") state.yearData.priceBonus += value;
    if (key === "water") state.yearData.water += value;
    if (key === "weedControl") state.yearData.weedControl += value;
    if (key === "pestControl") state.yearData.pestControl += value;
    if (key === "typhoonPrep") state.yearData.typhoonPrep += value;
    if (["cultivation", "management", "stamina", "trust", "machine"].includes(key)) changeStat(state, key, value);
  });
}

function finishPeriod() {
  if (currentPeriod().id === 5 && !state.yearData.priceAnnounced) {
    announceRicePrice();
  }
  if (currentPeriod().id === 7 && !state.harvestedThisYear) {
    harvest();
    state.harvestedThisYear = true;
  }
  if (currentPeriod().id === 8 && !state.settledThisYear) {
    settleYear();
    state.settledThisYear = true;
  }
  if (state.turnResult) state.turnResult.after = resultSnapshot();
  state.awaitingContinue = true;
}

function announceRicePrice() {
  state.yearData.priceAnnounced = true;
  const message = `コメ価格の発表。${state.price.label}、${formatYen(state.price.yen)}円 / 60kg。`;
  addLog(currentPeriod().label, message);
  if (state.turnResult) {
    state.turnResult.event = "コメ価格の発表";
    state.turnResult.ricePriceAnnouncement = {
      label: state.price.label,
      yen: state.price.yen
    };
    state.turnResult.messages.push(message);
    state.turnResult.after = resultSnapshot();
  }
}

function playDotAnimation(actionId) {
  const animation = animationForAction(actionId);
  state.animation = animation;
  renderDotStage();
  renderActions();
  return new Promise((resolve) => {
    const done = () => {
      if (state.animationSkip !== done) return;
      state.animationSkip = null;
      state.animation = null;
      renderDotStage();
      renderActions();
      resolve();
    };
    state.animationSkip = done;
    window.setTimeout(done, animation.duration);
  });
}

function skipDotAnimation() {
  if (state.animationSkip) state.animationSkip();
}

function animationForAction(actionId) {
  const period = currentPeriod();
  const map = {
    water: { type: "water", title: "水管理", hint: "畦道を歩いて水を見る", field: "field-water", actor: "walk", effect: "", duration: 1350 },
    waterPrep: { type: "till", title: "耕す・水準備", hint: "田んぼを整える", field: "field-tilled", machine: "tractor move", effect: "", duration: 1500 },
    carefulPlanting: { type: "plant", title: "田植え", hint: "苗の列が並ぶ", field: "field-seedlings", machine: "planter move", effect: "", duration: 1550 },
    fastPlanting: { type: "plant", title: "田植え", hint: "一気に植える", field: "field-seedlings", machine: "planter move", effect: "", duration: 1300 },
    pestControl: { type: "pest", title: "防除", hint: "虫のリスクを抑える", field: "field-growing", actor: "walk", effect: "effect-pest", duration: 1450 },
    weeding: { type: "weed", title: "除草", hint: "雑草を減らす", field: "field-growing", actor: "walk", effect: "effect-pest", duration: 1300 },
    maintenance: { type: "maintenance", title: "機械整備", hint: "農機コンディション回復", field: fieldClassForPeriod(period.id), machine: "tractor", effect: "effect-tools", duration: 1350 },
    carefulHarvest: { type: "harvest", title: "収穫", hint: "コンバインが稲を刈る", field: "field-harvested", machine: "combine move", effect: "effect-money", duration: 1650 },
    fastHarvest: { type: "harvest", title: "収穫", hint: "急いで刈り取る", field: "field-harvested", machine: "combine move", effect: "effect-money", duration: 1400 },
    askHelp: { type: "harvest", title: "収穫応援", hint: "みんなで収穫を進める", field: "field-harvested", machine: "combine move", effect: "effect-money", duration: 1450 },
    cultivationResearch: { type: "research", title: "栽培研究", hint: "生育を見て改善する", field: "field-growing", actor: "walk", effect: "effect-tools", duration: 1200 },
    sales: { type: "sales", title: "営業", hint: "販路を広げる", field: fieldClassForPeriod(period.id), actor: "walk", effect: "effect-money", duration: 1100 },
    study: { type: "study", title: "勉強", hint: "知識を増やす", field: fieldClassForPeriod(period.id), actor: "", effect: "effect-tools", duration: 1000 },
    rest: { type: "rest", title: "休養", hint: "体力を回復", field: fieldClassForPeriod(period.id), actor: "", effect: "", duration: 900 },
    jaSales: { type: "sales", title: "販売", hint: "米を売る準備", field: "field-harvested", actor: "walk", effect: "effect-money", duration: 1100 },
    premiumSales: { type: "sales", title: "高値販売", hint: "取引先に売り込む", field: "field-harvested", actor: "walk", effect: "effect-money", duration: 1200 }
  };
  return map[actionId] || { type: "idle", title: ACTIONS[actionId]?.label || "作業", hint: "作業中", field: fieldClassForPeriod(period.id), actor: "", effect: "", duration: 1000 };
}

function nextPeriod() {
  if (!state.awaitingContinue) return;
  state.awaitingContinue = false;
  state.pendingEvent = null;
  state.turnResult = null;
  state.abilityNotice = null;
  if (state.periodIndex < PERIODS_PER_YEAR - 1) {
    state.periodIndex += 1;
  } else if (state.year < MAX_YEARS) {
    state.year += 1;
    startYear();
  } else {
    state.screen = "final";
  }
  render();
  scrollGameToTop();
}

function scrollGameToTop() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const shell = document.querySelector(".app-shell");
    if (shell && typeof shell.scrollTo === "function") shell.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

function harvest() {
  const forecastBeforeHarvest = forecastYield();
  const weatherBonus = weatherYieldBonus();
  const skillBonus = (state.cultivation - 30) * 2;
  const positiveBonus = positivePart(weatherBonus) + positivePart(skillBonus) + positivePart(state.yearData.yieldBonus);
  const negativeBonus = negativePart(weatherBonus) + negativePart(skillBonus) + negativePart(state.yearData.yieldBonus);
  const adjustedBonus = Math.round(positiveBonus * productionEfficiency()) + negativeBonus;
  const overAreaPenalty = Math.max(0, state.area - manageableArea()) * 28;
  const staminaPenalty = state.stamina < 25 ? 30 : state.stamina < 40 ? 14 : 0;
  const machinePenalty = state.machine < 25 ? 32 : state.machine < 45 ? 16 : 0;
  const weedPenalty = state.yearData.weedControl <= 0 ? 12 : 0;
  const pestPenalty = state.yearData.pestControl <= 0 ? 10 : 0;
  const yieldKg = clamp(Math.round(BASE_YIELD_KG + adjustedBonus - overAreaPenalty - staminaPenalty - machinePenalty - weedPenalty - pestPenalty), 280, 600);
  const price = finalRicePrice();
  const bales = (yieldKg / 60) * state.area * 10;
  const sales = Math.round((bales * price) / 10000);
  state.yearData.sales = sales;
  state.yearData.forecastBeforeHarvest = forecastBeforeHarvest;
  state.lastHarvest = {
    year: state.year,
    yieldKg,
    forecastYieldKg: forecastBeforeHarvest,
    yieldDelta: yieldKg - forecastBeforeHarvest,
    price,
    sales,
    area: state.area
  };
  state.harvests.push(state.lastHarvest);
  addLog("収穫", `収量${yieldKg}kg、売上${sales}万円。`);
}

function settleYear() {
  if (!state.lastHarvest || state.lastHarvest.year !== state.year) harvest();
  const expenses = annualExpenses();
  state.yearData.expenses = expenses;
  const agriculturalIncome = agriculturalIncomeFor({
    sales: state.yearData.sales,
    expenses,
    eventCost: state.yearData.eventCost
  });
  const annualCashChange = annualCashChangeFor({
    agriculturalIncome,
    livingCost: ANNUAL_LIVING_COST,
    equipmentCost: state.yearData.repairCost
  });
  state.yearData.agriculturalIncome = agriculturalIncome;
  state.yearData.profit = agriculturalIncome;
  state.cash += state.yearData.sales - expenses - ANNUAL_LIVING_COST;
  borrowIfNeeded();
  autoRepay();
  const settlement = {
    year: state.year,
    sales: state.yearData.sales,
    expenses,
    expensePer10a: expensePer10a(expenses, state.area),
    eventCost: state.yearData.eventCost,
    repairCost: state.yearData.repairCost,
    equipmentCost: state.yearData.repairCost,
    agriculturalIncome,
    profit: agriculturalIncome,
    livingCost: ANNUAL_LIVING_COST,
    annualCashChange,
    laborHours: ANNUAL_LABOR_HOURS,
    hourlyWage: effectiveHourlyWage(agriculturalIncome),
    cash: state.cash,
    debt: state.debt,
    area: state.area,
    yieldKg: state.lastHarvest.yieldKg,
    forecastYieldKg: state.lastHarvest.forecastYieldKg,
    yieldDelta: state.lastHarvest.yieldDelta
  };
  settlement.comment = settlementComment(settlement);
  state.lastSettlement = settlement;
  state.settlements.push(settlement);
  addTimeline(settlement);
  addLog("決算", `${state.year}年目農業所得${agriculturalIncome}万円。${settlement.comment}`);
}

function settlementComment(settlement) {
  if (settlement.agriculturalIncome >= 650 && settlement.debt <= 0) return "米も財布もよく実った。";
  if (settlement.agriculturalIncome >= 350 && settlement.area >= 7) return "労働時間は見なかったことにして、今年も伸びた。";
  if (settlement.agriculturalIncome >= 150) return "ちゃんと前に進んだ一年。えらい。";
  if (settlement.agriculturalIncome >= 0 && settlement.debt >= 800) return "今年もなんとか生き残った。";
  if (settlement.agriculturalIncome >= 0) return "黒字。拍手は小さめ、でも本物。";
  if (settlement.debt >= 1000) return "借金は増えたが、田んぼは逃げていない。";
  return "反省点は多い。でも来年の田んぼはまだある。";
}

function addTimeline(settlement) {
  const notes = [];
  if (settlement.year === 1) notes.push("3町の田んぼから出発");
  if (settlement.yieldKg >= 500) notes.push(`高収量${settlement.yieldKg}kgを記録`);
  if (settlement.area >= 8) notes.push(`経営面積${formatArea(settlement.area)}へ拡大`);
  if (settlement.debt > 0) notes.push(`借金${settlement.debt}万円を抱えて踏ん張る`);
  const newAbility = state.abilities[state.abilities.length - 1];
  if (newAbility) notes.push(`${abilityName(newAbility)}を武器にする`);
  state.timeline.push({
    year: settlement.year,
    text: notes[0] || `収量${settlement.yieldKg}kg、農業所得${settlement.agriculturalIncome}万円`
  });
}

function annualExpenses(s = state) {
  const basePer10a = s.area >= 8 ? 5.2 : s.area >= 5 ? 5.5 : 6;
  const base = s.area * 10 * basePer10a;
  const discount = hasAbility(s, "numbers") ? 0.9 : 1;
  return Math.round(base * discount);
}

function agriculturalIncomeFor(data) {
  return Math.round(data.sales - data.expenses - data.eventCost);
}

function settlementAgriculturalIncome(settlement) {
  return settlement.agriculturalIncome ?? settlement.profit ?? 0;
}

function annualCashChangeFor(data) {
  return Math.round(data.agriculturalIncome - data.livingCost - data.equipmentCost);
}

function expensePer10a(expenses, area) {
  const units = Math.max(1, area * 10);
  return Math.round((expenses / units) * 10) / 10;
}

function effectiveHourlyWage(agriculturalIncome) {
  return Math.round((agriculturalIncome * 10000) / ANNUAL_LABOR_HOURS);
}

function settlementExpensePer10a(settlement) {
  return settlement.expensePer10a ?? expensePer10a(settlement.expenses ?? 0, settlement.area ?? state.area);
}

function finalAssetSummary(s = state) {
  const equipment = Math.round(90 + s.area * 40 + s.machine * 2);
  return {
    cash: s.cash,
    equipment,
    other: 0,
    debt: s.debt,
    netWorth: s.cash + equipment - s.debt
  };
}

function finalRicePrice() {
  const variance = randomInt(-800, 800);
  const abilityBonus = hasAbility(state, "brandRice") ? 0.1 : 0;
  return Math.max(12000, Math.round((state.price.yen + variance) * (1 + state.yearData.priceBonus + abilityBonus)));
}

function weatherYieldBonus() {
  if (state.weather.id === "typhoon") {
    const damage = randomInt(10, 40) - state.yearData.typhoonPrep * 12;
    return -Math.max(0, damage);
  }
  if (state.weather.id === "hot") {
    let damage = 30 - state.yearData.water * 8;
    if (hasAbility(state, "waterSense")) damage = Math.round(damage / 2);
    return -Math.max(0, damage);
  }
  return state.weather.yieldBonus;
}

function forecastYield() {
  if (!state.weather) return BASE_YIELD_KG;
  const assumedWeather = state.weather.id === "typhoon" ? -24 : weatherYieldBonus();
  const skillBonus = (state.cultivation - 30) * 2;
  const positiveBonus = positivePart(assumedWeather) + positivePart(skillBonus) + positivePart(state.yearData.yieldBonus);
  const negativeBonus = negativePart(assumedWeather) + negativePart(skillBonus) + negativePart(state.yearData.yieldBonus);
  const adjustedBonus = Math.round(positiveBonus * productionEfficiency()) + negativeBonus;
  return clamp(Math.round(BASE_YIELD_KG + adjustedBonus - Math.max(0, state.area - manageableArea()) * 28), 280, 600);
}

function productionEfficiency() {
  if (state.machine <= 30 && state.stamina <= 30) return 0.65;
  if (state.machine <= 50 && state.stamina <= 50) return 0.8;
  return 1;
}

function efficiencyLabel() {
  const efficiency = productionEfficiency();
  if (efficiency === 0.65) return "+補正 x0.65";
  if (efficiency === 0.8) return "+補正 x0.8";
  return "通常";
}

function positivePart(value) {
  return Math.max(0, value);
}

function negativePart(value) {
  return Math.min(0, value);
}

function manageableArea() {
  return round1(4 + (state.cultivation - 30) / 18 + (state.management - 30) / 16 + (state.stamina - 50) / 35);
}

function unlockAbilities() {
  ABILITIES.forEach((ability) => {
    if (!hasAbility(state, ability.id) && ability.condition(state)) {
      state.abilities.push(ability.id);
      state.abilityNotice = ability;
      addLog("特殊能力", `${ability.name}を取得。${ability.description}。`);
    }
  });
}

function hasAbility(s, id) {
  return s.abilities.includes(id);
}

function changeStat(s, key, delta) {
  const max = key === "area" ? 99 : 100;
  s[key] = clamp(Math.round((s[key] + delta) * 10) / 10, 0, max);
}

function actionBalanceSnapshot() {
  return {
    cash: state.cash,
    cultivation: state.cultivation,
    management: state.management,
    stamina: state.stamina,
    trust: state.trust,
    machine: state.machine,
    yieldBonus: state.yearData.yieldBonus,
    priceBonus: state.yearData.priceBonus,
    eventCost: state.yearData.eventCost,
    repairCost: state.yearData.repairCost,
    water: state.yearData.water,
    weedControl: state.yearData.weedControl,
    pestControl: state.yearData.pestControl,
    typhoonPrep: state.yearData.typhoonPrep
  };
}

function applyActionBalance(before) {
  ["cash", "cultivation", "management", "stamina", "trust", "machine"].forEach((key) => {
    const max = key === "cash" ? 99999 : 100;
    state[key] = clamp(roundEffect(before[key] + scaledActionDelta(state[key] - before[key])), 0, max);
  });
  ["yieldBonus", "priceBonus", "water", "weedControl", "pestControl", "typhoonPrep"].forEach((key) => {
    state.yearData[key] = roundEffect(before[key] + scaledActionDelta(state.yearData[key] - before[key]));
  });
  ["eventCost", "repairCost"].forEach((key) => {
    state.yearData[key] = roundEffect(before[key] + scaledActionCostDelta(state.yearData[key] - before[key]));
  });
}

function scaledActionDelta(delta) {
  if (delta > 0) return delta * ACTION_POSITIVE_RATE;
  if (delta < 0) return delta * ACTION_NEGATIVE_RATE;
  return 0;
}

function scaledActionCostDelta(delta) {
  if (delta > 0) return delta * ACTION_NEGATIVE_RATE;
  if (delta < 0) return delta * ACTION_POSITIVE_RATE;
  return 0;
}

function roundEffect(value) {
  const scale = Math.abs(value) < 1 ? 1000 : 10;
  return Math.round(value * scale) / scale;
}

function consumeStamina(s, amount) {
  const adjusted = hasAbility(s, "ironman") ? Math.max(1, amount - 2) : amount;
  changeStat(s, "stamina", -adjusted * areaStaminaLoad(s));
}

function spendCash(s, amount, label, isIncome = false) {
  if (isIncome) {
    s.cash += amount;
    return;
  }
  s.cash -= amount;
  if (label && label.includes("修理")) s.yearData.repairCost += amount;
  else s.yearData.eventCost += amount;
  if (actionBalanceActive) return;
  borrowIfNeeded();
}

function borrowIfNeeded() {
  if (state.cash >= 0) return;
  const loan = Math.ceil(Math.abs(state.cash) / 100) * 100;
  state.cash += loan;
  state.debt += loan;
  addLog("借入", `${loan}万円を自動借入。`);
}

function autoRepay() {
  if (state.cash <= 450 || state.debt <= 0) return;
  const repayment = Math.min(state.debt, Math.floor((state.cash - 300) / 100) * 100);
  if (repayment <= 0) return;
  state.cash -= repayment;
  state.debt -= repayment;
  addLog("返済", `余裕資金から${repayment}万円を自動返済。`);
}

function machineWearForPeriod() {
  const baseWear = [2, 4, 7, 2, 2, 3, 9, 3][currentPeriod().id - 1] || 2;
  return baseWear * areaMachineLoad(state);
}

function areaStaminaLoad(s = state) {
  return Math.min(1.42, 1 + Math.max(0, s.area - 3) * 0.035);
}

function areaMachineLoad(s = state) {
  return Math.min(1.52, 1 + Math.max(0, s.area - 3) * 0.045);
}

function render() {
  dom.startScreen.classList.toggle("hidden", state.screen !== "start");
  dom.playScreen.classList.toggle("hidden", state.screen !== "play");
  dom.finalScreen.classList.toggle("hidden", state.screen !== "final");
  document.body.classList.toggle("screen-start", state.screen === "start");
  document.body.classList.toggle("screen-final", state.screen === "final");
  const resultFirst =
    state.screen === "play" &&
    state.awaitingContinue &&
    ((currentPeriod().id === 7 && state.harvestedThisYear) ||
      (currentPeriod().id === 8 && state.settledThisYear));
  dom.playScreen.classList.toggle("result-first", resultFirst);
  renderHeader();
  renderStats();
  renderMain();
  renderActions();
  renderDotStage();
  renderAbilityNotice();
  renderLog();
  renderPreviousLog();
  if (state.screen === "final") renderFinal();
}

function renderHeader() {
  dom.headerYear.textContent = state.screen === "start" ? "5年間" : `${state.year}年目`;
  dom.headerPeriod.textContent = state.screen === "start" ? "LITE" : currentPeriod().label;
  dom.headerTurn.textContent = state.screen === "start" ? `TURN 1 / ${TOTAL_TURNS}` : `TURN ${turnNumber()} / ${TOTAL_TURNS}`;
}

function renderStats() {
  dom.cultivationValue.textContent = state.cultivation;
  dom.managementValue.textContent = state.management;
  dom.staminaValue.textContent = state.stamina;
  dom.trustValue.textContent = state.trust;
  dom.cashValue.textContent = `${state.cash}万円`;
  dom.cashValue.className = state.cash < 100 ? "negative" : "positive";
  dom.debtValue.textContent = `${state.debt}万円`;
  dom.debtValue.className = state.debt > 0 ? "negative" : "";
  dom.areaValue.textContent = `${formatArea(state.area)}町`;
  dom.machineValue.textContent = state.machine;
  dom.areaDataValue.textContent = `${formatArea(state.area)}町`;
  dom.expenseValue.textContent = `${annualExpenses()}万円`;
  dom.priceBonusValue.textContent = `+${Math.round(state.yearData.priceBonus * 100)}%`;
  dom.efficiencyValue.textContent = efficiencyLabel();
  dom.efficiencyValue.className = productionEfficiency() < 1 ? "negative" : "positive";
  renderMobileHud();
  renderAbilities();
}

function renderMobileHud() {
  if (!dom.mobileYearPeriod) return;
  const period = state.screen === "play" ? currentPeriod() : PERIODS[0];
  dom.mobileYearPeriod.textContent = state.screen === "play" ? `${state.year}年目 ${period.label}` : "5年間";
  dom.mobileTurn.textContent = state.screen === "play" ? `TURN ${turnNumber()} / ${TOTAL_TURNS}` : `TURN 1 / ${TOTAL_TURNS}`;
  dom.mobileCultivation.textContent = state.cultivation;
  dom.mobileManagement.textContent = state.management;
  dom.mobileStamina.textContent = state.stamina;
  dom.mobileTrust.textContent = state.trust;
  dom.mobileCash.textContent = `${state.cash}万`;
  dom.mobileCash.className = state.cash < 100 ? "negative" : "positive";
  dom.mobileDebt.textContent = `${state.debt}万`;
  dom.mobileDebt.className = state.debt > 0 ? "negative" : "";
  dom.mobileArea.textContent = `${formatArea(state.area)}町`;
  dom.mobileMachine.textContent = state.machine;
  if (dom.mobileForecastYieldValue) {
    dom.mobileForecastYieldValue.textContent = `${forecastYield()}kg / 10a`;
    dom.mobileLastYieldValue.textContent = state.harvests.length ? `${last(state.harvests).yieldKg}kg / 10a` : "-";
    dom.mobileLastSalesValue.textContent = state.harvests.length ? `${last(state.harvests).sales}万円` : "-";
    dom.mobileExpenseValue.textContent = `${annualExpenses()}万円`;
    dom.mobileAreaDataValue.textContent = `${formatArea(state.area)}町`;
    dom.mobilePriceBonusValue.textContent = `+${Math.round(state.yearData.priceBonus * 100)}%`;
    dom.mobileEfficiencyValue.textContent = efficiencyLabel();
    dom.mobileEfficiencyValue.className = productionEfficiency() < 1 ? "negative" : "positive";
    dom.mobileRicePriceValue.textContent = ricePriceDisplayText();
  }
}

function renderAbilities() {
  dom.abilitiesList.innerHTML = "";
  dom.abilityCount.textContent = `${state.abilities.length} / ${ABILITIES.length}`;
  ABILITIES.forEach((ability) => {
    const acquired = hasAbility(state, ability.id);
    const item = document.createElement("li");
    item.className = acquired ? "acquired" : "locked";
    item.innerHTML = acquired
      ? `<strong>${ability.icon} ${ability.name}</strong><small>${ability.description}</small>`
      : `<strong>? 未取得</strong><small>ヒント: ${ability.hint}</small>`;
    dom.abilitiesList.appendChild(item);
  });
}

function renderMain() {
  if (state.screen !== "play") return;
  const period = currentPeriod();
  dom.yearValue.textContent = state.year;
  dom.periodValue.textContent = period.label;
  dom.periodTheme.textContent = period.theme;
  dom.weatherValue.textContent = state.weather.label;
  dom.priceValue.textContent = ricePriceDisplayText();
  dom.forecastYieldValue.textContent = `${forecastYield()}kg / 10a`;
  dom.lastYieldValue.textContent = state.harvests.length ? `${last(state.harvests).yieldKg}kg / 10a` : "-";
  dom.lastSalesValue.textContent = state.harvests.length ? `${last(state.harvests).sales}万円` : "-";
  renderEvent(period);
  renderHarvest();
  renderSettlement();
}

function ricePriceDisplayText() {
  if (state.screen !== "play") return "-";
  return state.yearData.priceAnnounced
    ? `${state.price.label} ${formatYen(state.price.yen)}円`
    : "7月末に発表";
}

function renderEvent(period) {
  dom.eventChoices.innerHTML = "";
  dom.turnResult.innerHTML = "";
  dom.turnResult.classList.add("hidden");
  if (state.pendingEvent) {
    dom.eventTitle.textContent = state.pendingEvent.title;
    dom.eventDescription.textContent = state.pendingEvent.description;
    state.pendingEvent.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.type = "button";
      button.textContent = choice.text;
      button.addEventListener("click", () => resolveEvent(index));
      dom.eventChoices.appendChild(button);
    });
    dom.eventChoices.classList.remove("hidden");
    return;
  }
  if (state.awaitingContinue && state.turnResult) {
    dom.eventTitle.textContent = "1ターンの結果";
    dom.eventDescription.textContent = "結果を確認したら次の時期へ進もう。";
    dom.turnResult.innerHTML = renderTurnResultHtml(state.turnResult);
    dom.turnResult.classList.remove("hidden");
    dom.eventChoices.classList.add("hidden");
    return;
  }
  dom.eventTitle.textContent = `${state.year}年目・${period.label}`;
  dom.eventDescription.textContent = period.prompt;
  dom.eventChoices.classList.add("hidden");
}

function resultSnapshot() {
  return {
    cultivation: state.cultivation,
    management: state.management,
    stamina: state.stamina,
    trust: state.trust,
    cash: state.cash,
    debt: state.debt,
    area: state.area,
    machine: state.machine,
    yieldBonus: state.yearData.yieldBonus,
    priceBonus: Math.round(state.yearData.priceBonus * 100)
  };
}

function renderTurnResultHtml(result) {
  const deltas = [
    ["栽培力", "cultivation", ""],
    ["経営力", "management", ""],
    ["体力", "stamina", ""],
    ["信用", "trust", ""],
    ["資金", "cash", "万円"],
    ["借金", "debt", "万円"],
    ["面積", "area", "町"],
    ["農機", "machine", ""],
    ["収量補正", "yieldBonus", "kg"],
    ["販売補正", "priceBonus", "%"]
  ].map(([label, key, unit]) => {
    const diff = round1(result.after[key] - result.before[key]);
    if (diff === 0) return "";
    const sign = diff > 0 ? "+" : "";
    const className = diff > 0 ? "positive" : "negative";
    return `<span class="${className}">${label} ${sign}${diff}${unit}</span>`;
  }).filter(Boolean).join("");

  const announcement = result.ricePriceAnnouncement ? `
    <div class="rice-price-announcement">
      <span>コメ価格の発表</span>
      <strong>${result.ricePriceAnnouncement.label} ${formatYen(result.ricePriceAnnouncement.yen)}円 / 60kg</strong>
    </div>
  ` : "";
  const messages = result.messages.map((message) => `<li>${message}</li>`).join("");
  return `
    <div class="turn-result-head">
      <strong>${result.period}</strong>
      <span>${result.action} / ${result.event}</span>
    </div>
    ${announcement}
    <ul>${messages}</ul>
    <div class="delta-row">${deltas || "<span>大きな数値変化なし</span>"}</div>
  `;
}

function renderActions() {
  dom.actionButtons.innerHTML = "";
  const canAct = state.screen === "play" && !state.pendingEvent && !state.awaitingContinue && !state.animation;
  if (state.screen !== "play") return;
  const actionIds = currentActionIds();
  dom.actionButtons.classList.toggle("few-actions", actionIds.length <= 2 && !state.awaitingContinue);
  actionIds.forEach((id) => {
    const action = ACTIONS[id];
    const button = document.createElement("button");
    button.className = action.temporary ? "action-button temporary-action" : "action-button";
    button.dataset.category = actionCategory(id);
    button.type = "button";
    button.disabled = !canAct;
    const badge = actionBadge(id);
    button.innerHTML = `${badge ? `<span class="action-badge ${badge.kind}">${badge.label}</span>` : ""}${action.label}<small>${action.detail}</small>`;
    button.addEventListener("click", () => handleAction(id));
    dom.actionButtons.appendChild(button);
  });
  dom.continueButton.classList.toggle("hidden", !state.awaitingContinue);
  const isFinalTurn = state.year === MAX_YEARS && currentPeriod().id === 8;
  const showTapHint = !isFinalTurn && turnNumber() <= 3;
  const isResultContinue =
    state.awaitingContinue &&
    ((currentPeriod().id === 7 && state.harvestedThisYear) ||
      (currentPeriod().id === 8 && state.settledThisYear));
  dom.continueButton.textContent = isFinalTurn ? "最終結果へ" : "次の時期へ";
  dom.continueButton.classList.toggle("tap-hint", state.awaitingContinue && showTapHint);
  dom.continueButton.classList.toggle("result-continue", isResultContinue);
}

function actionCategory(actionId) {
  if (["sales", "jaSales", "premiumSales", "directVisit"].includes(actionId)) return "sales";
  if (["maintenance", "fastPlanting", "fastHarvest"].includes(actionId)) return "machine";
  if (["rest", "askHelp"].includes(actionId)) return "stamina";
  if (["study", "materialCheck"].includes(actionId)) return "management";
  if (actionId === "neighborHelp") return "trust";
  return "cultivation";
}

function actionBadge(actionId) {
  if (state.stamina <= 28 && actionId === "rest") return { kind: "recommend", label: "おすすめ" };
  if (state.machine <= 35 && actionId === "maintenance") return { kind: "recommend", label: "おすすめ" };
  if (currentPeriod().id === 7 && actionId === "askHelp" && state.area > manageableArea()) return { kind: "recommend", label: "おすすめ" };
  if (state.trust >= 55 && ["sales", "premiumSales", "directVisit"].includes(actionId)) return { kind: "recommend", label: "伸びる" };
  if (state.stamina <= 35 && !["rest", "jaSales"].includes(actionId)) return { kind: "caution", label: "注意" };
  if (state.machine <= 30 && ["fastPlanting", "fastHarvest"].includes(actionId)) return { kind: "caution", label: "危険" };
  if (state.area > manageableArea() + 0.8 && ["fastPlanting", "fastHarvest"].includes(actionId)) return { kind: "caution", label: "危険" };
  return null;
}

function renderDotStage() {
  if (!dom.dotStage) return;
  const periodId = state.screen === "play" ? currentPeriod().id : 1;
  const animation = state.animation;
  const fieldClass = animation?.field || fieldClassForPeriod(periodId);
  dom.dotStage.className = `dot-stage${animation ? " animating" : ""}`;
  dom.fieldLayer.className = `field-layer ${fieldClass}`;
  dom.weatherLayer.className = `weather-layer ${weatherClass()}`;
  dom.actorSprite.className = `sprite actor ${animation?.actor || "idle"}`;
  const machineClass = animation?.machine;
  dom.machineSprite.className = machineClass ? `sprite machine ${machineClass}` : "sprite machine hidden";
  dom.effectLayer.className = `effect-layer ${animation?.effect || ""}`;
  dom.dotTitle.textContent = animation?.title || stageTitleForPeriod(periodId);
  dom.dotHint.textContent = animation ? `${animation.hint}（クリックでスキップ）` : stageHintForPeriod(periodId);
}

function fieldClassForPeriod(periodId) {
  if (periodId <= 1) return "field-idle";
  if (periodId === 2) return "field-tilled";
  if (periodId === 3) return "field-water";
  if (periodId === 4) return "field-seedlings";
  if (periodId === 5) return "field-growing";
  if (periodId === 6) return "field-ripe";
  return "field-harvested";
}

function stageTitleForPeriod(periodId) {
  return ["冬の田んぼ", "田んぼの準備", "田植え前", "苗の田んぼ", "夏の田んぼ", "実りの田んぼ", "収穫期", "収穫後"][periodId - 1] || "田んぼの様子";
}

function stageHintForPeriod(periodId) {
  return ["今年の計画を立てよう", "土と水の準備を進める", "田植えが近い", "水と雑草を見る", "暑さに備える", "病害虫に注意", "収穫の時期", "販売と決算"][periodId - 1] || "行動を選ぼう";
}

function weatherClass() {
  if (!state.weather) return "";
  if (state.weather.id === "sunny") return "weather-sunny";
  if (state.weather.id === "hot") return "weather-hot";
  if (state.weather.id === "rain") return "weather-rain";
  if (state.weather.id === "typhoon") return "weather-typhoon";
  return "";
}

function renderHarvest() {
  const h = state.lastHarvest;
  const show = h && h.year === state.year && state.harvestedThisYear;
  dom.harvestCard.classList.toggle("hidden", !show);
  if (!show) return;
  const forecastYieldKg = h.forecastYieldKg ?? h.yieldKg;
  const yieldDelta = h.yieldDelta ?? 0;
  dom.harvestCard.innerHTML = `
    <h3>${h.year}年目 収穫!</h3>
    <div class="stars">${yieldStars(h.yieldKg)}</div>
    <div class="harvest-grid">
      <div class="yield-compare wide"><span>収量</span><strong>予想${forecastYieldKg} → 実績${h.yieldKg}kg / 10a</strong><small class="${yieldDelta >= 0 ? "positive" : "negative"}">${signedNumber(yieldDelta)}kg / 10a</small></div>
      <div><span>米価</span><strong>${formatYen(h.price)}円 / 60kg</strong></div>
      <div><span>経営面積</span><strong>${formatArea(h.area)}町</strong></div>
      <div><span>売上</span><strong>${h.sales}万円!</strong></div>
    </div>`;
}

function renderSettlement() {
  const y = state.lastSettlement;
  const show = y && y.year === state.year && state.settledThisYear;
  dom.settlementCard.classList.toggle("hidden", !show);
  if (!show) return;
  const agriculturalIncome = settlementAgriculturalIncome(y);
  const expenseUnit = settlementExpensePer10a(y);
  const equipmentCost = y.equipmentCost ?? y.repairCost ?? 0;
  const livingCost = y.livingCost ?? ANNUAL_LIVING_COST;
  const annualCashChange = y.annualCashChange ?? annualCashChangeFor({ agriculturalIncome, livingCost, equipmentCost });
  const laborHours = y.laborHours ?? ANNUAL_LABOR_HOURS;
  const hourlyWage = y.hourlyWage ?? effectiveHourlyWage(agriculturalIncome);
  const forecastYieldKg = y.forecastYieldKg ?? y.yieldKg;
  const yieldDelta = y.yieldDelta ?? 0;
  dom.settlementCard.innerHTML = `
    <h3>${y.year}年目 決算</h3>
    <p class="settlement-comment">${y.comment}</p>
    <div class="harvest-grid">
      <div class="yield-compare wide"><span>収量</span><strong>予想${forecastYieldKg} → 実績${y.yieldKg}kg / 10a</strong><small class="${yieldDelta >= 0 ? "positive" : "negative"}">天候等による変化 ${signedNumber(yieldDelta)}kg / 10a</small></div>
      <div><span>売上</span><strong>${y.sales}万円</strong></div>
      <div><span>年間経費</span><strong>${y.expenses}万円</strong></div>
      <div><span>10a当たり経費</span><strong>${expenseUnit}万円 / 10a</strong></div>
      <div><span>イベント費用</span><strong>${y.eventCost}万円</strong></div>
      <div><span>設備投資・修理</span><strong>${equipmentCost}万円</strong></div>
      <div><span>農業所得</span><strong class="${agriculturalIncome >= 0 ? "positive" : "negative"}">${agriculturalIncome}万円</strong></div>
      <div><span>年間労働時間</span><strong>${formatNumber(laborHours)}時間</strong></div>
      <div><span>実質時給</span><strong class="${hourlyWage >= 1000 ? "positive" : "negative"}">${formatNumber(hourlyWage)}円</strong></div>
      <div><span>生活費</span><strong>${livingCost}万円</strong></div>
      <div><span>年間資金増減</span><strong class="${annualCashChange >= 0 ? "positive" : "negative"}">${signedNumber(annualCashChange)}万円</strong></div>
      <div><span>資金</span><strong>${y.cash}万円</strong></div>
      <div><span>借金</span><strong>${y.debt}万円</strong></div>
    </div>`;
}

function renderLog() {
  dom.gameLog.innerHTML = "";
  state.logs.slice(0, 70).forEach((entry) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${entry.period}</strong> ${entry.text}`;
    dom.gameLog.appendChild(item);
  });
}

function renderPreviousLog() {
  dom.previousLogBox.classList.toggle("hidden", !previousRunLog);
  dom.previousLog.innerHTML = "";
  if (!previousRunLog) return;
  const summary = document.createElement("li");
  summary.innerHTML = `<strong>前回結果</strong> ${previousRunLog.title} / ${previousRunLog.summary}`;
  dom.previousLog.appendChild(summary);
  previousRunLog.logs.forEach((entry) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${entry.period}</strong> ${entry.text}`;
    dom.previousLog.appendChild(item);
  });
}

function renderAbilityNotice() {
  if (!dom.abilityNotice) return;
  dom.abilityNotice.classList.toggle("hidden", !state.abilityNotice || state.screen !== "play");
  if (!state.abilityNotice || state.screen !== "play") {
    dom.abilityNotice.innerHTML = "";
    return;
  }
  const ability = state.abilityNotice;
  dom.abilityNotice.innerHTML = `
    <span>特殊能力開花</span>
    <strong>${ability.icon} ${ability.name}</strong>
    <small>${ability.description}</small>`;
}

function renderFinal() {
  const averageYield = Math.round(state.harvests.reduce((sum, h) => sum + h.yieldKg, 0) / state.harvests.length);
  const maxYield = Math.max(...state.harvests.map((h) => h.yieldKg));
  const totalSales = state.harvests.reduce((sum, h) => sum + h.sales, 0);
  const totalAgriculturalIncome = state.settlements.reduce((sum, y) => sum + settlementAgriculturalIncome(y), 0);
  const assets = finalAssetSummary();
  const netWorth = assets.netWorth;
  const title = judgeTitle(netWorth, averageYield);
  const averageSales = Math.round(totalSales / state.harvests.length);
  const averageExpenses = Math.round(state.settlements.reduce((sum, y) => sum + y.expenses, 0) / state.settlements.length);
  const averageExpensePer10a = round1(state.settlements.reduce((sum, y) => sum + settlementExpensePer10a(y), 0) / state.settlements.length);
  const averageAgriculturalIncome = Math.round(totalAgriculturalIncome / state.settlements.length);
  const averageHourlyWage = Math.round((totalAgriculturalIncome * 10000) / (ANNUAL_LABOR_HOURS * MAX_YEARS));
  const titleKey = titleClass(title);
  const punchline = titlePunchline(title, { averageAgriculturalIncome, netWorth });
  dom.finalScreen.className = `final-screen ending-${titleKey}`;
  dom.finalTitleCount.textContent = `称号 全${TITLE_COUNT}種類`;
  dom.finalTitle.textContent = `「${title}」`;
  dom.finalSummary.innerHTML = `
    <div class="life-card wide">
      <div class="ending-farmer" aria-hidden="true"><span></span></div>
      <span>あなたの農家人生</span>
      <strong>5年目終了</strong>
      <p>平均農業所得: ${averageAgriculturalIncome}万円 / 年<br>
      最終経営面積: ${formatArea(state.area)}町<br>
      5年平均収量: ${averageYield}kg / 10a<br>
      純資産: ${netWorth}万円<br>
      借金: ${state.debt}万円</p>
      <span>称号</span>
      <strong>「${title}」</strong>
      <p class="ending-joke">${punchline}</p>
    </div>
    <div><span>5年間プレイ結果</span><strong>5年間・40ターン完走</strong></div>
    <div><span>最終経営面積</span><strong>${formatArea(state.area)}町</strong></div>
    <div><span>5年平均収量</span><strong>${averageYield}kg / 10a</strong></div>
    <div><span>最大収量</span><strong>${maxYield}kg / 10a</strong></div>
    <div><span>5年間総売上</span><strong>${totalSales}万円</strong></div>
    <div><span>平均売上 / 年</span><strong>${averageSales}万円</strong></div>
    <div><span>平均経費 / 年</span><strong>${averageExpenses}万円</strong></div>
    <div><span>平均10a当たり経費</span><strong>${averageExpensePer10a}万円 / 10a</strong></div>
    <div><span>平均農業所得 / 年</span><strong class="${averageAgriculturalIncome >= 0 ? "positive" : "negative"}">${averageAgriculturalIncome}万円</strong></div>
    <div><span>5年間農業所得合計</span><strong class="${totalAgriculturalIncome >= 0 ? "positive" : "negative"}">${totalAgriculturalIncome}万円</strong></div>
    <div><span>年間労働時間</span><strong>${formatNumber(ANNUAL_LABOR_HOURS)}時間</strong></div>
    <div><span>5年間平均実質時給</span><strong class="${averageHourlyWage >= 1000 ? "positive" : "negative"}">${formatNumber(averageHourlyWage)}円</strong></div>
    <div><span>最終現金</span><strong>${state.cash}万円</strong></div>
    <div><span>純資産</span><strong>${netWorth}万円</strong></div>
    <div class="wide net-worth-breakdown"><span>純資産内訳</span><strong>現金 ${assets.cash}万円 / 農機・設備 ${assets.equipment}万円 / 借金 ${assets.debt}万円</strong></div>
    <div><span>借金</span><strong>${state.debt}万円</strong></div>
    <div><span>体力</span><strong>${state.stamina}</strong></div>
    <div><span>農機コンディション</span><strong>${state.machine}</strong></div>
    <div><span>信用</span><strong>${state.trust}</strong></div>
    <div><span>栽培力</span><strong>${state.cultivation}</strong></div>
    <div><span>経営力</span><strong>${state.management}</strong></div>
    <div class="wide"><span>特殊能力</span><strong>${state.abilities.map(abilityName).join("、") || "なし"}</strong></div>
    <div class="wide timeline"><span>あなたの5年間</span><strong>${state.timeline.map((t) => `${t.year}年目: ${t.text}`).join("<br>")}</strong></div>`;
}

function titleClass(title) {
  const map = {
    "借金まみれ農家": "debt",
    "立派な米農家": "solid",
    "米作り職人": "craft",
    "岡山のやり手農家": "business",
    "地域の担い手": "community",
    "岡山のブランド農家": "brand",
    "岡山の米王": "king",
    "攻めすぎ経営者": "business",
    "堅実経営農家": "solid",
    "高収量農家": "craft",
    "持続可能農家": "community"
  };
  return map[title] || "solid";
}

function titlePunchline(title) {
  const lines = {
    "借金まみれ農家": "数字は赤い。でも稲は青い。たぶん来年も忙しい。",
    "立派な米農家": "労働時間はいっぱい。だが米袋もいっぱい。",
    "米作り職人": "財布より先に田んぼを仕上げるタイプ。",
    "岡山のやり手農家": "計算機を叩く音とコンバインの音が同じくらい大きい。",
    "地域の担い手": "頼られすぎて、軽トラの予定表が田植え機より過密。",
    "岡山のブランド農家": "米に名前がついた。本人の休みにはまだ名前がない。",
    "岡山の米王": "もはや米袋が名刺。肩書きが少し重い。",
    "攻めすぎ経営者": "伸ばした面積ぶん、来年の段取り表も伸びている。",
    "堅実経営農家": "派手さより安定。田んぼも家計もちゃんと回した。",
    "高収量農家": "一粒ずつ詰めた努力が、数字にそのまま出た。",
    "持続可能農家": "続けられる強さを作った。これはかなり大きい。"
  };
  return lines[title] || "今年もなんとか生き残った。";
}

function finalResultText() {
  const averageYield = Math.round(state.harvests.reduce((sum, h) => sum + h.yieldKg, 0) / state.harvests.length);
  const totalAgriculturalIncome = state.settlements.reduce((sum, y) => sum + settlementAgriculturalIncome(y), 0);
  const averageAgriculturalIncome = Math.round(totalAgriculturalIncome / state.settlements.length);
  const averageHourlyWage = Math.round((totalAgriculturalIncome * 10000) / (ANNUAL_LABOR_HOURS * MAX_YEARS));
  const assets = finalAssetSummary();
  const netWorth = assets.netWorth;
  const title = judgeTitle(netWorth, averageYield);
  const punchline = titlePunchline(title, { averageAgriculturalIncome, netWorth });
  return `米農家10年 LITE\n\nあなたの農家人生\n5年目終了\n平均農業所得: ${averageAgriculturalIncome}万円 / 年\n5年間平均実質時給: ${formatNumber(averageHourlyWage)}円\n最終経営面積: ${formatArea(state.area)}町\n5年平均収量: ${averageYield}kg / 10a\n純資産: ${netWorth}万円\n内訳: 現金${assets.cash}万円 / 農機・設備${assets.equipment}万円 / 借金${assets.debt}万円\n\n称号\n「${title}」\n${punchline}`;
}

async function shareFinalResult() {
  const text = finalResultText();
  try {
    if (navigator.share) {
      await navigator.share({ title: "米農家10年 LITE 結果", text });
      return;
    }
    await navigator.clipboard.writeText(text);
    dom.finalShareButton.textContent = "結果をコピーしました";
  } catch (error) {
    dom.finalShareButton.textContent = "コピーできませんでした";
  }
}

function judgeTitle(netWorth, averageYield) {
  if (state.debt >= 900 || netWorth < 200) return "借金まみれ農家";
  const averageAgriculturalIncome = state.settlements.length
    ? Math.round(state.settlements.reduce((sum, y) => sum + settlementAgriculturalIncome(y), 0) / state.settlements.length)
    : 0;
  const overloaded = state.area >= 10 && (state.stamina < 45 || state.machine < 45 || averageYield < 470);
  if (overloaded) return "攻めすぎ経営者";
  if (state.area >= 8 && netWorth >= 3000 && averageYield >= 510 && state.trust >= 78 && state.stamina >= 55 && state.machine >= 55 && averageAgriculturalIncome >= 300) return "岡山の米王";
  if (state.area >= 7 && averageYield >= 500 && state.trust >= 70 && state.stamina >= 60 && state.machine >= 60 && averageAgriculturalIncome >= 220) return "持続可能農家";
  if (state.area >= 6.5 && averageYield >= 490 && averageAgriculturalIncome >= 180 && state.debt <= 500) return "堅実経営農家";
  if (averageYield >= 515 && state.cultivation >= 65) return "高収量農家";
  if (hasAbility(state, "brandRice") || (state.trust >= 70 && state.cultivation >= 65 && averageAgriculturalIncome >= 120)) return "岡山のブランド農家";
  if (state.area >= 7 && state.trust >= 60 && averageAgriculturalIncome >= 80) return "地域の担い手";
  if (netWorth >= 2300) return "岡山のやり手農家";
  if (averageYield >= 500) return "米作り職人";
  return "立派な米農家";
}

function addLog(period, text) {
  state.logs.unshift({ period, text });
}

function turnNumber() {
  return (state.year - 1) * PERIODS_PER_YEAR + state.periodIndex + 1;
}

function yieldStars(yieldKg) {
  const count = yieldKg >= 540 ? 5 : yieldKg >= 500 ? 4 : yieldKg >= 460 ? 3 : yieldKg >= 400 ? 2 : 1;
  return "★".repeat(count) + "☆".repeat(5 - count);
}

function abilityName(id) {
  return ABILITIES.find((a) => a.id === id)?.name || id;
}

function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function randomItem(items) {
  return items[randomInt(0, items.length - 1)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function formatArea(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatYen(value) {
  return value.toLocaleString("ja-JP");
}

function formatNumber(value) {
  return value.toLocaleString("ja-JP");
}

function signedNumber(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function last(items) {
  return items[items.length - 1];
}
