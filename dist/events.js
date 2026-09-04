"use strict";

const RICE_EVENTS = [
  {
    id: "retire_small",
    title: "近所の農家が引退",
    description: "田んぼを少し引き受けないかと声がかかった。",
    periods: [1, 8],
    weight: 3,
    condition: (s) => s.trust >= 38,
    choices: [
      { text: "0.8町引き受ける", effects: { area: 0.8, cash: -25, trust: 2 }, result: "面積+0.8町。", landOffer: true },
      { text: "断る", effects: { trust: 1 }, result: "関係を保って見送った。" }
    ]
  },
  {
    id: "retire_large",
    title: "まとまった農地相談",
    description: "信用を見込まれ、広い田んぼの相談が来た。",
    periods: [1, 8],
    weight: 2,
    condition: (s) => s.trust >= 55,
    choices: [
      { text: "1.5町引き受ける", effects: { area: 1.5, cash: -55, trust: 3 }, result: "勝負に出た。面積+1.5町。", landOffer: true },
      { text: "0.5町だけ", effects: { area: 0.5, cash: -15 }, result: "無理なく面積+0.5町。", landOffer: true },
      { text: "断る", effects: { management: 1 }, result: "今は足場固めを選んだ。" }
    ]
  },
  {
    id: "landlord",
    title: "地主から相談",
    description: "草刈りに困った地主から管理の相談があった。",
    periods: [1, 8],
    condition: (s) => s.trust >= 45 || hasAbility(s, "wellConnected"),
    choices: [
      { text: "引き受ける", effects: { area: 0.6, cash: -12, trust: 2 }, result: "面積+0.6町。", landOffer: true },
      { text: "紹介だけする", effects: { trust: 3 }, result: "信用が上がった。" }
    ]
  },
  {
    id: "subsidy",
    title: "補助金採択",
    description: "経営改善の申請が通りそうだ。",
    periods: [1, 2, 8],
    condition: (s) => s.management >= 42,
    choices: [
      { text: "申請する", effects: { cash: 35, management: 1 }, result: "補助金で資金+35万円。" },
      { text: "作業を優先", effects: { stamina: 6 }, result: "体力を温存した。" }
    ]
  },
  {
    id: "used_machine",
    title: "中古農機の話",
    description: "近所から整備済みの中古機械を譲る話が来た。",
    periods: [1, 2, 8],
    choices: [
      { text: "30万円で買う", effects: { cash: -30, machine: 18, management: 1 }, result: "農機コンディションUP。" },
      { text: "見送る", effects: { cash: 0 }, result: "今回は資金を守った。" }
    ]
  },
  {
    id: "tractor_break",
    title: "トラクター故障",
    description: "田んぼの準備中にトラクターが止まった。",
    periods: [2],
    condition: (s) => s.machine < 85,
    weight: 2,
    choices: [
      { text: "40万円で修理", effects: { cash: -40, machine: 20 }, result: "修理して準備を整えた。" },
      { text: "だましだまし使う", effects: { yieldBonus: -18, machine: -10 }, result: "作業精度が落ちた。収量-18kg。" }
    ]
  },
  {
    id: "levee",
    title: "畦が崩れる",
    description: "雨で畦が崩れ、水持ちが悪くなった。",
    periods: [2, 4],
    choices: [
      { text: "直す", effects: { stamina: -7, yieldBonus: 6 }, result: "水持ちを回復。" },
      { text: "後回し", effects: { yieldBonus: -15 }, result: "水管理が難しくなった。" }
    ]
  },
  {
    id: "good_material",
    title: "良い資材情報",
    description: "今年の田んぼに合いそうな資材を教えてもらった。",
    periods: [2, 4],
    choices: [
      { text: "試す", effects: { cash: -12, yieldBonus: 18, cultivation: 1 }, result: "生育が良くなりそうだ。" },
      { text: "記録だけする", effects: { cultivation: 2 }, result: "栽培力+2。" }
    ]
  },
  {
    id: "rice_planter",
    title: "田植機故障",
    description: "田植えの最中に田植機が不調になった。",
    periods: [3],
    condition: (s) => s.machine < 90,
    choices: [
      { text: "修理する", effects: { cash: -30, machine: 14 }, result: "田植えに間に合った。" },
      { text: "近所に頼む", dynamic: "borrowMachine" }
    ]
  },
  {
    id: "seedling",
    title: "苗不足",
    description: "苗が少し足りない。植え方を調整する必要がある。",
    periods: [3],
    choices: [
      { text: "買い足す", effects: { cash: -12 }, result: "苗を確保した。" },
      { text: "薄く植える", effects: { yieldBonus: -12, cultivation: 1 }, result: "少し不安だが経験になった。" }
    ]
  },
  {
    id: "planting_day",
    title: "田植え日和",
    description: "天気も水も良く、田植えが気持ちよく進む。",
    periods: [3],
    choices: [
      { text: "丁寧に仕上げる", effects: { yieldBonus: 18, cultivation: 2, stamina: -4 }, result: "初期生育が良い。" },
      { text: "早めに終える", effects: { stamina: 8 }, result: "余力を残せた。" }
    ]
  },
  {
    id: "weeds",
    title: "雑草大量発生",
    description: "水田に雑草が目立つ。除草が足りないと収量に響く。",
    periods: [4],
    choices: [
      { text: "除草する", effects: { cash: -8, stamina: -6, weedControl: 2 }, result: "雑草を抑えた。" },
      { text: "様子を見る", risk: { probability: 0.55, yieldBonus: -28 }, result: "雑草リスクを受け入れた。" }
    ]
  },
  {
    id: "water_shortage",
    title: "用水トラブル",
    description: "地域の用水が少なく、順番待ちになっている。",
    periods: [4, 5],
    choices: [
      { text: "調整に行く", effects: { trust: 3, stamina: -5, water: 1 }, result: "水を確保できた。" },
      { text: "待つ", effects: { yieldBonus: -18 }, result: "少し水不足になった。" }
    ]
  },
  {
    id: "great_growth",
    title: "生育絶好調",
    description: "稲の色つやが良く、今年は期待できる。",
    periods: [4, 5],
    choices: [
      { text: "記録する", effects: { cultivation: 3 }, result: "栽培力+3。" },
      { text: "攻めの管理", effects: { yieldBonus: 24, stamina: -5 }, result: "収量+24kg。" }
    ]
  },
  {
    id: "heat",
    title: "猛暑",
    description: "田んぼの水がかなり減っている。",
    periods: [5, 6],
    weight: 2,
    choices: [
      { text: "水管理を強化", effects: { water: 2, yieldBonus: 8, stamina: -7 }, result: "暑さをしのいだ。" },
      { text: "通常対応", risk: { probability: 0.7, yieldBonus: -30 }, result: "高温リスクを取った。" }
    ]
  },
  {
    id: "typhoon",
    title: "台風接近",
    description: "強い雨風が来そうだ。備えれば被害を減らせる。",
    periods: [5, 6, 7],
    choices: [
      { text: "備える", effects: { cash: -15, stamina: -5, typhoonPrep: 1 }, result: "台風に備えた。" },
      { text: "最低限で済ませる", risk: { probability: 0.6, yieldBonus: -36 }, result: "被害が出るかもしれない。" }
    ]
  },
  {
    id: "stinkbug",
    title: "カメムシ発生",
    description: "近隣でカメムシが増えている。",
    periods: [6],
    weight: 3,
    choices: [
      { text: "10万円で防除", effects: { cash: -10, pestControl: 2 }, result: "被害を抑えた。" },
      { text: "様子を見る", risk: { probability: 0.5, yieldBonus: -30 }, result: "様子を見ることにした。" }
    ]
  },
  {
    id: "disease",
    title: "病気が出る",
    description: "一部の田んぼで葉色が悪い。",
    periods: [6],
    choices: [
      { text: "対策する", effects: { cash: -14, cultivation: 1 }, result: "早めに対策した。" },
      { text: "広がらないと見る", risk: { probability: 0.45, yieldBonus: -24 }, result: "見極めに賭けた。" }
    ]
  },
  {
    id: "buyer",
    title: "飲食店から直接取引",
    description: "地元の店が今年の米を直接買いたいと言っている。",
    periods: [6, 8],
    condition: (s) => s.trust >= 45,
    choices: [
      { text: "受ける", effects: { priceBonus: 0.1, trust: 2 }, result: "販売価格+10%。" },
      { text: "条件を詰める", effects: { management: 2, trust: 1 }, result: "経営力+2。" }
    ]
  },
  {
    id: "reputation",
    title: "地域で評判になる",
    description: "丁寧な仕事ぶりが地域で話題になった。",
    periods: [5, 6, 8],
    choices: [
      { text: "挨拶に回る", effects: { trust: 5, stamina: -3 }, result: "信用+5。" },
      { text: "田んぼに集中", effects: { yieldBonus: 10 }, result: "収量+10kg。" }
    ]
  },
  {
    id: "combine",
    title: "コンバイン故障",
    description: "収穫直前、コンバインに異音がする。",
    periods: [7],
    condition: (s) => s.machine < 92,
    weight: 3,
    choices: [
      { text: "50万円で修理", effects: { cash: -50, machine: 18 }, result: "収穫に間に合わせた。" },
      { text: "近所に借りる", dynamic: "borrowMachine" }
    ]
  }
];
