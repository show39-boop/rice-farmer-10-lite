(function () {
  "use strict";

  const CONFIG = {
    harvest: { background: "golden-field", sprites: ["combine", "rice-bags"], se: ["engine", "cut", "complete"], displayText: "今年の収量", numeric: "yieldKg", duration: 1680 },
    landExpansion: { background: "field-map", sprites: ["contract", "new-plot"], se: ["confirm", "expand"], displayText: "経営面積", numeric: "areaAfter", duration: 1420 },
    sale: { background: "market", sprites: ["rice-bags", "truck", "market-gate"], se: ["load", "counter", "complete"], displayText: "売上金額", numeric: "salesYen", duration: 1760 }
  };
  let active = null;
  let audioContext = null;

  function elements() {
    const root = document.getElementById("eventAnimation");
    return root && { root, frame: root.querySelector(".event-animation-frame"), scene: root.querySelector(".event-animation-scene"), result: root.querySelector(".event-animation-result"), delta: root.querySelector(".event-animation-delta"), skip: root.querySelector(".event-animation-skip") };
  }
  const yen = (value) => `¥${Math.round(value).toLocaleString("ja-JP")}`;
  const area = (value) => `${Number(value).toFixed(1)}町`;
  const harvestGrade = (value) => value >= 520 ? ["豊作！", "great"] : value >= 440 ? ["平年並み", "normal"] : ["伸び悩んだ…", "weak"];
  const saleGrade = (price) => price >= 19000 ? ["高値販売！", "great"] : price < 15000 ? ["相場が弱い…", "weak"] : ["堅実な売上", "normal"];

  function harvestScene() {
    return `<div class="ea-sky"><i></i><i></i></div><div class="ea-mountains"></div><div class="ea-harvest-field"><div class="ea-cut-track"></div></div><div class="ea-combine"><b></b></div><div class="ea-chaff"></div><div class="ea-rice-bags"><i></i><i></i><i></i></div>`;
  }
  function landScene(payload) {
    const before = Math.max(1, Math.min(4, Math.round(payload.areaBefore)));
    const cells = Array.from({ length: 5 }, (_, index) => `<i class="${index < before ? "owned" : ""} ${index === before ? "new" : ""}"></i>`).join("");
    return `<div class="ea-map-label">圃場マップ</div><div class="ea-field-map">${cells}</div><div class="ea-contract"><span>農地契約書</span><b>成立</b></div><div class="ea-map-glow"></div>`;
  }
  function saleScene() {
    return `<div class="ea-market"><b>市 場</b></div><div class="ea-sale-bags"><i></i><i></i><i></i></div><div class="ea-truck"><span></span><b></b><i></i><i></i></div><div class="ea-road"></div><div class="ea-coins"><i>¥</i><i>¥</i><i>¥</i><i>¥</i></div>`;
  }
  function build(type, payload, els) {
    const config = CONFIG[type];
    els.root.dataset.event = type;
    els.scene.innerHTML = type === "harvest" ? harvestScene() : type === "landExpansion" ? landScene(payload) : saleScene();
    if (type === "harvest") {
      const [label, tone] = harvestGrade(payload.yieldKg);
      els.result.innerHTML = `<span>${config.displayText}</span><strong data-count>0kg / 10a</strong><em class="${tone}">${label}</em>`;
      els.delta.textContent = `${payload.yieldDelta >= 0 ? "+" : ""}${payload.yieldDelta}kg`;
      els.delta.className = `event-animation-delta ${payload.yieldDelta >= 0 ? "positive-change" : "negative-change"}`;
    } else if (type === "landExpansion") {
      els.result.innerHTML = `<span>${config.displayText}</span><strong><small>${area(payload.areaBefore)}</small> → <b data-count>${area(payload.areaBefore)}</b></strong><em class="great">農地拡大！</em>`;
      els.delta.textContent = `+${Number(payload.delta).toFixed(1)}町`;
      els.delta.className = "event-animation-delta positive-change";
    } else {
      const [label, tone] = saleGrade(payload.price);
      els.result.innerHTML = `<span>${config.displayText}</span><strong data-count>¥0</strong><small>${Number(payload.price).toLocaleString("ja-JP")}円 / 60kg</small><em class="${tone}">${label}</em>`;
      els.delta.textContent = `+${yen(payload.salesYen)}`;
      els.delta.className = "event-animation-delta positive-change";
    }
  }
  function tween(type, payload, els, duration) {
    const target = type === "harvest" ? payload.yieldKg : type === "landExpansion" ? payload.areaAfter : payload.salesYen;
    const start = type === "landExpansion" ? payload.areaBefore : type === "harvest" ? Math.max(0, target - Math.max(40, Math.round(Math.abs(payload.yieldDelta) + 32))) : 0;
    const node = els.result.querySelector("[data-count]");
    const started = performance.now();
    let raf = 0;
    const draw = (now) => {
      const progress = Math.max(0, Math.min(1, (now - started - duration * .48) / (duration * .4)));
      const value = start + (target - start) * (1 - Math.pow(1 - progress, 3));
      node.textContent = type === "harvest" ? `${Math.round(value)}kg / 10a` : type === "landExpansion" ? area(value) : yen(value);
      if (progress < 1 && active) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }
  function audio() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioContext) audioContext = new AudioCtor();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }
  function tone(at, frequency, length, type, volume) {
    const ctx = audio(); if (!ctx) return;
    const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    oscillator.type = type || "square"; oscillator.frequency.setValueAtTime(frequency, at); oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * .82), at + length);
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume || .035, at + .015); gain.gain.exponentialRampToValueAtTime(.0001, at + length);
    oscillator.connect(gain).connect(ctx.destination); oscillator.start(at); oscillator.stop(at + length + .02);
  }
  function playSound(type, duration) {
    const ctx = audio(); if (!ctx) return; const now = ctx.currentTime + .02;
    if (type === "harvest") { for (let i = 0; i < 7; i += 1) tone(now + i * .105, 92 + (i % 2) * 18, .13, "sawtooth", .018); [523,659,784].forEach((f,i) => tone(now + duration / 1000 * .68 + i * .07, f, .28, "square", .035)); }
    else if (type === "landExpansion") [330,440,554,660].forEach((f,i) => tone(now + .34 + i * .11, f, .26, i % 2 ? "triangle" : "square", .035));
    else { [180,145,120].forEach((f,i) => tone(now + i * .12, f, .12, "triangle", .025)); for (let i=0;i<6;i+=1) tone(now+.72+i*.07,720+i*70,.11,"square",.025); [523,659,784,1046].forEach((f,i)=>tone(now+1.18+i*.06,f,.32,"triangle",.04)); }
  }
  function play(type, payload) {
    const config = CONFIG[type], els = elements();
    if (!config || !els) return Promise.resolve();
    if (active) active.finish();
    build(type, payload, els); els.root.classList.remove("hidden", "is-leaving"); void els.root.offsetWidth; els.root.classList.add("is-playing"); document.body.classList.add("event-animation-open"); playSound(type, config.duration);
    return new Promise((resolve) => {
      let finished = false, timer = 0; const stopTween = tween(type, payload, els, config.duration);
      const finish = () => {
        if (finished) return; finished = true; clearTimeout(timer); stopTween();
        const count = els.result.querySelector("[data-count]");
        if (count) count.textContent = type === "harvest" ? `${payload.yieldKg}kg / 10a` : type === "landExpansion" ? area(payload.areaAfter) : yen(payload.salesYen);
        els.root.classList.remove("is-playing"); els.root.classList.add("is-leaving"); document.body.classList.remove("event-animation-open");
        window.setTimeout(() => { els.root.classList.add("hidden"); els.root.classList.remove("is-leaving"); els.root.removeAttribute("data-event"); active = null; resolve(); }, 150);
      };
      active = { finish }; timer = window.setTimeout(finish, config.duration);
    });
  }
  function skip() { if (active) active.finish(); }
  document.addEventListener("DOMContentLoaded", () => {
    const els = elements(); if (!els) return;
    els.skip.addEventListener("click", skip);
    els.root.addEventListener("click", (event) => { if (event.target === els.root || event.target === els.frame || event.target === els.scene) skip(); });
    document.addEventListener("keydown", (event) => { if (!active || !["Enter", " ", "Spacebar"].includes(event.key)) return; event.preventDefault(); skip(); });
  });
  window.EventAnimation = Object.freeze({ play, skip, config: CONFIG });
}());
