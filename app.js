const $ = (s, r = document) => r.querySelector(s);
const SEARCH = {
  img: (n) => "https://cn.bing.com/images/search?q=" + encodeURIComponent(n + " 成品"),
  recipes: (n) => "https://www.xiachufang.com/search/?keyword=" + encodeURIComponent(n),
  video: (n) => "https://search.bilibili.com/all?keyword=" + encodeURIComponent(n + " 做法")
};

let DISHES = [];
const state = { screen: "home", answers: {}, soft: new Set(), qi: 0, shown: new Set(), disliked: new Set(), batch: [], reasons: new Map(), refresh: 0, pantryText: "" };

const QUESTIONS = [
  { id: "src", q: "今天自己做，还是点外卖？", opts: [["自己动手做", "cook"], ["点外卖 / 出去吃", "out"], ["都行", "any"]] },
  { id: "people", q: "今天几个人吃？", opts: [["就我一个", "1"], ["两个人", "2"], ["一家人", "family"], ["请客吃饭", "party"], ["都行", "any"]] },
  { id: "route", q: "想吃哪个路子的菜？", opts: [["家常菜就行", "家常"], ["川湘：香辣下饭", "川湘"], ["粤苏浙：清淡鲜", "粤苏浙"], ["都行", "any"]] },
  { id: "diet", q: "想吃荤的还是素的？", opts: [["想吃肉", "荤"], ["想吃素", "素"], ["都行，不挑", "any"]] },
  { id: "taste", q: "口味想清淡点还是够味？", opts: [["清淡一点", "清淡"], ["家常就行", "适中"], ["要够味", "重口"], ["都行", "any"]] },
  { id: "spicy", q: "吃辣吗？", opts: [["不吃辣", "0"], ["能吃点辣", "2"], ["越辣越好", "4"], ["都行", "any"]] },
  { id: "form", q: "想吃哪一类？", opts: [["炒菜炖菜，配米饭", "菜"], ["汤和羹", "汤羹"], ["面、饭、饺子这类", "主食"], ["凉菜、小吃、卤味", "小吃"], ["都行", "any"]] },
  { id: "method", q: "想怎么做的？", opts: [["炒", "炒"], ["炖、烧", "炖煮"], ["蒸", "蒸"], ["煎、烤", "煎烤"], ["炸", "炸"], ["凉拌", "凉拌"], ["卤", "卤"], ["都行", "any"]] },
  { id: "main", q: "想吃什么主料？", opts: [["鸡肉", "鸡肉"], ["猪肉", "猪肉"], ["牛肉", "牛肉"], ["鱼、虾", "鱼虾"], ["鸡蛋", "鸡蛋"], ["豆腐豆制品", "豆制品"], ["青菜", "蔬菜"], ["面食米饭", "面点"], ["都行", "any"]] },
  { id: "time", q: "能花多少时间？", when: (a) => a.src !== "out", opts: [["十分钟内", "10"], ["半小时左右", "30"], ["不着急", "999"], ["都行", "any"]] }
];

const activeQs = () => QUESTIONS.filter((q) => !q.when || q.when(state.answers));

const SOFT = [
  { label: "下饭", kind: "tag", v: "下饭" },
  { label: "清淡不油", kind: "tag", v: "减脂" },
  { label: "带汤的", kind: "tag", v: "汤水" },
  { label: "下酒", kind: "tag", v: "下酒" },
  { label: "一个人吃", kind: "tag", v: "一人食" },
  { label: "孩子也爱吃", kind: "tag", v: "儿童友好" },
  { label: "便宜点", kind: "tag", v: "便宜" },
  { label: "十分钟能好", kind: "tag", v: "十分钟快手" },
  { label: "请客撑场面", kind: "tag", v: "宴客" },
  { label: "当早餐", kind: "tag", v: "早餐" },
  { label: "当宵夜", kind: "tag", v: "宵夜" },
  { label: "热乎暖胃", kind: "tag", v: "暖心" },
  { label: "鸡肉", kind: "ing", v: "鸡肉" },
  { label: "猪肉", kind: "ing", v: "猪肉" },
  { label: "牛肉", kind: "ing", v: "牛肉" },
  { label: "鱼虾", kind: "ing", v: "鱼虾" },
  { label: "鸡蛋", kind: "ing", v: "鸡蛋" },
  { label: "豆腐豆制品", kind: "ing", v: "豆制品" },
  { label: "青菜", kind: "ing", v: "蔬菜" },
  { label: "面食米饭", kind: "ing", v: "面点" },
  { label: "别放香菜", kind: "avoid", v: "香菜" },
  { label: "不吃海鲜", kind: "avoid", v: "海鲜" },
  { label: "不吃牛羊", kind: "avoid", v: "牛羊" },
  { label: "不吃内脏", kind: "avoid", v: "内脏" }
];

const ROUTE = { "家常": ["家常"], "川湘": ["川", "湘"], "粤苏浙": ["粤", "苏", "浙"] };
const AVOID_GROUPS = {
  "香菜": ["香菜"],
  "海鲜": ["鱼", "虾", "蟹", "贝", "鱿鱼", "海带", "蛤", "蚝"],
  "牛羊": ["羊", "牛"],
  "内脏": ["肥肠", "大肠", "毛肚", "肝", "腰", "肚丝"]
};
const FORM_WORD = { "菜": "炒菜炖菜配米饭", "汤羹": "汤和羹", "主食": "面饭饺子", "小吃": "凉菜小吃" };
const SOFT_MAP = Object.fromEntries(SOFT.map((o) => [o.kind + ":" + o.v, o.label]));

const FOOD_GROUPS = {
  "鸡肉": ["鸡胸肉", "鸡腿", "鸡翅", "鸡爪", "三黄鸡", "鸡肉"],
  "猪肉": ["猪里脊", "五花肉", "排骨", "猪肉末", "火腿肠", "猪蹄"],
  "牛肉": ["牛里脊", "牛腱", "牛肉末", "牛肉"],
  "鱼虾": ["鲈鱼", "草鱼", "鱼头", "鲜虾", "虾仁", "鱼片"],
  "鸡蛋": ["鸡蛋", "蛋清", "鸭蛋"],
  "豆制品": ["嫩豆腐", "豆腐", "豆干", "毛豆", "腐竹"],
  "蔬菜": ["大白菜", "青菜", "黄瓜", "番茄", "土豆", "茄子", "青椒", "蒜苗", "冬瓜", "豆芽", "萝卜", "蘑菇", "西兰花", "莲藕"],
  "面点": ["面条", "米饭", "面粉", "饺子皮", "河粉", "凉皮", "年糕", "馒头", "粉丝", "糯米"]
};

const EMOJI = [["鸡","🍗"],["鸭","🦆"],["牛","🥩"],["猪","🥓"],["排骨","🍖"],["鱼","🐟"],["虾","🦐"],["蛋","🥚"],
  ["豆腐","🍲"],["面","🍜"],["饭","🍚"],["粉","🍜"],["饺","🥟"],["茄子","🍆"],["土豆","🥔"],["黄瓜","🥒"],
  ["番茄","🍅"],["白菜","🥬"],["菜","🥬"],["汤","🥣"],["饼","🥞"],["花生","🥜"]];
const emojiOf = (d) => { for (const [k, e] of EMOJI) if (d.mainIngredients.join("").includes(k) || d.name.includes(k)) return e; return "🍱"; };
const hueOf = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const tint = (d) => "linear-gradient(135deg,hsl(" + hueOf(d.id) + ",72%,88%),hsl(" + ((hueOf(d.id) + 40) % 360) + ",64%,80%))";
const spicyWord = ["不辣", "微辣", "中辣", "麻辣", "爆辣"];
const BATCH = 6;   // 一次给 6 道：手机上两列三行，一屏看完，不至于挑花眼

// 每道菜算一个匹配分，同时记下「为什么推荐它」
function scoreOf(d, a, ctx) {
  let s = (d.popularity - 3) * 6;          // 大众度只值 0~12 分，不再主导排序
  const why = [];

  if (a.form && a.form !== "any" && d.form === a.form) { s += 22; why.push("正好是" + FORM_WORD[a.form]); }
  if (a.people && a.people !== "any") {
    if (a.people === "1" && d.tags.includes("一人食")) { s += 12; why.push("一个人吃正好"); }
    else if (a.people === "family" && d.tags.includes("儿童友好")) { s += 12; why.push("孩子也能吃"); }
    else if (a.people === "party" && d.tags.includes("宴客")) { s += 14; why.push("端得上桌"); }
  }
  if (a.route && a.route !== "any" && (ROUTE[a.route] || []).includes(d.region)) {
    s += 18; why.push(a.route === "川湘" ? "川湘口味" : a.route === "粤苏浙" ? "清淡鲜香" : "家常味道");
  }
  if (a.taste && a.taste !== "any" && d.taste === a.taste) {
    s += 16; why.push(a.taste === "清淡" ? "清淡不腻" : a.taste === "重口" ? "够味过瘾" : "家常口味");
  }
  if (a.method && a.method !== "any" && d.method === a.method) { s += 18; why.push("是" + a.method + "的"); }
  if (a.main && a.main !== "any" && (FOOD_GROUPS[a.main] || []).some((x) => d.mainIngredients.includes(x))) {
    s += 24; why.push("有" + a.main);
  }
  if (a.diet && a.diet !== "any" && d.diet === a.diet) s += 10;

  if (a.spicy !== undefined && a.spicy !== "any") {
    const cap = +a.spicy;
    if (cap >= 4) { s += d.spicy * 4; if (d.spicy >= 3) why.push("够辣"); }
    else if (cap === 2) { s += 8 - Math.abs(d.spicy - 2) * 3; if (d.spicy === 2) why.push("辣度刚好"); }
    else { s += 8; }
  }

  if (a.time && a.time !== "any") {
    const t = +a.time;
    if (d.timeMin <= t) { s += 18; if (t <= 10) why.push(d.timeMin + " 分钟就好"); }
    else s -= Math.min(30, (d.timeMin - t) / 2);
  }

  if (a.src === "out") {
    if (d.difficulty >= 3) s -= 12;
    if (d.popularity >= 4) { s += 6; why.push("外面常见"); }
  }
  if (a.src === "cook") s -= d.difficulty * 3;

  let softHit = 0;
  for (const k of state.soft || []) {
    if (softHit >= 2) break;
    const i = k.indexOf(":");
    const kind = k.slice(0, i), v = k.slice(i + 1);
    if (kind === "tag" && d.tags.includes(v)) { s += 13; softHit++; why.push(SOFT_MAP[k] || v); }
    else if (kind === "ing" && d.mainIngredients.some((x) => (FOOD_GROUPS[v] || []).includes(x))) { s += 15; softHit++; why.push("有" + v); }
  }

  if (a.food && a.food.length) {
    const hit = d.mainIngredients.filter((x) => a.food.includes(x));
    if (hit.length) { s += Math.min(3, hit.length) * 30; why.push("能用上" + hit.slice(0, 2).join("、")); }
  }

  s -= (ctx.refresh || 0) * 3;             // 刷新越多，越偏向冷门
  s += (Math.random() - 0.5) * 3;
  return { s, why };
}

const avoidGroups = () => [...(state.soft || [])]
  .filter((k) => k.startsWith("avoid:"))
  .map((k) => AVOID_GROUPS[k.slice(6)])
  .filter(Boolean);

const hardPool = (a) => DISHES.filter((d) => {
  const av = avoidGroups();
  if (av.length && d.mainIngredients.some((x) => av.some((g) => g.some((k) => x.includes(k))))) return false;
  if (a.diet && a.diet !== "any" && d.diet !== a.diet) return false;
  if (a.spicy !== undefined && a.spicy !== "any" && d.spicy > +a.spicy) return false;
  return !state.disliked.has(d.id);
});

function pick(reset) {
  let pool = hardPool(state.answers);
  if (state.answers.food && state.answers.food.length) {
    const hit = pool.filter((d) => d.mainIngredients.some((x) => state.answers.food.includes(x)));
    if (hit.length) pool = hit;
  }
  if (reset) { state.shown = new Set(); state.refresh = 0; }
  if (!pool.length) { state.batch = []; state.reasons = new Map(); return; }
  if (pool.every((d) => state.shown.has(d.id))) { state.shown = new Set(); state.refresh = 0; }

  const rest = pool.filter((d) => !state.shown.has(d.id));
  const ranked = rest
    .map((d) => { const r = scoreOf(d, state.answers, state); return { d, s: r.s, why: r.why }; })
    .sort((x, y) => y.s - x.s);

  // 多样性：同一个主料最多 2 道，同一种做法最多 3 道，不然一屏全是鸡
  const out = [], ingCount = {}, methodCount = {};
  for (const it of ranked) {
    if (out.length >= BATCH) break;
    const ing = it.d.mainIngredients[0] || "其他";
    if ((ingCount[ing] || 0) >= 2) continue;
    if ((methodCount[it.d.method] || 0) >= 3) continue;
    ingCount[ing] = (ingCount[ing] || 0) + 1;
    methodCount[it.d.method] = (methodCount[it.d.method] || 0) + 1;
    out.push(it);
  }
  if (out.length < BATCH) {
    for (const it of ranked) {
      if (out.length >= BATCH) break;
      if (out.includes(it)) continue;
      out.push(it);
    }
  }

  state.batch = out.map((x) => x.d);
  state.reasons = new Map(out.map((x) => [x.d.id, x.why]));
  state.batch.forEach((d) => state.shown.add(d.id));
  state.refresh = (state.refresh || 0) + 1;
}

function condChips() {
  const a = state.answers, c = [];
  if (a.src === "cook") c.push("自己做");
  if (a.src === "out") c.push("外卖");
  if (a.diet === "荤") c.push("想吃肉");
  if (a.diet === "素") c.push("想吃素");
  if (a.spicy === "0") c.push("一点不辣");
  if (a.spicy === "2") c.push("能吃点辣");
  if (a.spicy === "4") c.push("要够辣");
  if (a.people === "1") c.push("一个人吃");
  if (a.people === "2") c.push("两个人");
  if (a.people === "family") c.push("一家人");
  if (a.people === "party") c.push("请客");
  if (a.route && a.route !== "any") c.push(a.route === "川湘" ? "川湘口味" : a.route === "粤苏浙" ? "粤苏浙口味" : "家常菜");
  if (a.taste && a.taste !== "any") c.push(a.taste === "清淡" ? "口味清淡" : a.taste === "重口" ? "要够味" : "家常口味");
  if (a.form && a.form !== "any") c.push(FORM_WORD[a.form]);
  if (a.method && a.method !== "any") c.push(a.method);
  if (a.main && a.main !== "any") c.push("主料：" + a.main);
  if (a.time && a.time !== "any") c.push(a.time === "999" ? "不赶时间" : a.time + " 分钟内");
  for (const k of state.soft || []) c.push(SOFT_MAP[k] || k.slice(k.indexOf(":") + 1));
  if (!c.length) return "";
  return "<div class='conds'>" + c.map((x) => "<span>" + x + "</span>").join("") + "</div>";
}

function thumb(d) {
  const img = d.image ? "<img src='" + d.image + "' loading='lazy' alt='' onerror='this.remove()'>" : "";
  return "<div class='thumb' style='background:" + tint(d) + "'><span>" + emojiOf(d) + "</span>" + img + "</div>";
}

function card(d, i) {
  const why = ((state.reasons && state.reasons.get(d.id)) || [])[0];
  return "<div class='dish' data-id='" + d.id + "' style='--i:" + (i || 0) + "'>" + thumb(d) +
    "<div class='dish-body'><div class='dish-name'>" + d.name + "</div>" +
    "<div class='meta'><span>" + d.timeMin + " 分钟</span><span>" + spicyWord[d.spicy] + "</span></div>" +
    (why ? "<div class='why'>" + why + "</div>" : "") + "</div></div>";
}

function render() {
  const v = $("#app");

  if (state.screen === "home") {
    v.innerHTML = "<h1>今天吃什么</h1><p class='sub'>别纠结了，问你几个问题。</p>" +
      "<button class='big' data-go='quiz'><span class='ico'>🤔</span><span><div class='t'>不知道吃什么</div><div class='d'>问几个问题，给你 6 个选项</div></span><span class='arrow'>›</span></button>" +
      "<button class='big' data-go='pantry'><span class='ico'>🥕</span><span><div class='t'>家里有食材</div><div class='d'>告诉我你有什么，我报菜名</div></span><span class='arrow'>›</span></button>" +
      "<button class='big' data-go='spin'><span class='ico'>🎯</span><span><div class='t'>直接来一批</div><div class='d'>不问了，随便抽</div></span><span class='arrow'>›</span></button>" +
      "<p class='sub' style='margin-top:26px'>菜库 " + DISHES.length + " 道</p>";
  }

  if (state.screen === "quiz") {
    const qs = activeQs();
    const Q = qs[Math.min(state.qi, qs.length - 1)];
    const cur = state.answers[Q.id];
    v.innerHTML = "<button class='back' data-go='home'>‹ 返回</button>" +
      "<div class='progress'>" + qs.map((q) => "<div class='dot " + (state.answers[q.id] !== undefined ? "on" : "") + "'></div>").join("") + "</div>" +
      "<h2>" + Q.q + "</h2>" +
      "<p class='sub' style='margin:-8px 0 14px;font-size:13px'>第 " + (qs.indexOf(Q) + 1) + " / " + qs.length + " 题 · 拿不准就点「都行」</p>" +
      "<div>" + Q.opts.map(([label, val]) => {
        // 荤素和辣度是真排除，会筛空就别让人点
        const dead = (Q.id === "diet" || Q.id === "spicy") && val !== "any" && hardPool(Object.assign({}, state.answers, { [Q.id]: val })).length === 0;
        return "<button class='opt" + (cur === val ? " sel" : "") + (dead ? " dead" : "") + "'" +
          (dead ? " disabled" : " data-ans='" + val + "'") + ">" + label + (dead ? "（没菜了）" : "") + "</button>";
      }).join("") + "</div>" +
      "<div style='margin-top:22px'><button class='btn block' data-go='result'>先这样，帮我挑几道 ›</button></div>";
  }

  if (state.screen === "soft") {
    v.innerHTML = "<button class='back' data-go='quiz'>‹ 返回</button>" +
      "<h2>还有什么讲究？</h2><p class='sub' style='margin:-6px 0 16px'>可以多选，也可以一个都不选。</p>" +
      "<div class='chips'>" + SOFT.map((o) => {
        const key = o.kind + ":" + o.v;
        const on = (state.soft || new Set()).has(key);
        return "<button class='chipbtn" + (on ? " sel" : "") + "' data-soft='" + key + "'>" + o.label + "</button>";
      }).join("") + "</div>" +
      "<button class='btn primary block' data-go='result' style='margin-top:24px'>就这些，推荐食物 →</button>";
  }

  if (state.screen === "result") {
    if (!state.batch.length) {
      v.innerHTML = "<button class='back' data-go='home'>‹ 返回</button><div class='empty'>筛得太狠了，一道都不剩。<br>回去放宽一个条件试试。</div>" +
        "<button class='btn block' data-go='quiz' style='margin-top:20px'>改一下答案</button>";
    } else {
      const nth = state.refresh > 1 ? "第 " + state.refresh + " 批 · 越往后越小众" : "按你的条件排的";
      v.innerHTML = "<button class='back' data-go='quiz'>‹ 改答案</button>" +
        "<h2>今天可以吃这些</h2>" + condChips() +
        "<p class='sub' style='margin:10px 0 14px'>" + nth + "，点一道看做法。</p>" +
        "<div class='grid'>" + state.batch.map((d, i) => card(d, i)).join("") + "</div>" +
        "<div style='margin-top:18px'><button class='btn primary block' data-go='one'>🎯 别挑了，帮我定一个</button></div>" +
        "<div class='row'><button class='btn' data-go='refresh'>🎲 刷新换一批</button><button class='btn' data-go='quiz'>↺ 改答案</button></div>" +
        "<p class='sub' style='text-align:center;margin:14px 0 0;font-size:12px'>越往后翻越冷门</p>";
    }
  }

  if (state.screen === "pantry") {
    const quick = ["鸡蛋", "番茄", "土豆", "面条", "米饭", "豆腐", "猪肉末", "鸡腿", "大白菜", "黄瓜"];
    v.innerHTML = "<button class='back' data-go='home'>‹ 返回</button>" +
      "<h2>家里有什么？</h2><p class='sub' style='margin:-6px 0 14px'>用顿号或空格隔开，有几样写几样。</p>" +
      "<input id='pantry' type='text' placeholder='例如：鸡蛋 番茄 面条' value='" + (state.pantryText || "") + "'>" +
      "<div class='suggest'>" + quick.map((q) => "<button data-add='" + q + "'>+ " + q + "</button>").join("") + "</div>" +
      "<button class='btn primary block' data-go='pantryResult' style='margin-top:8px'>看看能做什么</button>";
  }

  if (state.screen === "pantryResult") {
    if (!state.batch.length) {
      v.innerHTML = "<button class='back' data-go='pantry'>‹ 改食材</button><div class='empty'>库里暂时没有用这些食材的菜。<br>试试少写两样，或者换一个。</div>";
    } else {
      v.innerHTML = "<button class='back' data-go='pantry'>‹ 改食材</button>" +
        "<h2>这些能用上你的食材</h2><p class='sub' style='margin:-6px 0 14px'>按能用的食材数量排的序。</p>" +
        "<div class='grid'>" + state.batch.map((d, i) => card(d, i)).join("") + "</div>" +
        "<div style='margin-top:18px'><button class='btn primary block' data-go='one'>🎯 就做这个</button></div>" +
        "<div class='row'><button class='btn' data-go='pantryRefresh'>🎲 换一批</button><button class='btn' data-go='pantry'>↺ 改食材</button></div>";
    }
  }

  if (state.screen === "detail") {
    const d = DISHES.find((x) => x.id === state.current);
    const hero = d.image
      ? "<div class='hero' style='background:" + tint(d) + "'><span style='position:relative;z-index:0'>" + emojiOf(d) + "</span><img src='" + d.image + "' alt='' onerror='this.remove()'></div>"
      : "<div class='hero' style='background:" + tint(d) + "'><span>" + emojiOf(d) + "</span></div>";
    v.innerHTML = "<button class='back' data-go='back'>‹ 返回</button>" + hero +
      "<h1 style='font-size:24px;margin-bottom:8px'>" + d.name + "</h1>" +
      "<div class='meta' style='margin-bottom:16px'>" +
        "<span class='chip'>" + d.diet + "</span><span class='chip'>" + d.taste + "</span>" +
        "<span class='chip'>" + spicyWord[d.spicy] + "</span><span class='chip'>" + d.method + "</span>" +
        "<span class='chip'>" + d.timeMin + " 分钟</span><span class='chip'>" + ["", "简单", "一般", "讲究"][d.difficulty] + "</span></div>" +
      "<a class='btn primary block' href='" + SEARCH.img(d.name) + "' target='_blank' rel='noopener' style='margin-bottom:18px'>📷 看真实照片</a>" +
      "<h2 style='font-size:16px'>做法</h2>" +
      "<ol class='steps'>" + d.steps.map((s) => "<li>" + s + "</li>").join("") + "</ol>" +
      (d.tips ? "<div class='tip'>💡 " + d.tips + "</div>" : "") +
      "<div class='row'><a class='btn' href='" + SEARCH.recipes(d.name) + "' target='_blank' rel='noopener'>📖 找菜谱</a>" +
      "<a class='btn' href='" + SEARCH.video(d.name) + "' target='_blank' rel='noopener'>▶ 看视频</a></div>" +
      "<div class='row'><button class='btn block' data-dislike='" + d.id + "'>" + (state.disliked.has(d.id) ? "✓ 已标记不想吃" : "🙅 以后别再推这道") + "</button></div>";
  }
  window.scrollTo(0, 0);
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go],[data-ans],[data-id],[data-add],[data-dislike],[data-soft]");
  if (!t) return;
  if (t.dataset.soft) {
    state.soft = state.soft || new Set();
    const k = t.dataset.soft;
    if (state.soft.has(k)) state.soft.delete(k); else state.soft.add(k);
    return render();
  }
  if (t.dataset.ans !== undefined) {
    const qs = activeQs();
    const Q = qs[Math.min(state.qi, qs.length - 1)];
    state.answers[Q.id] = t.dataset.ans;
    const next = activeQs();
    // 答完最后一题直接进「还有什么讲究」，不再原地重复显示同一题
    const nextUn = next.findIndex((q) => state.answers[q.id] === undefined);
    if (nextUn === -1) { state.screen = "soft"; return render(); }
    state.qi = nextUn;
    state.screen = "quiz";
    return render();
  }
  if (t.dataset.add) {
    const inp = $("#pantry");
    inp.value = (inp.value.trim() + " " + t.dataset.add).trim();
    state.pantryText = inp.value;
    return;
  }
  if (t.dataset.id) {
    state.current = t.dataset.id;
    state.from = state.screen;
    state.screen = "detail";
    return render();
  }
  if (t.dataset.dislike) {
    const id = t.dataset.dislike;
    if (state.disliked.has(id)) state.disliked.delete(id); else state.disliked.add(id);
    localStorage.setItem("disliked", JSON.stringify([...state.disliked]));
    return render();
  }
  const go = t.dataset.go;
  if (go === "home") { state.screen = "home"; state.qi = 0; state.answers = {}; state.soft = new Set(); }
  else if (go === "quiz") { state.screen = "quiz"; state.qi = 0; state.answers = {}; state.soft = new Set(); }
  else if (go === "soft") { state.screen = "soft"; }
  else if (go === "result") { state.screen = "result"; pick(true); }
  else if (go === "refresh") { state.screen = "result"; pick(false); }
  else if (go === "spin") { state.answers = {}; state.soft = new Set(); state.shown = new Set(); state.screen = "result"; pick(true); }
  else if (go === "one") {
    if (!state.batch.length) { render(); return; }
    const d = state.batch[Math.floor(Math.random() * state.batch.length)];
    state.current = d.id; state.from = state.screen; state.screen = "detail";
  }
  else if (go === "back") { state.screen = state.from || "home"; }
  else if (go === "pantry") {
    const inp = $("#pantry"); if (inp) state.pantryText = inp.value;
    state.screen = "pantry";
  }
  else if (go === "pantryResult") {
    const raw = ($("#pantry") || {}).value || state.pantryText || "";
    state.pantryText = raw;
    state.answers = { food: raw.split(/[\s,，、;；]+/).filter(Boolean) };
    state.shown = new Set();
    state.screen = "pantryResult";
    pick(true);
  }
  else if (go === "pantryRefresh") { state.screen = "pantryResult"; pick(false); }
  render();
});

document.addEventListener("input", (e) => { if (e.target.id === "pantry") state.pantryText = e.target.value; });

(async () => {
  try {
    const idx = await (await fetch("./data/index.json")).json();
    const lists = await Promise.all(idx.files.map((f) => fetch("./data/dishes/" + f).then((r) => r.json())));
    DISHES = lists.flat();
  } catch (err) {
    $("#app").innerHTML = "<div class='empty'>菜谱库加载失败。<br>请用本地服务器打开。</div>";
    return;
  }
  try { state.disliked = new Set(JSON.parse(localStorage.getItem("disliked") || "[]")); } catch (e) {}
  render();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
