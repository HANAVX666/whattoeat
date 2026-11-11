const $ = (s, r = document) => r.querySelector(s);
const SEARCH = {
  img: (n) => "https://cn.bing.com/images/search?q=" + encodeURIComponent(n + " 成品"),
  recipes: (n) => "https://www.xiachufang.com/search/?keyword=" + encodeURIComponent(n),
  video: (n) => "https://search.bilibili.com/all?keyword=" + encodeURIComponent(n + " 做法")
};

let DISHES = [];
let PHOTOS = {};
let photosReady = false;
let photosLoading = null;
let THUMBS = new Set();
const state = { screen: "home", answers: {}, soft: new Set(), qi: 0, shown: new Set(), disliked: new Set(), saved: new Set(), eaten: [], batch: [], reasons: new Map(), refresh: 0, pantryText: "", collections: [], stack: [], folder: null, sheet: null, learnLevel: "初", current: null };

const QUESTIONS = [
  { id: "src", q: "今天自己做，还是点外卖？", opts: [["自己动手做", "cook"], ["点外卖 / 出去吃", "out"], ["都行", "any"]] },
  { id: "meal", q: "这是今天的哪一顿？", opts: [["早饭", "breakfast"], ["午饭", "lunch"], ["晚饭", "dinner"], ["宵夜", "night"], ["都行", "any"]] },
  { id: "route", q: "想吃哪个路子的菜？", opts: [["家常菜就行", "家常"], ["川湘：香辣下饭", "川湘"], ["粤闽：鲜甜本味", "粤闽"], ["江浙：清淡鲜嫩", "江浙"], ["西北：面食扎实", "西北"], ["都行", "any"]] },
  { id: "diet", q: "想吃荤的还是素的？", opts: [["想吃肉", "荤"], ["想吃素", "素"], ["都行，不挑", "any"]] },
  { id: "taste", q: "口味想清淡点还是够味？", opts: [["清淡一点", "清淡"], ["家常就行", "适中"], ["要够味", "重口"], ["都行", "any"]] },
  { id: "spicy", q: "吃辣吗？", opts: [["不吃辣", "0"], ["能吃点辣", "2"], ["越辣越好", "4"], ["都行", "any"]] },
  { id: "temp", q: "想吃热乎的，还是凉快的？", opts: [["热乎的，最好带汤", "hot"], ["凉快的，爽口解腻", "cold"], ["都行", "any"]] },
  { id: "novelty", q: "想吃常吃的，还是换换口味？", opts: [["就吃熟悉的", "familiar"], ["来点没试过的", "novel"], ["都行", "any"]] },
  { id: "form", q: "想吃哪一类？", opts: [["炒菜炖菜，配米饭", "菜"], ["汤和羹", "汤羹"], ["面、饭、饺子这类", "主食"], ["凉菜、小吃、卤味", "小吃"], ["都行", "any"]] },
  { id: "time", q: "能花多少时间？", when: (a) => a.src !== "out", opts: [["十分钟内", "10"], ["半小时左右", "30"], ["不着急", "999"], ["都行", "any"]] },
  { id: "equip", q: "厨房有什么家伙什？", when: (a) => a.src === "cook", opts: [["只有一口锅", "basic"], ["有烤箱或空气炸锅", "oven"], ["锅碗瓢盆都有", "any"]] }
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
  { label: "想吃凉的", kind: "method", v: "凉拌" },
  { label: "想吃卤味", kind: "method", v: "卤" },
  { label: "鸡肉", kind: "ing", v: "鸡肉" },
  { label: "猪肉", kind: "ing", v: "猪肉" },
  { label: "牛肉", kind: "ing", v: "牛肉" },
  { label: "鱼虾", kind: "ing", v: "鱼虾" },
  { label: "鸡蛋", kind: "ing", v: "鸡蛋" },
  { label: "豆腐豆制品", kind: "ing", v: "豆制品" },
  { label: "青菜", kind: "ing", v: "蔬菜" },
  { label: "面食米饭", kind: "ing", v: "面点" },
  { label: "羊肉", kind: "ing", v: "羊肉" },
  { label: "鸭肉", kind: "ing", v: "鸭肉" },
  { label: "海鲜", kind: "ing", v: "海鲜" },
  { label: "菌菇", kind: "ing", v: "菌菇" },
  { label: "别放香菜", kind: "avoid", v: "香菜" },
  { label: "不吃海鲜", kind: "avoid", v: "海鲜" },
  { label: "不吃牛羊", kind: "avoid", v: "牛羊" },
  { label: "不吃内脏", kind: "avoid", v: "内脏" },
  { label: "不吃猪肉", kind: "avoid", v: "猪肉" },
  { label: "不吃鸡蛋", kind: "avoid", v: "鸡蛋" },
  { label: "不吃菌菇", kind: "avoid", v: "菌菇" },
  { label: "不吃豆制品", kind: "avoid", v: "豆制品" }
];

const ROUTE = {
  "家常": ["家常"],
  "川湘": ["川", "湘"],
  "粤闽": ["粤", "闽"],
  "江浙": ["苏", "浙", "徽"],
  "西北": ["西北", "新疆"]
};
const ROUTE_WORD = { "家常": "家常味道", "川湘": "川湘香辣", "粤闽": "粤闽鲜甜", "江浙": "江浙清鲜", "西北": "西北面食" };
const AVOID_GROUPS = {
  "香菜": ["香菜"],
  "海鲜": ["鱼", "虾", "蟹", "贝", "鱿鱼", "海带", "蛤", "蚝"],
  "牛羊": ["羊", "牛"],
  "内脏": ["肥肠", "大肠", "毛肚", "肝", "腰", "肚丝"],
  "猪肉": ["猪", "五花", "排骨", "火腿", "香肠", "腊肉", "培根"],
  "鸡蛋": ["鸡蛋", "蛋清", "鸭蛋", "咸蛋", "皮蛋"],
  "菌菇": ["香菇", "平菇", "杏鲍菇", "金针菇", "蘑菇", "木耳", "银耳"],
  "豆制品": ["豆腐", "豆干", "香干", "腐竹", "豆皮", "豆花", "烤麸", "面筋"]
};
const FORM_WORD = { "菜": "炒菜炖菜配米饭", "汤羹": "汤和羹", "主食": "面饭饺子", "小吃": "凉菜小吃" };
const MEAL_TITLE = { breakfast: "早饭可以吃这些", lunch: "午饭可以吃这些", dinner: "晚饭可以吃这些", night: "宵夜可以吃这些" };
const SOFT_MAP = Object.fromEntries(SOFT.map((o) => [o.kind + ":" + o.v, o.label]));

const FOOD_GROUPS = {
  "鸡肉": ["鸡胸肉", "鸡腿", "鸡翅", "鸡爪", "三黄鸡", "鸡肉"],
  "猪肉": ["猪里脊", "五花肉", "排骨", "猪肉末", "火腿肠", "猪蹄"],
  "牛肉": ["牛里脊", "牛腱", "牛肉末", "牛肉"],
  "鱼虾": ["鲈鱼", "草鱼", "鱼头", "鲜虾", "虾仁", "鱼片"],
  "鸡蛋": ["鸡蛋", "蛋清", "鸭蛋"],
  "豆制品": ["嫩豆腐", "豆腐", "豆干", "香干", "毛豆", "腐竹", "豆腐皮", "豆花", "烤麸", "面筋", "豆芽"],
  "蔬菜": ["大白菜", "青菜", "黄瓜", "番茄", "土豆", "茄子", "青椒", "蒜苗", "冬瓜", "豆芽", "萝卜", "蘑菇", "西兰花", "莲藕",
    "菠菜", "油菜", "油麦菜", "生菜", "空心菜", "莴笋", "苦瓜", "丝瓜", "西葫芦", "秋葵", "娃娃菜", "菜心", "芥蓝", "芹菜",
    "蒜苔", "韭菜", "南瓜", "玉米", "毛豆", "雪菜", "酸菜", "笋干", "春笋", "黄花菜", "鱼腥草", "绿豆芽", "豆角", "花菜", "包菜"],
  "面点": ["面条", "米饭", "面粉", "饺子皮", "河粉", "凉皮", "年糕", "馒头", "粉丝", "糯米", "米粉", "米线", "馍", "馕", "粘米粉", "糯米粉", "油条", "大米", "面包", "吐司"],
  "羊肉": ["羊肉", "羊杂"],
  "鸭肉": ["鸭", "鸭血"],
  "海鲜": ["鲜虾", "虾仁", "蟹", "蛤蜊", "鱿鱼", "牡蛎", "扇贝", "带鱼", "黄鱼", "鲈鱼", "草鱼", "鱼片", "鱼头", "鱼丸", "鳝鱼", "鱼腥草"],
  "菌菇": ["香菇", "平菇", "杏鲍菇", "金针菇", "干蘑菇", "木耳"]
};

// 具体词排前面：「鸡蛋」必须先命中「蛋」，否则整盘蛋都变成鸡腿
const EMOJI = [["蛋","🥚"],["鸡翅","🍗"],["鸡腿","🍗"],["鸡","🍗"],["鸭","🦆"],["排骨","🍖"],["牛","🥩"],
  ["羊","🍖"],["猪","🥓"],["鱼","🐟"],["虾","🦐"],["蟹","🦀"],["蛤","🦪"],["鱿","🦑"],
  ["豆腐","🍲"],["番茄","🍅"],["黄瓜","🥒"],["茄子","🍆"],["土豆","🥔"],["白菜","🥬"],["菜","🥬"],
  ["饺","🥟"],["面","🍜"],["粉","🍜"],["米线","🍜"],["饭","🍚"],["粥","🥣"],["饼","🥞"],["馍","🥖"],
  ["汤","🥣"],["花生","🥜"],["菇","🍄"],["玉米","🌽"],["南瓜","🎃"],["奶","🥛"],["吐司","🍞"],
  ["毛豆","🫘"],["红豆","🫘"],["绿豆","🫘"],["黄豆","🫘"],["五花","🥓"],["腊肉","🥓"],
  ["木耳","🍄"],["银耳","🍄"],["椒","🌶"],["海带","🌿"],["红薯","🍠"],["大肠","🍖"],["肥肠","🍖"],["肠","🌭"],
  ["藕","🪷"],["笋","🎍"],["魔芋","🍢"],["苦瓜","🥒"]];
const emojiOf = (d) => {
  // 菜名里出现得越靠前，越可能是主角：番茄炒蛋 → 🍅 而不是 🥚
  let best = null, at = 1e9;
  for (const [k, e] of EMOJI) {
    const i = d.name.indexOf(k);
    if (i >= 0 && (i < at || (i === at && best && k.length > best[0].length))) { best = [k, e]; at = i; }
  }
  if (best) return best[1];
  for (const [k, e] of EMOJI) if (d.mainIngredients.join("").includes(k)) return e;
  return "🍱";
};
// 按菜的属性给底色，比随机色更像「食物」，也稳定不会每次变
const TINTS = {
  汤羹: "linear-gradient(150deg,#fbe9c4,#f2d69f)",
  素:   "linear-gradient(150deg,#e8f2db,#cfe3bd)",
  主食: "linear-gradient(150deg,#f8ebd2,#eed8b2)",
  小食: "linear-gradient(150deg,#fce4dc,#f5cabb)",
  荤:   "linear-gradient(150deg,#fbe7d0,#f0d3b4)"
};
const tint = (d) => d.spicy >= 3 ? "linear-gradient(150deg,#fbdccb,#f3bc9f)"
  : d.diet === "素" ? TINTS["素"]
  : TINTS[d.form] || TINTS["荤"];
const spicyWord = ["不辣", "微辣", "中辣", "麻辣", "爆辣"];
const BATCH = 6;   // 一次给 6 道：手机上两列三行，一屏看完，不至于挑花眼

// 每道菜算一个匹配分，同时记下「为什么推荐它」
const SEASONING = new Set(["姜", "大蒜", "小葱", "大葱", "生抽", "老抽", "香醋", "白糖", "冰糖", "花椒", "干辣椒",
  "小米椒", "玉米淀粉", "料酒", "豆瓣酱", "辣椒油", "八角", "桂皮", "香油", "盐", "蚝油", "胡椒粉", "孜然",
  "辣椒粉", "番茄酱", "芝麻", "香菜", "辣椒", "淀粉", "蒜", "葱"]);
const DEDUP_GROUPS = ["鸡肉", "猪肉", "牛肉", "羊肉", "鸭肉", "鱼虾", "海鲜", "鸡蛋", "菌菇", "豆制品"];
const topIngredients = (n) => {
  const f = new Map();
  for (const d of DISHES) for (const x of d.mainIngredients) if (!SEASONING.has(x)) f.set(x, (f.get(x) || 0) + 1);
  const used = new Set(), out = [];
  for (const [name] of [...f.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    const grp = DEDUP_GROUPS.find((g) => (FOOD_GROUPS[g] || []).includes(name));
    if (grp) { if (used.has(grp)) continue; used.add(grp); }
    out.push(name);
    if (out.length >= n) break;
  }
  return out;
};

function scoreOf(d, a, ctx) {
  let s = (d.popularity - 3) * 6;          // 大众度只值 0~12 分，不再主导排序
  const days = daysSinceEaten(d.id);
  if (days < 3) s -= 45 * (1 - days / 3);   // 三天内吃过：越近越不想再推荐
  const why = [];

  if (a.form && a.form !== "any" && d.form === a.form) { s += 22; why.push("正好是" + FORM_WORD[a.form]); }
  if (a.people && a.people !== "any") {
    if (a.people === "1" && d.tags.includes("一人食")) { s += 12; why.push("一个人吃正好"); }
    else if (a.people === "family" && d.tags.includes("儿童友好")) { s += 12; why.push("孩子也能吃"); }
    else if (a.people === "party" && d.tags.includes("宴客")) { s += 14; why.push("端得上桌"); }
  }
  if (a.route && a.route !== "any" && (ROUTE[a.route] || []).includes(d.region)) {
    s += 18; why.push(ROUTE_WORD[a.route] || "合口味");
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

  if (a.temp === "hot") {
    if (d.tags.includes("汤水") || d.tags.includes("暖心") || d.method === "炖煮" || d.method === "蒸") {
      s += 16; why.push("热乎带汤");
    } else if (d.method === "凉拌") s -= 14;
  } else if (a.temp === "cold") {
    if (d.method === "凉拌") { s += 22; why.push("凉口爽脆"); }
    else if (d.form === "汤羹") s -= 12;
  }

  if (a.novelty === "familiar") {
    if (d.popularity >= 4) { s += 12; why.push("常吃的稳妥"); } else s -= 4;
  } else if (a.novelty === "novel") {
    if (d.popularity <= 3) { s += 14; why.push("没试过的新口味"); } else s -= 6;
  }

  if (a.time && a.time !== "any") {
    const t = +a.time;
    if (d.timeMin <= t) { s += 18; if (t <= 10) why.push(d.timeMin + " 分钟就好"); }
    else s -= Math.min(30, (d.timeMin - t) / 2);
  }

  if (a.meal && a.meal !== "any") {
    if (a.meal === "breakfast") { if (d.tags.includes("早餐")) { s += 26; why.push("当早饭合适"); } else s -= 24; }
    else if (a.meal === "night") { if (d.tags.includes("宵夜")) { s += 26; why.push("适合当宵夜"); } else s -= 18; }
  }
  if (a.budget && a.budget !== "any") {
    if (a.budget === "cheap") { if (d.tags.includes("便宜")) { s += 18; why.push("花不了几个钱"); } else s -= d.popularity >= 4 ? 4 : 0; }
    else if (a.budget === "good" && d.popularity >= 4) { s += 10; why.push("值得吃一顿"); }
  }
  if (a.equip === "oven" && (d.method === "煎烤" || d.method === "炸")) { s += 18; why.push("正好用上" + (d.method === "炸" ? "炸锅" : "烤箱")); }
  if (a.equip === "basic" && (d.method === "炒" || d.method === "炖煮" || d.method === "蒸")) { s += 10; }

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
    else if (kind === "method" && d.method === v) { s += 16; softHit++; why.push(v === "凉拌" ? "凉拌爽口" : "卤得入味"); }
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
  // 越往后越冷门：第 n 批开始收紧「大众度上限」，池子不够 30 道就放开，避免没菜可推
  const n = state.refresh || 0;
  const CEIL = [5.5, 5.5, 4.8, 4.2, 3.8, 3.4, 3.0, 2.6, 2.3];
  const ceil = CEIL[Math.min(n, CEIL.length - 1)];
  // 冰箱反推不玩「越刷越冷门」：手上就这些食材，优先给靠谱的家常做法
  const nicheMode = !(state.answers.food && state.answers.food.length);
  let cand = nicheMode ? rest.filter((d) => d.popularity <= ceil) : rest;
  if (cand.length < 30) cand = rest;
  const ranked = cand
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
  if (a.meal && a.meal !== "any") c.push({ breakfast: "早饭", lunch: "午饭", dinner: "晚饭", night: "宵夜" }[a.meal] || "");
  if (a.people === "1") c.push("一个人吃");
  if (a.people === "2") c.push("两个人");
  if (a.people === "family") c.push("一家人");
  if (a.people === "party") c.push("请客");
  if (a.route && a.route !== "any") c.push(ROUTE_WORD[a.route] || "家常菜");
  if (a.temp === "hot") c.push("想吃热乎的");
  if (a.temp === "cold") c.push("想吃凉的");
  if (a.novelty === "familiar") c.push("吃熟悉的");
  if (a.novelty === "novel") c.push("想尝鲜");
  if (a.taste && a.taste !== "any") c.push(a.taste === "清淡" ? "口味清淡" : a.taste === "重口" ? "要够味" : "家常口味");
  if (a.form && a.form !== "any") c.push(FORM_WORD[a.form]);
  if (a.method && a.method !== "any") c.push(a.method);
  if (a.main && a.main !== "any") c.push("主料：" + a.main);
  if (a.time && a.time !== "any") c.push(a.time === "999" ? "不赶时间" : a.time + " 分钟内");
  if (a.equip === "oven") c.push("有烤箱");
  if (a.equip === "basic") c.push("一口锅");
  for (const k of state.soft || []) c.push(SOFT_MAP[k] || k.slice(k.indexOf(":") + 1));
  if (!c.length) return "";
  return "<div class='conds'>" + c.map((x) => "<span>" + x + "</span>").join("") + "</div>";
}

let deferredPrompt = null;
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (state.screen === "home") render();
  });
}

function isStandalone() {
  try {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  } catch (e) { return false; }
}

function installTip() {
  if (typeof window === "undefined") return "";
  // 装进去的 APK 里不提示“加到主屏幕”
  const inApp = !!window.Capacitor || /;\s*wv\)/.test((typeof navigator !== "undefined" && navigator.userAgent) || "");
  if (inApp || isStandalone()) return "";
  let hidden = false;
  try { hidden = localStorage.getItem("hideInstall") === "1"; } catch (e) {}
  if (hidden) return "";
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const ios = /iPad|iPhone|iPod/.test(ua);
  if (!ios && !deferredPrompt) return "";
  if (ios) {
    return "<div class='install'><span class='ins-ico'>📲</span><span class='ins-txt'>装到主屏幕更像 App：点底部「分享」→「添加到主屏幕」，以后一按就开，没网也能用。</span>" +
      "<button class='ins-x' data-install-hide aria-label='不再提示'>×</button></div>";
  }
  return "<div class='install'><span class='ins-ico'>📲</span><span class='ins-txt'>装到桌面，像 App 一样打开，没网也能用。</span>" +
    "<button class='ins-go' data-install>安装</button><button class='ins-x' data-install-hide aria-label='不再提示'>×</button></div>";
}

function thumb(d) {
  const ph = (PHOTOS[d.id] || [])[0];
  // 卡片优先用本地 webp 缩略图（约 18KB），没有就退回网络原图
  const src = THUMBS.has(d.id) ? "./data/thumbs/" + d.id + ".webp" : (ph && ph.u) || "";
  const img = src
    ? "<img src='" + src + "' alt='' loading='lazy' decoding='async' referrerpolicy='no-referrer' data-remote='" + ((ph && ph.u) || "") + "'>"
    : "";
  return "<div class='thumb' style='background:" + tint(d) + "'><span>" + emojiOf(d) + "</span>" + img + "</div>";
}

function daysSinceEaten(id) {
  const e = (state.eaten || []).find((x) => x.id === id);
  return e ? (Date.now() - e.ts) / 86400000 : 999;
}

function markEaten(id) {
  state.eaten = [{ id, ts: Date.now() }].concat((state.eaten || []).filter((x) => x.id !== id)).slice(0, 40);
  localStorage.setItem("eaten", JSON.stringify(state.eaten));
}

function unmarkEaten(id) {
  state.eaten = (state.eaten || []).filter((x) => x.id !== id);
  try { localStorage.setItem("eaten", JSON.stringify(state.eaten)); } catch (e) {}
}

function recentStrip() {
  const items = (state.eaten || []).slice(0, 8).map((e) => DISHES.find((d) => d.id === e.id)).filter(Boolean);
  if (!items.length) return "";
  return "<div class='home-strip'><div class='group-title'>最近吃过<span class='n'>" + items.length + "</span></div>" +
    "<div class='chips'>" + items.map((d) => "<button class='chipbtn' data-id='" + d.id + "'>" + d.name + "</button>").join("") + "</div></div>";
}

function similarDishes(d, n) {
  const scored = DISHES.filter((x) => x.id !== d.id && !state.disliked.has(x.id)).map((x) => {
    let sc = 0;
    if (x.region === d.region) sc += 8;
    if (x.form === d.form) sc += 3;
    if (x.mainIngredients.some((i) => d.mainIngredients.includes(i))) sc += 5;
    sc -= Math.abs(x.popularity - d.popularity) * 2;
    return [x, sc];
  }).sort((a, b) => b[1] - a[1]);
  return scored.slice(0, n).map((x) => x[0]);
}

function nearHtml(d) {
  const near = similarDishes(d, 4);
  if (!near.length) return "";
  return "<h3 style='margin:22px 0 10px'>也可以试试</h3><div class='near'>" +
    near.map((x) => "<button class='chipbtn' data-id='" + x.id + "'>" + x.name + "</button>").join("") + "</div>";
}

function card(d, i, note) {
  const rs = (state.reasons && state.reasons.get(d.id)) || [];
  const pick = rs.filter((r) => !r.startsWith("正好是")).slice(0, 2);
  const why = note || (pick.length ? pick : rs.slice(0, 1)).join(" · ");
  const on = state.saved.has(d.id);
  return "<div class='dish' data-id='" + d.id + "' style='--i:" + (i || 0) + "'>" +
    "<button class='star" + (on ? " on" : "") + "' data-star='" + d.id + "' aria-label='收藏'>" + (on ? "★" : "☆") + "</button>" +
    thumb(d) +
    "<div class='dish-body'><div class='dish-name'>" + d.name + "</div>" +
    "<div class='meta'><span class='chip'>" + d.timeMin + " 分钟</span><span class='chip'>" + spicyWord[d.spicy] + "</span></div>" +
    (why ? "<div class='why'>" + why + "</div>" : "") + "</div></div>";
}

function bigBtn(tone, ico, title, desc, go) {
  return "<button class='big' data-go='" + go + "' data-tone='" + tone + "'>" +
    "<span class='ico'>" + ico + "</span>" +
    "<span class='txt'><span class='t'>" + title + "</span><span class='d'>" + desc + "</span></span>" +
    "<span class='arrow'>›</span></button>";
}

/* ---------- 收藏分类 ---------- */
const SEED_FOLDERS = [
  { id: "want", name: "我想吃" },
  { id: "try", name: "想试试" },
  { id: "think", name: "考虑考虑" }
];
const uid = () => "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function saveCollections() {
  try { localStorage.setItem("collections", JSON.stringify(state.collections)); } catch (e) {}
}
function rebuildSaved() {
  const s = new Set();
  (state.collections || []).forEach((c) => (c.dishes || []).forEach((id) => s.add(id)));
  state.saved = s;
}
function addToFolder(fid, id) {
  const c = (state.collections || []).find((x) => x.id === fid);
  if (!c || c.dishes.includes(id)) return;
  c.dishes.unshift(id);
  saveCollections(); rebuildSaved();
}
function removeFromFolder(fid, id) {
  const c = (state.collections || []).find((x) => x.id === fid);
  if (!c) return;
  c.dishes = c.dishes.filter((x) => x !== id);
  saveCollections(); rebuildSaved();
}
function removeEverywhere(id) {
  (state.collections || []).forEach((c) => { c.dishes = c.dishes.filter((x) => x !== id); });
  saveCollections(); rebuildSaved();
}
function createFolder(name) {
  const c = { id: uid(), name: (name || "新分类").trim() || "新分类", dishes: [] };
  state.collections.push(c);
  saveCollections();
  return c.id;
}
function dropFolder(fid) {
  state.collections = state.collections.filter((c) => c.id !== fid);
  saveCollections(); rebuildSaved();
}
function renameFolder(fid, name) {
  const c = state.collections.find((x) => x.id === fid);
  if (!c || !name || !name.trim()) return;
  c.name = name.trim(); saveCollections();
}

function askDropFolder(id) {
  const c = (state.collections || []).find((x) => x.id === id);
  if (c && c.dishes.length && typeof confirm === "function") {
    if (!confirm("删掉「" + c.name + "」这个分类？里面的 " + c.dishes.length + " 道菜也会一起没掉。")) return;
  }
  dropFolder(id);
  state.sheet = null;
  if (state.screen === "folder") { state.screen = "saved"; state.folder = null; }
  toast("分类已删除");
  render();
}

function defaultFolder() {
  return (state.collections[0] || {}).id || "want";
}

function pushNav() {
  state.stack = (state.stack || []).slice(-24);
  state.stack.push({ s: state.screen, cur: state.current || null, folder: state.folder || null });
}
function navBack() {
  const p = (state.stack || []).pop();
  if (!p) { state.screen = "home"; state.folder = null; return; }
  state.screen = p.s; state.current = p.cur; state.folder = p.folder;
}

let toastTimer = null;
function toast(msg) {
  try {
    if (!document.body || !document.createElement) return;
    let el = document.getElementById && document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("on"), 2200);
  } catch (e) {}
}

function copyText(id) {
  const d = DISHES.find((x) => x.id === id);
  if (!d) return;
  const text = "「" + d.name + "」做法（" + d.timeMin + " 分钟 · " + d.method + "）\n" +
    d.steps.map((s, i) => (i + 1) + ". " + s).join("\n") +
    (d.tips ? "\n💡 " + d.tips : "") + "\n—— 来自「今天吃什么」";
  const fallback = () => { state.sheet = { type: "copy", text }; render(); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast("已复制，去粘贴给朋友"), fallback);
      return;
    }
  } catch (e) {}
  fallback();
}

/* ---------- 今日推荐（人工精选，不刷新） ---------- */
const DAILY = {
  updated: "11 月",
  groups: [
    { title: "最近正流行", sub: "应季小热门，好上手、花不了多少钱", items: [
      ["fanqie-xiaren", "虾仁滑嫩不柴，酸甜口的小孩也爱吃"],
      ["suan-dou-jiao-rou-mo", "一勺酸豆角能扒两碗饭，成本很低"],
      ["duojiao-zheng-jinzhengu", "上锅蒸 12 分钟，几乎不用看火"],
      ["tangcu-oupian", "脆生生带一点酸甜，配油腻的菜正好"]
    ]},
    { title: "养身体的", sub: "少油少盐，蛋白质和纤维都照顾到", items: [
      ["ji-yu-doufu-tang", "汤白味鲜，蛋白质好吸收"],
      ["shang-tang-wa-wa-cai", "清爽解腻，还放了一点枸杞"],
      ["zheng-nan-gua", "粗粮蒸着吃，甜味是南瓜自己的"],
      ["xiao-mi-zhou", "胃不舒服的时候，来一碗"]
    ]}
  ]
};

/* ---------- 学习指南（外链指引） ---------- */
const bili = (q) => "https://search.bilibili.com/all?keyword=" + encodeURIComponent(q);
const xcf = (q) => "https://www.xiachufang.com/search/?keyword=" + encodeURIComponent(q);
const LEARN = [
  { lvl: "初", name: "初级", desc: "能把菜做熟、不糊锅，先建立手感。", items: [
    { t: "刀工入门：切片、切丝、切丁", d: "先学握刀和按食材，别一上来就追求快。", u: bili("刀工 入门 切丝 教程"), k: "视频" },
    { t: "火候：什么时候大火、什么时候小火", d: "家常菜九成的失败，都是火候不对。", u: bili("炒菜 火候 讲解"), k: "视频" },
    { t: "新手十道家常菜", d: "番茄炒蛋、青椒肉丝这类，成功率最高。", u: xcf("新手 家常菜"), k: "图文" },
    { t: "煎蛋、煮面、蒸米饭", d: "三件套练熟，一个人吃饭就不慌。", u: bili("煎蛋 技巧 溏心"), k: "视频" }
  ]},
  { lvl: "中", name: "中级", desc: "能一次做出两三道，配得上一桌饭。", items: [
    { t: "红烧：炒糖色和收汁", d: "红烧肉、红烧排骨都是这一套。", u: bili("红烧 炒糖色 教程"), k: "视频" },
    { t: "把汤炖成奶白色", d: "鱼汤骨头汤想白，关键先煎再冲开水。", u: bili("炖汤 奶白 技巧"), k: "视频" },
    { t: "碗汁配比：鱼香、糖醋、宫保", d: "记住比例，二十道菜都能套。", u: bili("鱼香汁 糖醋汁 比例"), k: "视频" },
    { t: "小炒的锅气从哪来", d: "锅够热、料沥干、下锅别急着翻。", u: bili("锅气 家常小炒 技巧"), k: "视频" }
  ]},
  { lvl: "高", name: "高级", desc: "请客不慌，能安排一桌有节奏的菜。", items: [
    { t: "蒸菜火候：蒸鱼、蒸蛋、蒸排骨", d: "差几十秒，口感差很多。", u: bili("清蒸鱼 火候 时间"), k: "视频" },
    { t: "卤水与酱货", d: "一锅卤水能反复用，卤蛋卤鸡爪都行。", u: bili("卤水 配方 家常"), k: "视频" },
    { t: "宴客菜单怎么排", d: "几凉几热、荤素比例、哪道提前做。", u: xcf("宴客菜 菜单"), k: "图文" },
    { t: "勾芡和收汁的区别", d: "什么菜该勾芡、芡要多厚。", u: bili("勾芡 技巧 收汁"), k: "视频" }
  ]},
  { lvl: "师", name: "大师", desc: "愿意钻进去，从技法层面理解做菜。", items: [
    { t: "吊高汤", d: "清汤和奶汤，是两套做法。", u: bili("吊高汤 清汤 奶汤"), k: "视频" },
    { t: "刀工进阶：花刀与剞刀", d: "鱿鱼、腰花能卷起来，靠的是刀法。", u: bili("花刀 教学 鱿鱼"), k: "视频" },
    { t: "面点：和面、发面、擀皮", d: "包子饺子，从一团面开始。", u: bili("发面 包子 和面 教程"), k: "视频" },
    { t: "川菜红油与复合辣", d: "红油的香和辣，是两件事。", u: bili("红油 熬制 辣椒面"), k: "视频" }
  ]}
];

function openCollect(id) { state.sheet = { type: "collect", id }; }
function closeSheet() { state.sheet = null; }

/* ---------- 底部弹层 ---------- */
function sheetHtml() {
  const sh = state.sheet;
  if (!sh) return "";
  if (sh.type === "collect") {
    const d = DISHES.find((x) => x.id === sh.id);
    const rows = (state.collections || []).map((c) => {
      const on = c.dishes.includes(sh.id);
      return "<button class='sheet-row" + (on ? " on" : "") + "' data-collect='" + c.id + "'>" +
        "<span class='ck'>" + (on ? "✓" : "") + "</span>" +
        "<span class='nm'>" + c.name + "</span>" +
        "<span class='ct'>" + c.dishes.length + " 道</span></button>";
    }).join("");
    return "<div class='sheet-mask' data-sheet-mask><div class='sheet'>" +
      "<div class='sheet-head'><b>收藏到</b><span class='muted'>" + (d ? d.name : "") + "</span></div>" +
      "<div class='sheet-rows'>" + rows + "</div>" +
      "<div class='sheet-new'><input id='foldname' type='text' placeholder='新建分类，比如「周末做」' maxlength='12'>" +
      "<button class='btn sm' data-folder-new>新建</button></div>" +
      "<button class='btn primary block' data-sheet-close>好了</button>" +
      "</div></div>";
  }
  if (sh.type === "newfolder" || sh.type === "rename") {
    const ren = sh.type === "rename";
    const c = ren ? state.collections.find((x) => x.id === sh.fid) : null;
    if (ren && !c) return "";
    return "<div class='sheet-mask' data-sheet-mask><div class='sheet'>" +
      "<div class='sheet-head'><b>" + (ren ? "改个名字" : "新建分类") + "</b></div>" +
      "<div class='sheet-new'><input id='foldname' type='text' value='" + (c ? c.name : "") + "' placeholder='比如「周末做」' maxlength='12'></div>" +
      "<div class='row-btns'><button class='btn' data-sheet-close>取消</button>" +
      "<button class='btn primary' data-folder-save='" + (ren ? sh.fid : "new") + "'>" + (ren ? "保存" : "建好了") + "</button></div>" +
      (ren ? "<button class='link-del' data-folder-remove='" + sh.fid + "'>删除这个分类</button>" : "") +
      "</div></div>";
  }
  if (sh.type === "copy") {
    return "<div class='sheet-mask' data-sheet-mask><div class='sheet'>" +
      "<div class='sheet-head'><b>复制这段</b><span class='muted'>长按选中后复制</span></div>" +
      "<textarea class='copy-area' readonly rows='10'>" + sh.text + "</textarea>" +
      "<button class='btn primary block' data-sheet-close>好了</button></div></div>";
  }
  return "";
}

function render() {
  const v = $("#app");

  if (state.screen === "home") {
    v.innerHTML = "<div class='screen'>" +
      "<div class='hero-home'><span class='kicker'>今天吃什么</span>" +
      "<h1>别纠结了，<em>我帮你挑</em></h1>" +
      "<p class='sub'>回答几个问题，或者告诉我冰箱里有什么。</p></div>" +
      bigBtn("a", "🤔", "不知道吃什么", "问几个问题，按口味挑菜", "quiz") +
      bigBtn("b", "🥕", "家里有食材", "告诉我你有什么，我报菜名", "pantry") +
      bigBtn("c", "🔥", "今日推荐", "8 道精选，不刷新，挑一道就走", "daily") +
      bigBtn("d", "📚", "学习指南", "从初级到大师，跟着视频练", "learn") +
      bigBtn("e", "🎯", "直接来一批", "不问条件，随便抽几道", "spin") +
      recentStrip() +
      "<button class='home-link' data-go='saved'>★ 我的收藏<span>" + state.saved.size + " 道</span>›</button>" +
      installTip() +
      "<p class='foot-note'>菜库 " + DISHES.length + " 道 · 点过「不想吃」的不会再出现</p>" +
    "</div>";
  }

  if (state.screen === "quiz") {
    const qs = activeQs();
    const Q = qs[Math.min(state.qi, qs.length - 1)];
    const idx = qs.indexOf(Q);
    const cur = state.answers[Q.id];
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='home' aria-label='返回'>‹</button>" +
      "<div class='progress'>" + qs.map((q, i) => "<div class='dot " + (state.answers[q.id] !== undefined ? "on" : i === idx ? "cur" : "") + "'></div>").join("") + "</div>" +
      "<span class='counter'>" + (idx + 1) + " / " + qs.length + "</span></div>" +
      "<div class='q-wrap'><h2 class='q-title'>" + Q.q + "</h2>" +
      "<p class='q-hint'>拿不准就选「都行」，我按常理挑。</p><div class='opts'>" +
      Q.opts.map(([label, val], i) => {
        const dead = (Q.id === "diet" || Q.id === "spicy") && val !== "any" && hardPool(Object.assign({}, state.answers, { [Q.id]: val })).length === 0;
        const sel = cur === val;
        return "<button class='opt" + (sel ? " sel" : "") + (dead ? " dead" : "") + "'" +
          (dead ? " disabled" : " data-ans='" + val + "'") + ">" +
          "<span class='num'>" + (i + 1) + "</span>" +
          "<span class='lbl'>" + label + (dead ? "（没菜了）" : "") + "</span>" +
          "<span class='tick'>✓</span></button>";
      }).join("") + "</div></div>" +
      "<div class='soft-foot'><button class='btn ghost block' data-go='result'>先这样，帮我挑几道 ›</button></div></div>";
  }

  if (state.screen === "soft") {
    const groups = [
      ["今天就想吃", SOFT.filter((o) => o.kind === "tag" || o.kind === "method")],
      ["想吃到的主料", SOFT.filter((o) => o.kind === "ing")],
      ["这些别放", SOFT.filter((o) => o.kind === "avoid")]
    ];
    const picked = (state.soft || new Set()).size;
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='quiz' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>还有什么讲究？</h2><span class='pill' id='softcount'>已选 " + picked + "</span></div>" +
      "<p class='sub' style='margin:-10px 0 18px'>可以多选，也可以一个都不选。这些只影响排序，不会把菜筛没。</p>" +
      "<div class='groups'>" + groups.map(([title, items]) =>
        "<div><div class='group-title'>" + title + "<span class='n'>" + items.length + "</span></div>" +
        "<div class='chips'>" + items.map((o) => {
          const key = o.kind + ":" + o.v;
          const on = (state.soft || new Set()).has(key);
          return "<button class='chipbtn" + (on ? " sel" : "") + "' data-soft='" + key + "'>" + o.label + "</button>";
        }).join("") + "</div></div>").join("") + "</div>" +
      "<div class='soft-foot'><button class='btn primary block' data-go='result'>就这些，推荐食物 →</button></div></div>";
  }

  if (state.screen === "result") {
    if (!state.batch.length) {
      v.innerHTML = "<div class='screen'><div class='topbar'><button class='back' data-go='home'>‹</button></div>" +
        "<div class='empty'><span class='big-emoji'>🥲</span>筛得太狠了，一道都不剩。<br>回去放宽一个条件试试。</div>" +
        "<button class='btn block' data-go='quiz'>改一下答案</button></div>";
    } else {
      const tag = state.refresh > 1 ? "第 " + state.refresh + " 批" : "按条件排的";
      v.innerHTML = "<div class='screen'>" +
        "<div class='topbar'><button class='back' data-go='quiz' aria-label='改答案'>‹</button>" +
        "<div class='result-head'><h2>" + (MEAL_TITLE[state.answers.meal] || "今天可以吃这些") + "</h2><span class='pill'>" + tag + "</span></div></div>" +
        condChips() +
        "<p class='result-sub'>点一道看做法，不满意就换一批——越往后越冷门。</p>" +
        "<div class='grid'>" + state.batch.map((d, i) => card(d, i)).join("") + "</div>" +
        "<p class='foot-note'>点过「不想吃」的不会再出现</p>" +
        "<div class='sticky'><div class='inner'>" +
        "<button class='btn' data-go='one'>🎡 转盘定一个</button>" +
        "<button class='btn primary' data-go='refresh'>🎲 刷新换一批</button>" +
        "</div></div></div>";
    }
  }

  if (state.screen === "pantry") {
    const quick = topIngredients(24);
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='home'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>家里有什么？</h2></div>" +
      "<p class='sub' style='margin:-10px 0 16px'>用顿号或空格隔开，有几样写几样，写多了更准。</p>" +
      "<div class='search-box'><input id='pantry' type='text' placeholder='例如：鸡蛋 番茄 面条' value='" + (state.pantryText || "") + "'></div>" +
      "<div class='suggest'>" + quick.map((q) => "<button data-add='" + q + "'>+ " + q + "</button>").join("") + "</div>" +
      "<div class='soft-foot'><button class='btn primary block' data-go='pantryResult'>看看能做什么</button></div></div>";
  }

  if (state.screen === "pantryResult") {
    if (!state.batch.length) {
      v.innerHTML = "<div class='screen'><div class='topbar'><button class='back' data-go='pantry'>‹</button></div>" +
        "<div class='empty'><span class='big-emoji'>🍳</span>库里暂时没有用这些食材的菜。<br>试试少写两样，或者换一个。</div>" +
        "<button class='btn block' data-go='pantry'>改一下食材</button></div>";
    } else {
      v.innerHTML = "<div class='screen'>" +
        "<div class='topbar'><button class='back' data-go='pantry' aria-label='改食材'>‹</button>" +
        "<div class='result-head'><h2>这些能用上你的食材</h2></div></div>" +
        "<p class='result-sub'>按能用的食材数量排序，用得上的越多越靠前。</p>" +
        "<div class='grid'>" + state.batch.map((d, i) => card(d, i)).join("") + "</div>" +
        "<div class='sticky'><div class='inner'>" +
        "<button class='btn' data-go='one'>🍳 就做这个</button>" +
        "<button class='btn primary' data-go='pantryRefresh'>🎲 换一批</button>" +
        "</div></div></div>";
    }
  }

  if (state.screen === "saved") {
    const rows = (state.collections || []).map((c) => {
      const names = c.dishes.slice(0, 3).map((id) => (DISHES.find((d) => d.id === id) || {}).name).filter(Boolean);
      const sub = c.dishes.length
        ? names.join(" · ") + (c.dishes.length > 3 ? " 等 " + c.dishes.length + " 道" : "")
        : "还没放东西，看到想吃的点 ☆";
      return "<div class='folder-row'>" +
        "<button class='folder-open' data-folder='" + c.id + "'>" +
        "<span class='fname'>" + c.name + "</span><span class='fsub'>" + sub + "</span></button>" +
        "<button class='fedit' data-rename='" + c.id + "' aria-label='重命名'>✎</button>" +
        "<button class='fedit' data-drop='" + c.id + "' aria-label='删除分类'>🗑</button></div>";
    }).join("");
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>我的收藏</h2><span class='pill'>" + state.saved.size + " 道</span></div>" +
      "<p class='result-sub'>分几个文件夹放着，点铅笔能改名。</p>" +
      "<div class='folders'>" + rows + "</div>" +
      "<button class='btn block' data-newfolder>+ 新建分类</button>" +
      "</div>";
  }

  if (state.screen === "folder") {
    const c = (state.collections || []).find((x) => x.id === state.folder);
    const list = c ? c.dishes.map((id) => DISHES.find((d) => d.id === id)).filter(Boolean) : [];
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>" + (c ? c.name : "分类") + "</h2><span class='pill'>" + list.length + " 道</span></div>" +
      (list.length
        ? "<p class='result-sub'>点卡片看做法；点星星可以取消收藏。</p><div class='grid'>" + list.map((d, i) => card(d, i)).join("") + "</div>"
        : "<div class='empty'><span class='big-emoji'>🍽</span>这个分类还是空的。<br>在菜谱右上角点 ☆ 就能收进来。</div>") +
      "</div>";
  }

  if (state.screen === "daily") {
    const groups = DAILY.groups.map((g) => {
      const items = g.items.map((it) => ({ d: DISHES.find((x) => x.id === it[0]), why: it[1] })).filter((x) => x.d);
      if (!items.length) return "";
      return "<div class='group-title' style='margin-top:20px'>" + g.title + "<span class='n'>" + items.length + "</span></div>" +
        "<p class='result-sub' style='margin:-4px 0 12px'>" + g.sub + "</p>" +
        "<div class='grid'>" + items.map((x, i) => card(x.d, i, x.why)).join("") + "</div>";
    }).join("");
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<div class='result-head'><h2>今日推荐</h2><span class='pill'>" + DAILY.updated + " 精选</span></div></div>" +
      "<p class='result-sub'>一共 8 道，不刷新。都是好上手、花钱不多的。</p>" +
      groups +
      "<p class='foot-note'>人工挑的，打包在 App 里，没网也能看。</p>" +
      "</div>";
  }

  if (state.screen === "learn") {
    const lv = state.learnLevel || "初";
    const cur = LEARN.find((x) => x.lvl === lv) || LEARN[0];
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>学习指南</h2></div>" +
      "<p class='result-sub'>按难度分四级，点进去是站外的视频或图文教程。</p>" +
      "<div class='lvltabs'>" + LEARN.map((x) =>
        "<button class='chipbtn" + (x.lvl === lv ? " sel" : "") + "' data-lvl='" + x.lvl + "'>" + x.name + "</button>").join("") +
      "</div>" +
      "<p class='sub' style='margin:2px 0 14px'>" + cur.desc + "</p>" +
      "<div class='learn-list'>" + cur.items.map((it) =>
        "<a class='learn-item' href='" + it.u + "' target='_blank' rel='noopener'>" +
        "<span class='lk'>" + it.k + "</span>" +
        "<span class='lt'><span class='t'>" + it.t + "</span><span class='d'>" + it.d + "</span></span>" +
        "<span class='arrow'>›</span></a>").join("") +
      "</div>" +
      "<p class='foot-note'>打开会在浏览器里搜 B 站或下厨房，不占 App 空间。</p>" +
      "</div>";
  }


  if (state.screen === "detail") {
    const d = DISHES.find((x) => x.id === state.current);
    if (!d) { state.screen = "home"; return render(); }
    const no = state.disliked.has(d.id);
    const sv = state.saved.has(d.id);
    const ate = daysSinceEaten(d.id) < 1;
    const ph = (PHOTOS[d.id] || [])[0];
    // hero 用本地缩略图（秒开、离线也有图），点「更多图片」才去拉网络图
    const heroSrc = THUMBS.has(d.id) ? "./data/thumbs/" + d.id + ".webp" : (ph && ph.u) || "";
    const hero = "<div class='hero' style='background:" + tint(d) + "'>" +
      "<span>" + emojiOf(d) + "</span>" +
      (heroSrc ? "<img class='cover' src='" + heroSrc + "' alt='" + d.name + " 实物图'>" : "") +
      "<button class='photo' data-photo='" + d.id + "'>" + (heroSrc || !photosReady ? "📷 更多图片" : "🔍 网上搜图") + "</button></div>";
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<span class='pill'>" + d.region + "菜</span><span class='pill'>大众度 " + d.popularity + "</span></div>" +
      hero +
      "<h1 style='font-size:25px;margin:0 0 12px'>" + d.name + "</h1>" +
      "<div class='detail-meta'>" +
      ["<span class='chip'>" + d.diet + "</span>", "<span class='chip'>" + d.taste + "</span>",
       "<span class='chip'>" + spicyWord[d.spicy] + "</span>", "<span class='chip'>" + d.method + "</span>",
       "<span class='chip'>" + d.timeMin + " 分钟</span>",
       "<span class='chip'>" + ["", "简单", "一般", "讲究"][d.difficulty] + "</span>"].join("") + "</div>" +
      "<h3 style='margin-bottom:10px'>做法</h3><div class='steps'>" +
      d.steps.map((s, i) => "<div class='step'><span class='n'>" + (i + 1) + "</span><span class='txt'>" + s + "</span></div>").join("") +
      "</div>" + (d.tips ? "<div class='tip'>💡 " + d.tips + "</div>" : "") +
      "<div class='actions'>" +
      "<button class='btn" + (sv ? " primary" : "") + "' data-save='" + d.id + "'>" + (sv ? "★ 已收藏" : "☆ 收藏") + "</button>" +
      "<button class='btn" + (ate ? " done" : "") + "' data-eat='" + d.id + "'>" + (ate ? "✓ 今天吃过了" : "🍽 吃过了") + "</button></div>" +
      "<button class='btn block copy-btn' data-copy='" + d.id + "'>📋 复制做法发给朋友</button>" +
      "<button class='dislike" + (no ? " on" : "") + "' data-dislike='" + d.id + "'>" + (no ? "✓ 已标记不想吃，不会再推" : "🙅 以后别再推这道") + "</button>" +
      nearHtml(d) +
      "<div class='sticky'><div class='inner'>" +
      "<a class='btn' href='" + SEARCH.recipes(d.name) + "' target='_blank' rel='noopener'>📖 找菜谱</a>" +
      "<a class='btn primary' href='" + SEARCH.video(d.name) + "' target='_blank' rel='noopener'>▶ 看视频</a>" +
      "</div></div></div>";
  }

  const shHtml = sheetHtml();
  if (shHtml) v.innerHTML += shHtml;
  const keep = state.keepScroll || 0;
  state.keepScroll = 0;
  window.scrollTo(0, keep);
  if (typeof document.querySelectorAll === "function") document.querySelectorAll(".thumb img").forEach(function (im) {
    const swap = function () {
      const remote = im.getAttribute("data-remote");
      if (remote) { im.removeAttribute("data-remote"); im.src = remote; }
      else im.remove();
    };
    im.addEventListener("error", swap);
    if (im.complete && im.naturalWidth === 0) swap();
  });
  const cover = $("#app .hero img.cover");
  if (cover) {
    const on = () => cover.classList.add("on");
    if (cover.complete && cover.naturalWidth) on();
    else { cover.addEventListener("load", on); cover.addEventListener("error", () => cover.remove()); }
  }
}

/* ---------- 真实照片：灯箱 ---------- */
let lbState = { id: null, i: 0 };
const photoList = (id) => (PHOTOS[id] || []).map((x) => x.u).filter(Boolean);

// 详情图（600KB+）不阻塞首屏：首屏只加载菜谱与本地缩略图，进详情页前再按需拉
function ensurePhotos() {
  if (photosLoading) return photosLoading;
  photosLoading = fetch("./data/photos.json")
    .then((r) => r.json())
    .then((j) => { PHOTOS = j || {}; photosReady = true; return PHOTOS; })
    .catch(() => { PHOTOS = {}; photosReady = true; return PHOTOS; });
  return photosLoading;
}

function openPhoto(id, i) {
  const d = DISHES.find((x) => x.id === id);
  const list = photoList(id);
  if (!d || !list.length) return;
  lbState = { id: id, i: ((i || 0) % list.length + list.length) % list.length };
  let box = $("#lightbox");
  if (!box) { box = document.createElement("div"); box.id = "lightbox"; box.className = "lightbox"; document.body.appendChild(box); }
  box.innerHTML = "<div class='lb-card'>" +
    "<div class='lb-img'" + (THUMBS.has(d.id) ? " style='background:url(./data/thumbs/" + d.id + ".webp) center/contain no-repeat'" : "") + ">" +
    "<img src='" + list[lbState.i] + "' alt='" + d.name + "' onerror=\"this.remove()\"></div>" +
    "<div class='lb-bar'><div class='lb-txt'><b>" + d.name + "</b><span>图片来自网络，仅供参考卖相</span></div>" +
    "<div class='lb-btns'>" + (list.length > 1 ? "<button class='btn sm' data-lb-next>换一张</button>" : "") +
    "<a class='btn sm' href='" + SEARCH.img(d.name) + "' target='_blank' rel='noopener'>搜更多</a>" +
    "<button class='btn sm primary' data-lb-close>关闭</button></div></div></div>";
  box.classList.add("on");
  document.body.style.overflow = "hidden";
}
function closePhoto() {
  const box = $("#lightbox");
  if (box) box.classList.remove("on");
  document.body.style.overflow = "";
}

/* ---------- 转盘：帮我定一个 ---------- */
const WHEEL_COLORS = ["#f9dccb", "#fbe8c8", "#e9efd8", "#f6dcc0", "#f4d5c4", "#e4ead6", "#fae4d3", "#f2e3c9"];
let wheelState = { winner: null, spinning: false };

function wheelHtml() {
  const items = state.batch;
  const n = items.length;
  const seg = 360 / n;
  const stops = items.map((d, i) => WHEEL_COLORS[i % WHEEL_COLORS.length] + " " + (i * seg).toFixed(2) + "deg " + ((i + 1) * seg).toFixed(2) + "deg").join(",");
  const labels = items.map((d, i) => {
    const a = i * seg + seg / 2;
    return "<div class='wheel-label' style='transform:rotate(" + a.toFixed(2) + "deg)'><span style='transform:rotate(" + (-a).toFixed(2) + "deg)'>" + d.name + "</span></div>";
  }).join("");
  return "<div class='wheel-card'>" +
    "<h3 class='wheel-title'>交给转盘吧</h3>" +
    "<div class='wheel-stage'>" +
      "<div class='wheel-disc' id='wheelDisc' style='background:conic-gradient(from 0deg," + stops + ")'>" + labels + "<span class='wheel-hub'>🎯</span></div>" +
      "<span class='wheel-pin'>▼</span>" +
    "</div>" +
    "<p class='wheel-result' id='wheelResult'>看它停在哪道</p>" +
    "<div class='lb-btns wheel-btns'>" +
      "<button class='btn sm' data-wheel-spin>再转一次</button>" +
      "<button class='btn sm primary' data-wheel-go disabled>就吃这个</button>" +
      "<button class='btn sm' data-wheel-close>关闭</button>" +
    "</div></div>";
}

function wheelSpin() {
  const disc = document.getElementById && document.getElementById("wheelDisc");
  const items = state.batch;
  if (!disc || !items.length) return;
  const n = items.length;
  const seg = 360 / n;
  const i = Math.floor(Math.random() * n);
  const center = i * seg + seg / 2;
  const target = 360 * 5 + ((360 - (center % 360)) % 360);
  wheelState.spinning = true;
  wheelState.winner = null;
  disc.style.transition = "none";
  disc.style.transform = "rotate(0deg)";
  void disc.offsetWidth;
  disc.style.transition = "transform 3.4s cubic-bezier(.12,.72,.05,1)";
  disc.style.transform = "rotate(" + target + "deg)";
  const res = document.getElementById("wheelResult");
  const go = document.querySelector && document.querySelector("[data-wheel-go]");
  const labels = document.querySelectorAll ? document.querySelectorAll(".wheel-label") : [];
  labels.forEach((el) => el.classList && el.classList.remove("win"));
  if (res) res.textContent = "转起来了…";
  if (go) go.setAttribute("disabled", "disabled");
  setTimeout(() => {
    wheelState.spinning = false;
    wheelState.winner = items[i];
    if (res) res.innerHTML = "就吃 <b>" + items[i].name + "</b> 吧";
    if (go) go.removeAttribute("disabled");
    labels.forEach((el, k) => {
      if (!el.classList) return;
      el.classList.toggle("win", k === i);
      // 停稳后把文字转正，别让赢家倒着写
      const span = el.firstElementChild || (el.querySelector && el.querySelector("span"));
      if (span && span.style) {
        const a = k * seg + seg / 2;
        span.style.transition = "transform .45s cubic-bezier(.22,.61,.36,1)";
        span.style.transform = "rotate(" + (-(a + target) % 360).toFixed(2) + "deg)";
      }
    });
  }, 3500);
}

function openWheel() {
  if (!state.batch.length) return;
  if (typeof document === "undefined" || !document.getElementById || !document.body) return;
  let box = document.getElementById("wheel");
  if (!box) { box = document.createElement("div"); box.id = "wheel"; box.className = "lightbox"; document.body.appendChild(box); }
  box.innerHTML = wheelHtml();
  box.classList.add("on");
  document.body.style.overflow = "hidden";
  setTimeout(wheelSpin, 80);
}
function closeWheel() {
  const box = document.getElementById && document.getElementById("wheel");
  if (box) box.classList.remove("on");
  if (document.body) document.body.style.overflow = "";
  wheelState.winner = null;
}

document.addEventListener("click", (e) => {
  const mask = e.target.closest("[data-sheet-mask]");
  if (mask && mask.dataset && mask.dataset.sheetMask !== undefined && e.target === mask) {
    closeSheet();
    return render();
  }
  const sb = e.target.closest("[data-sheet-close],[data-collect],[data-folder-new]");
  if (sb && sb.dataset && (sb.dataset.sheetClose !== undefined || sb.dataset.collect !== undefined || sb.dataset.folderNew !== undefined)) {
    if (sb.dataset.sheetClose !== undefined) { closeSheet(); return render(); }
    if (sb.dataset.collect !== undefined) {
      const sid = state.sheet && state.sheet.id;
      const c = (state.collections || []).find((x) => x.id === sb.dataset.collect);
      if (sid && c) {
        if (c.dishes.includes(sid)) removeFromFolder(sb.dataset.collect, sid);
        else addToFolder(sb.dataset.collect, sid);
      }
      state.keepScroll = (typeof window !== "undefined" && window.scrollY) || 0;
      return render();
    }
    if (sb.dataset.folderNew !== undefined) {
      const inp = $("#foldname");
      const name = inp && inp.value ? inp.value.trim() : "";
      if (!name) return;
      const fid = createFolder(name);
      const sid = state.sheet && state.sheet.id;
      if (sid) addToFolder(fid, sid);
      state.keepScroll = (typeof window !== "undefined" && window.scrollY) || 0;
      return render();
    }
  }
  const wb = e.target.closest("[data-wheel-spin],[data-wheel-go],[data-wheel-close]");
  if (wb && (wb.dataset.wheelSpin !== undefined || wb.dataset.wheelGo !== undefined || wb.dataset.wheelClose !== undefined)) {
    if (wb.dataset.wheelSpin !== undefined) { wheelSpin(); return; }
    if (wb.dataset.wheelClose !== undefined) { closeWheel(); return; }
    if (wb.dataset.wheelGo !== undefined) {
      if (wheelState.spinning) return;
      const d = wheelState.winner;
      closeWheel();
      if (!d) return;
      pushNav();
      state.current = d.id; state.screen = "detail";
      return render();
    }
  }
  const insBtn = e.target.closest("[data-install],[data-install-hide]");
  if (insBtn && insBtn.dataset && (insBtn.dataset.install !== undefined || insBtn.dataset.installHide !== undefined)) {
    if (insBtn.dataset.installHide !== undefined) {
      try { localStorage.setItem("hideInstall", "1"); } catch (err) {}
    } else if (deferredPrompt) {
      const p = deferredPrompt;
      deferredPrompt = null;
      try { p.prompt(); } catch (err) {}
    }
    return render();
  }
  if (e.target.id === "lightbox") { closePhoto(); return; }
  const lb = e.target.closest("[data-lb-close],[data-lb-next]");
  if (lb && lb.dataset && (lb.dataset.lbClose !== undefined || lb.dataset.lbNext !== undefined)) {
    if (lb.dataset.lbClose !== undefined) closePhoto();
    else openPhoto(lbState.id, lbState.i + 1);
    return;
  }
  const t = e.target.closest("[data-go],[data-ans],[data-id],[data-add],[data-dislike],[data-soft],[data-save],[data-star],[data-eat],[data-copy],[data-photo],[data-folder],[data-rename],[data-drop],[data-newfolder],[data-folder-save],[data-folder-remove],[data-lvl]");
  if (!t) return;
  if (t.dataset.photo) {
    const id = t.dataset.photo;
    const openWeb = () => { const d = DISHES.find((x) => x.id === id); window.open(SEARCH.img(d ? d.name : ""), "_blank"); };
    if (photoList(id).length) { openPhoto(id, 0); return; }
    if (!photosReady) { ensurePhotos().then(() => { if (photoList(id).length) openPhoto(id, 0); else openWeb(); }); return; }
    openWeb();
    return;
  }
  if (t.dataset.soft) {
    state.soft = state.soft || new Set();
    const k = t.dataset.soft;
    const on = !state.soft.has(k);
    if (on) state.soft.add(k); else state.soft.delete(k);
    // 原地切换，不整页重刷，避免一闪
    if (t.classList && t.classList.toggle) {
      t.classList.toggle("sel", on);
      const c = $("#softcount");
      if (c) c.textContent = "已选 " + state.soft.size;
      return;
    }
    return render();
  }
  if (t.dataset.star) {
    const id = t.dataset.star;
    const on = !state.saved.has(id);
    if (on) addToFolder(defaultFolder(), id); else removeEverywhere(id);
    toast(on ? "已收藏到「" + ((state.collections[0] || {}).name || "我想吃") + "」" : "已取消收藏");
    if (state.screen === "saved" || state.screen === "folder") return render();
    if (t.classList && t.classList.toggle) {
      t.classList.toggle("on", on);
      t.textContent = on ? "★" : "☆";
      return;
    }
    return render();
  }
  if (t.dataset.save) {
    openCollect(t.dataset.save);
    state.keepScroll = (typeof window !== "undefined" && window.scrollY) || 0;
    return render();
  }
  if (t.dataset.copy) { return copyText(t.dataset.copy); }
  if (t.dataset.eat) {
    const id = t.dataset.eat;
    const on = daysSinceEaten(id) >= 1;
    if (on) { markEaten(id); toast("记下了，三天内少推这道"); }
    else { unmarkEaten(id); toast("已取消「今天吃过了」"); }
    t.textContent = on ? "✓ 今天吃过了" : "🍽 吃过了";
    if (t.classList) t.classList.toggle("done", on);
    return;
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
    pushNav();
    state.current = t.dataset.id;
    state.screen = "detail";
    return render();
  }
  if (t.dataset.dislike) {
    const id = t.dataset.dislike;
    const on = !state.disliked.has(id);
    if (on) state.disliked.add(id); else state.disliked.delete(id);
    localStorage.setItem("disliked", JSON.stringify([...state.disliked]));
    if (t.classList && t.classList.toggle) {
      t.classList.toggle("on", on);
      t.textContent = on ? "✓ 已标记不想吃，不会再推" : "🙅 以后别再推这道";
      return;
    }
    return render();
  }
  if (t.dataset.folder) {
    pushNav();
    state.folder = t.dataset.folder;
    state.screen = "folder";
    return render();
  }
  if (t.dataset.rename) { state.sheet = { type: "rename", fid: t.dataset.rename }; return render(); }
  if (t.dataset.drop) return askDropFolder(t.dataset.drop);
  if (t.dataset.newfolder !== undefined) { state.sheet = { type: "newfolder" }; return render(); }
  if (t.dataset.folderSave) {
    const inp = $("#foldname");
    const name = inp && inp.value ? inp.value.trim() : "";
    if (!name) return;
    if (t.dataset.folderSave === "new") createFolder(name);
    else renameFolder(t.dataset.folderSave, name);
    state.sheet = null;
    toast("已保存");
    return render();
  }
  if (t.dataset.folderRemove) return askDropFolder(t.dataset.folderRemove);
  if (t.dataset.lvl) { state.learnLevel = t.dataset.lvl; return render(); }
  const go = t.dataset.go;
  if (!go) return;
  if (go === "back") { navBack(); return render(); }
  if (go === "home") {
    state.screen = "home"; state.qi = 0; state.answers = {}; state.soft = new Set();
    state.stack = []; state.folder = null; state.sheet = null;
    return render();
  }
  if (go === "one") { openWheel(); return; }
  if (go !== state.screen) pushNav();
  if (go === "quiz") { state.screen = "quiz"; state.qi = 0; state.answers = {}; state.soft = new Set(); }
  else if (go === "soft") { state.screen = "soft"; }
  else if (go === "result") { state.screen = "result"; pick(true); }
  else if (go === "refresh") { state.screen = "result"; pick(false); }
  else if (go === "spin") { state.answers = {}; state.soft = new Set(); state.shown = new Set(); state.screen = "result"; pick(true); }
  else if (go === "saved") { state.screen = "saved"; }
  else if (go === "daily") { state.screen = "daily"; }
  else if (go === "learn") { state.screen = "learn"; }
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

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const wb = document.getElementById && document.getElementById("wheel");
  if (wb && wb.classList.contains("on")) { closeWheel(); return; }
  closePhoto();
});

(async () => {
  try {
    const idx = await (await fetch("./data/index.json")).json();
    const lists = await Promise.all(idx.files.map((f) => fetch("./data/dishes/" + f).then((r) => r.json())));
    DISHES = lists.flat();
    try { THUMBS = new Set(await (await fetch("./data/thumbs.json")).json()); } catch (e) { THUMBS = new Set(); }
  } catch (err) {
    $("#app").innerHTML = "<div class='empty'>菜谱库加载失败。<br>请用本地服务器打开。</div>";
    return;
  }
  try { state.disliked = new Set(JSON.parse(localStorage.getItem("disliked") || "[]")); } catch (e) {}
  try { state.saved = new Set(JSON.parse(localStorage.getItem("saved") || "[]")); } catch (e) {}
  try { state.eaten = JSON.parse(localStorage.getItem("eaten") || "[]") || []; } catch (e) { state.eaten = []; }
  try { state.collections = JSON.parse(localStorage.getItem("collections") || "null"); } catch (e) { state.collections = null; }
  if (!Array.isArray(state.collections) || !state.collections.length) {
    state.collections = SEED_FOLDERS.map((f) => ({ id: f.id, name: f.name, dishes: [] }));
    if (state.saved && state.saved.size) state.collections[0].dishes = [...state.saved];
    saveCollections();
  }
  state.collections.forEach((c) => { if (!Array.isArray(c.dishes)) c.dishes = []; });
  rebuildSaved();
  const hash = (typeof window !== "undefined" && window.location && window.location.hash) || "";
  const deep = hash.replace("#", "").trim();
  if (deep && DISHES.some((d) => d.id === deep)) { state.current = deep; state.screen = "detail"; }
  render();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
