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
const state = { screen: "home", answers: {}, soft: new Set(), qi: 0, shown: new Set(), disliked: new Set(), saved: new Set(), eaten: [], batch: [], reasons: new Map(), refresh: 0, pantryText: "", collections: [], stack: [], folder: null, sheet: null, learnLevel: "初", current: null, dailyGroup: null, game: null };

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
  if (!c) return;
  if (c.dishes.length) { state.sheet = { type: "confirmdrop", fid: id }; return render(); }
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
    { id: "hot", title: "最近正流行", items: [
      ["fanqie-xiaren", "虾仁滑嫩不柴，酸甜口的小孩也爱吃"],
      ["suan-dou-jiao-rou-mo", "一勺酸豆角能扒两碗饭，成本很低"],
      ["duojiao-zheng-jinzhengu", "上锅蒸 12 分钟，几乎不用看火"],
      ["tangcu-oupian", "脆生生带一点酸甜，配油腻的菜正好"]
    ]},
    { id: "light", title: "清爽养胃", items: [
      ["ji-yu-doufu-tang", "汤白味鲜，蛋白质好吸收"],
      ["shang-tang-wa-wa-cai", "清淡解腻，配饭不抢味"],
      ["zheng-nan-gua", "整块蒸熟，甜味来自南瓜本身"],
      ["xiao-mi-zhou", "小米煮到开花，胃不舒服时吃它"]
    ]}
  ]
};

/* ---------- 学习指南（外链指引） ---------- */
const bili = (q) => "https://search.bilibili.com/all?keyword=" + encodeURIComponent(q);
const xcf = (q) => "https://www.xiachufang.com/search/?keyword=" + encodeURIComponent(q);
const LEARN = [
  { lvl: "初", name: "初级", desc: "把菜做熟，不糊、不夹生。重点在备料和火候。",
    practice: ["fanqie-chaodan", "qingjiao-rousi", "liangban-huanggua", "zicai-danhua-tang"],
    topics: [
      { t: "刀工与备料", items: [
        { t: "握刀、切片", d: "左手蜷指按料，右手只做上下，不做左右。", q: "刀工 切片 握刀", k: "视频" },
        { t: "切丝与切丁", d: "先片成片，再叠起来切丝；丁的边长要一致。", q: "切丝 切丁 刀工", k: "视频" },
        { t: "备料顺序", d: "洗、切、腌、调汁先做完，开火之后不离开灶台。", q: "炒菜 备料 顺序", k: "图文" }
      ]},
      { t: "火候", items: [
        { t: "热锅凉油", d: "锅烧到微微冒烟再下油，食材不粘锅。", q: "热锅凉油 原理", k: "视频" },
        { t: "大火与小火的分别", d: "爆炒用大火，炖煮用小火，煎用中小火。", q: "炒菜 火候 大小", k: "视频" },
        { t: "判断油温", d: "三四成热筷子周围起小泡，七八成热开始冒烟。", q: "油温 几成热 判断", k: "视频" }
      ]},
      { t: "三件套", items: [
        { t: "煎蛋", d: "锅热、油薄、蛋下去不要马上动。", q: "煎蛋 不粘 溏心", k: "视频" },
        { t: "煮面", d: "水开下面，点两次凉水，面芯才透。", q: "煮面 不坨 技巧", k: "视频" },
        { t: "蒸米饭", d: "米水比例约 1:1.2，跳闸后焖十分钟。", q: "蒸米饭 水米比例", k: "图文" }
      ]}
    ]},
  { lvl: "中", name: "中级", desc: "一次做出两三道菜，时间安排得开。", 
    practice: ["hongshao-rou", "kele-jichi", "mapo-doufu", "yuxiang-rousi"],
    topics: [
      { t: "红烧与炖煮", items: [
        { t: "炒糖色", d: "冰糖小火化开，变枣红色立刻下肉，慢一秒就苦。", q: "炒糖色 红烧 教程", k: "视频" },
        { t: "收汁", d: "汤汁剩三分之一时转大火，晃锅不翻勺。", q: "红烧 收汁 技巧", k: "视频" },
        { t: "炖肉加水", d: "中途只加开水，冷水会让肉纤维收紧。", q: "炖肉 加热水 原理", k: "视频" }
      ]},
      { t: "把汤炖白", items: [
        { t: "煎鱼冲开水", d: "鱼煎透，一次冲足开水，大火滚十分钟。", q: "鱼汤 奶白 做法", k: "视频" },
        { t: "骨头汤", d: "冷水下锅焯净血沫，再换开水炖。", q: "骨头汤 奶白 技巧", k: "视频" },
        { t: "调味的先后", d: "盐最后放，放早了肉不易烂。", q: "炖汤 放盐 时间", k: "图文" }
      ]},
      { t: "碗汁与锅气", items: [
        { t: "鱼香汁", d: "糖醋各一勺半，生抽一勺，淀粉半勺，水两勺。", q: "鱼香汁 比例", k: "视频" },
        { t: "糖醋汁", d: "糖醋一比一，加一点生抽提色。", q: "糖醋汁 比例", k: "视频" },
        { t: "锅气", d: "锅够热、料沥干、下锅别急着翻。", q: "锅气 小炒 技巧", k: "视频" }
      ]}
    ]},
  { lvl: "高", name: "高级", desc: "请客不慌，能把一桌菜排开。", 
    practice: ["qingzheng-luyu", "tang-cu-paigu", "duo-jiao-zheng-pai-gu", "baiqie-ji"],
    topics: [
      { t: "蒸菜", items: [
        { t: "清蒸鱼", d: "水开上锅，一斤蒸八分钟，关火焖两分钟。", q: "清蒸鱼 时间 火候", k: "视频" },
        { t: "蒸蛋", d: "蛋水一比一点五，过筛，盖膜，中小火。", q: "蒸蛋 比例 嫩", k: "视频" },
        { t: "蒸排骨", d: "提前腌两小时，铺平不叠，蒸汽才透。", q: "蒸排骨 腌制 时间", k: "视频" }
      ]},
      { t: "卤与酱", items: [
        { t: "起一锅卤水", d: "香料先炒香，再下生抽老抽和冰糖。", q: "卤水 配方 家常", k: "视频" },
        { t: "卤水的保存", d: "每次用完滤渣、烧开、冷藏，可反复用。", q: "卤水 保存 复用", k: "图文" },
        { t: "酱货上色", d: "糖色打底，老抽只补色，别一次下多。", q: "酱货 上色 技巧", k: "视频" }
      ]},
      { t: "一桌菜", items: [
        { t: "菜单结构", d: "两凉四热一汤，荤素按三比二配。", q: "宴客 菜单 搭配", k: "图文" },
        { t: "出菜顺序", d: "凉菜先上，蒸菜占灶，炒菜最后。", q: "请客 出菜 顺序", k: "图文" },
        { t: "能提前做的菜", d: "卤味、炖菜、凉菜前一天做好更入味。", q: "提前备菜 宴客", k: "图文" }
      ]}
    ]},
  { lvl: "师", name: "大师", desc: "从技法层面理解，而不只是照着做。", 
    practice: ["xiao-long-bao", "jiu-cai-ji-dan-jiao-zi"],
    topics: [
      { t: "汤与高汤", items: [
        { t: "清汤", d: "小火吊，汤面只冒小泡，不搅动。", q: "清汤 吊汤 做法", k: "视频" },
        { t: "奶汤", d: "大火滚，油脂乳化，汤才白。", q: "奶汤 大火 乳化", k: "视频" },
        { t: "扫汤", d: "用肉糜吸附杂质，汤才清亮。", q: "扫汤 高级清汤", k: "视频" }
      ]},
      { t: "刀工进阶", items: [
        { t: "花刀", d: "鱿鱼、腰花打交叉刀口，受热才卷。", q: "花刀 鱿鱼 教学", k: "视频" },
        { t: "剞刀", d: "刀深到四分之三，不断皮。", q: "剞刀 技法", k: "视频" },
        { t: "片薄", d: "刀身贴料，推拉结合，片才均匀。", q: "片薄 刀工 练习", k: "视频" }
      ]},
      { t: "面点", items: [
        { t: "和面", d: "水量分次加，揉到面团光滑不粘手。", q: "和面 水量 技巧", k: "视频" },
        { t: "发面", d: "酵母先化在温水里，二十八度发一小时。", q: "发面 酵母 温度", k: "视频" },
        { t: "擀皮与包制", d: "中间厚边缘薄，收口才不漏。", q: "擀皮 包包子 手法", k: "视频" }
      ]}
    ]}
];

function openCollect(id) { state.sheet = { type: "collect", id }; }
function closeSheet() { state.sheet = null; }

/* ---------- 小游戏（2048 / 俄罗斯方块 / 打砖块） ---------- */
const MINI_KEY = "mini";
const MINI = { total: 0, best: {} };

function loadMini() {
  try {
    const raw = localStorage.getItem(MINI_KEY);
    if (!raw) return;
    const o = JSON.parse(raw) || {};
    MINI.total = o.total || o.points || 0;
    const b = o.best || {};
    Object.keys(b).forEach(function (k) {
      const v = b[k];
      const n = typeof v === "number" ? v : (v && v.score) || 0;
      if (n > MINI.best[k]) MINI.best[k] = n;
    });
  } catch (e) {}
}
function saveMini() {
  try { localStorage.setItem(MINI_KEY, JSON.stringify({ total: MINI.total, best: MINI.best })); } catch (e) {}
}
loadMini();

const GAME_META = {
  g2048: { t: "2048", ico: "🔢", d: "相同数字撞到一起会合并，想办法拼出 2048。" },
  tetris: { t: "俄罗斯方块", ico: "🧱", d: "方块堆满一行自动消掉，每 10 行快一档。" },
  brick: { t: "打砖块", ico: "🧨", d: "拖挡板接球，把墙上的砖全部打光。" }
};
const GAME_KINDS = ["g2048", "tetris", "brick"];

const GAME_QUOTES = [
  "炒任何菜之前，锅要烧到微微冒烟再下油，食材才不粘。",
  "炖肉中途加水只能加开水，冷水会让肉收紧。",
  "蒸鱼要等水开再上锅，计时从上汽那一刻算。",
  "青菜下锅前要沥干，带水下锅只会煮，不会炒。",
  "盐分两次放：下锅定底味，出锅前补足。",
  "勾芡的淀粉水要现调，放久了会沉底。",
  "焯水加姜片和料酒，去腥主要靠这两样。",
  "煎鱼前把鱼身擦干，皮才不破。",
  "切丝先片成片，叠起来再切，粗细才一致。",
  "炒饭用隔夜米，水分少，粒粒分明。"
];

let gameState = null;

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

function stopGame() {
  const g = gameState;
  gameState = null;
  if (!g) return;
  if (g.raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(g.raf);
  if (g.bannerTimer) clearTimeout(g.bannerTimer);
}

function putText(id, val) {
  const el = document.getElementById && document.getElementById(id);
  if (el) el.textContent = String(val);
}

function syncHud() {
  const g = gameState;
  if (!g) return;
  putText("game-score", g.score);
  const hud = document.getElementById && document.getElementById("game-hud");
  if (!hud) return;
  let rows;
  if (g.kind === "g2048") rows = [["分数", g.score], ["最高", Math.max(MINI.best.g2048 || 0, g.score)], ["最大", g.max || 2]];
  else if (g.kind === "tetris") rows = [["分数", g.score], ["消行", g.lines], ["等级", g.level]];
  else rows = [["分数", g.score], ["关卡", g.level], ["命", g.lives]];
  hud.innerHTML = rows.map(function (r) { return "<span>" + r[0] + " <b>" + r[1] + "</b></span>"; }).join("");
}

function banner(text) {
  const el = document.getElementById && document.getElementById("game-banner");
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  el.classList.add("on");
  const g = gameState;
  if (!g) return;
  if (g.bannerTimer) clearTimeout(g.bannerTimer);
  g.bannerTimer = setTimeout(function () {
    el.classList.remove("on");
    el.hidden = true;
  }, 1400);
}

function finish(msg) {
  const g = gameState;
  if (!g || g.over) return;
  g.over = true;
  if (g.raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(g.raf);
  MINI.best[g.kind] = Math.max(MINI.best[g.kind] || 0, g.score);
  MINI.total += g.score;
  saveMini();
  syncHud();
  const el = document.getElementById && document.getElementById("game-over");
  if (!el) return;
  let extra;
  if (g.kind === "g2048") extra = "<span>最大 <b>" + (g.max || 2) + "</b></span>";
  else if (g.kind === "tetris") extra = "<span>消行 <b>" + g.lines + "</b></span>";
  else extra = "<span>关卡 <b>" + g.level + "</b></span>";
  const q = GAME_QUOTES[Math.floor(Math.random() * GAME_QUOTES.length)];
  el.innerHTML = "<div class='go-card'>" +
    "<div class='go-msg'>" + msg + "</div>" +
    "<div class='go-stats'><span>得分 <b>" + g.score + "</b></span>" + extra +
    "<span>最高 <b>" + MINI.best[g.kind] + "</b></span></div>" +
    "<p class='go-quote'>" + q + "</p>" +
    "<div class='row-btns'><button class='btn' data-game-retry='" + g.kind + "'>再来一局</button>" +
    "<button class='btn primary' data-go='back'>返回小游戏</button></div></div>";
  el.hidden = false;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ---------- 2048 ---------- */
function newBoard2048() {
  return [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
}

function addTile2048(g) {
  const free = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!g.b[y][x]) free.push([x, y]);
  if (!free.length) return false;
  const p = free[Math.floor(Math.random() * free.length)];
  g.b[p[1]][p[0]] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

function draw2048(g) {
  const el = document.getElementById && document.getElementById("g2048");
  if (!el) return;
  let html = "";
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const v = g.b[y][x];
      html += "<div class='tile" + (v ? " t" + v : " empty") + "'>" + (v || "") + "</div>";
    }
  }
  el.innerHTML = html;
}

function blocked2048(g) {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = g.b[y][x];
    if (!v) return false;
    if (x < 3 && g.b[y][x + 1] === v) return false;
    if (y < 3 && g.b[y + 1][x] === v) return false;
  }
  return true;
}

function move2048(g, dir) {
  if (!g || g.kind !== "g2048" || g.over) return;
  const b = g.b;
  const before = JSON.stringify(b);
  let gained = 0;
  function mergeLine(line) {
    const a = line.filter(function (v) { return v; });
    const out = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === a[i + 1]) { out.push(a[i] * 2); gained += a[i] * 2; i++; }
      else out.push(a[i]);
    }
    while (out.length < 4) out.push(0);
    return out;
  }
  function read(i, j) {
    if (dir === "left") return b[i][j];
    if (dir === "right") return b[i][3 - j];
    if (dir === "up") return b[j][i];
    return b[3 - j][i];
  }
  function write(i, j, v) {
    if (dir === "left") b[i][j] = v;
    else if (dir === "right") b[i][3 - j] = v;
    else if (dir === "up") b[j][i] = v;
    else b[3 - j][i] = v;
  }
  for (let i = 0; i < 4; i++) {
    const line = [0, 1, 2, 3].map(function (j) { return read(i, j); });
    const out = mergeLine(line);
    for (let j = 0; j < 4; j++) write(i, j, out[j]);
  }
  if (JSON.stringify(b) === before) return;
  g.score += gained;
  addTile2048(g);
  let mx = 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) mx = Math.max(mx, g.b[y][x]);
  g.max = mx;
  if (!g.won && mx >= 2048) { g.won = true; banner("2048 拼出来了"); }
  syncHud();
  draw2048(g);
  if (blocked2048(g)) finish("走不动了。");
}

/* ---------- 俄罗斯方块 ---------- */
const TET_SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
};
const TET_KEYS = ["I", "O", "T", "S", "Z", "J", "L"];
const TET_COLORS = { I: "#67b6c9", O: "#e8c25f", T: "#b48ad6", S: "#7fbf72", Z: "#e2685a", J: "#6f8fd0", L: "#e69a52" };

function tetEmpty() {
  const rows = [];
  for (let y = 0; y < 20; y++) rows.push([null, null, null, null, null, null, null, null, null, null]);
  return rows;
}

function tetCollide(g, m, px, py) {
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (!m[y][x]) continue;
      const bx = px + x;
      const by = py + y;
      if (bx < 0 || bx >= 10 || by >= 20) return true;
      if (by >= 0 && g.grid[by][bx]) return true;
    }
  }
  return false;
}

function tetSpawn(g) {
  const k = TET_KEYS[Math.floor(Math.random() * TET_KEYS.length)];
  const m = TET_SHAPES[k].map(function (r) { return r.slice(); });
  const x = Math.floor((10 - m[0].length) / 2);
  if (tetCollide(g, m, x, 0)) { g.cur = null; finish("堆到顶了。"); return; }
  g.cur = { k: k, m: m, x: x, y: 0 };
}

function tetClear(g) {
  let n = 0;
  for (let y = 19; y >= 0; y--) {
    let full = true;
    for (let x = 0; x < 10; x++) if (!g.grid[y][x]) { full = false; break; }
    if (!full) continue;
    g.grid.splice(y, 1);
    g.grid.unshift([null, null, null, null, null, null, null, null, null, null]);
    n++;
    y++;
  }
  if (!n) return;
  g.score += [0, 100, 300, 500, 800][n] * g.level;
  g.lines += n;
  const lv = 1 + Math.floor(g.lines / 10);
  if (lv > g.level) {
    g.level = lv;
    g.dropMs = Math.max(90, 800 - (g.level - 1) * 70);
    banner("第 " + g.level + " 档");
  }
  syncHud();
}

function tetLock(g) {
  const cur = g.cur;
  if (!cur) return;
  for (let y = 0; y < cur.m.length; y++) {
    for (let x = 0; x < cur.m[y].length; x++) {
      if (!cur.m[y][x]) continue;
      const by = cur.y + y;
      const bx = cur.x + x;
      if (by >= 0 && by < 20 && bx >= 0 && bx < 10) g.grid[by][bx] = cur.k;
    }
  }
  g.cur = null;
  tetClear(g);
  tetSpawn(g);
}

function tetStep(g) {
  if (!g.cur) return;
  if (!tetCollide(g, g.cur.m, g.cur.x, g.cur.y + 1)) g.cur.y += 1;
  else tetLock(g);
}

function tetRotate(g) {
  const cur = g.cur;
  if (!cur || cur.k === "O") return;
  const m = cur.m;
  const r = m[0].map(function (_, i) { return m.map(function (row) { return row[i]; }).reverse(); });
  const kicks = [0, -1, 1, -2, 2];
  for (let i = 0; i < kicks.length; i++) {
    if (!tetCollide(g, r, cur.x + kicks[i], cur.y)) {
      cur.m = r;
      cur.x += kicks[i];
      return;
    }
  }
}

function tetInput(key) {
  const g = gameState;
  if (!g || g.kind !== "tetris" || g.over || !g.cur) return;
  if (key === "left") { if (!tetCollide(g, g.cur.m, g.cur.x - 1, g.cur.y)) g.cur.x -= 1; }
  else if (key === "right") { if (!tetCollide(g, g.cur.m, g.cur.x + 1, g.cur.y)) g.cur.x += 1; }
  else if (key === "down") { tetStep(g); g.acc = 0; }
  else if (key === "rot") tetRotate(g);
  else if (key === "drop") {
    let guard = 0;
    while (g.cur && !tetCollide(g, g.cur.m, g.cur.x, g.cur.y + 1) && guard++ < 25) g.cur.y += 1;
    tetLock(g);
    g.acc = 0;
  }
  drawTetris(g);
}

function drawTetris(g) {
  const ctx = g.ctx;
  const c = g.cell;
  const W = g.cv.width;
  const H = g.cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#221b17";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,.05)";
  ctx.lineWidth = 1;
  for (let x = 1; x < 10; x++) { ctx.beginPath(); ctx.moveTo(x * c, 0); ctx.lineTo(x * c, H); ctx.stroke(); }
  for (let y = 1; y < 20; y++) { ctx.beginPath(); ctx.moveTo(0, y * c); ctx.lineTo(W, y * c); ctx.stroke(); }
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 10; x++) {
      const k = g.grid[y][x];
      if (!k) continue;
      ctx.fillStyle = TET_COLORS[k] || "#9c8a7a";
      roundRect(ctx, x * c + 1, y * c + 1, c - 2, c - 2, 3 * g.dpr);
      ctx.fill();
    }
  }
  const cur = g.cur;
  if (!cur) return;
  ctx.fillStyle = TET_COLORS[cur.k] || "#9c8a7a";
  for (let y = 0; y < cur.m.length; y++) {
    for (let x = 0; x < cur.m[y].length; x++) {
      if (!cur.m[y][x]) continue;
      const by = cur.y + y;
      if (by < 0) continue;
      roundRect(ctx, (cur.x + x) * c + 1, by * c + 1, c - 2, c - 2, 3 * g.dpr);
      ctx.fill();
    }
  }
}

/* ---------- 打砖块 ---------- */
function brickSetup(g) {
  g.W = g.cv.width;
  g.H = g.cv.height;
  const dpr = g.dpr;
  g.bricks = [];
  const cols = 7;
  const rows = 4 + Math.min(3, g.level);
  const gap = 2 * dpr;
  const top = 26 * dpr;
  const bw = (g.W - gap * (cols + 1)) / cols;
  const bh = 13 * dpr;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      g.bricks.push({ x: gap + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, row: r, hp: 1 });
    }
  }
  if (!g.pad) g.pad = { w: 66 * dpr, h: 10 * dpr, x: g.W / 2 - 33 * dpr };
  if (g.lives === undefined) g.lives = 3;
  g.ball = { x: g.W / 2, y: g.H - 78 * dpr, r: 5 * dpr, live: false, speed: (3.1 + (g.level - 1) * 0.3) * dpr, vx: 0, vy: 0 };
}

function brickLose(g) {
  g.lives -= 1;
  syncHud();
  if (g.lives <= 0) { finish("球掉光了。"); return; }
  banner("还剩 " + g.lives + " 条命");
  g.ball.live = false;
  g.ball.vx = 0;
  g.ball.vy = 0;
  g.ball.x = g.W / 2;
  g.ball.y = g.H - 78 * g.dpr;
}

function brickLaunch(g) {
  const b = g.ball;
  if (!b || b.live) return;
  b.live = true;
  b.vx = b.speed * 0.42;
  b.vy = -Math.abs(b.speed * 0.9);
}

function brickUpdate(g, f) {
  const b = g.ball;
  if (!b || !b.live || g.over) return;
  const pad = g.pad;
  const steps = Math.min(8, Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * f / (b.r * 0.9))));
  for (let s = 0; s < steps; s++) {
    b.x += (b.vx * f) / steps;
    b.y += (b.vy * f) / steps;
    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r > g.W) { b.x = g.W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
    const padTop = g.H - pad.h - 6 * g.dpr;
    if (b.vy > 0 && b.y + b.r >= padTop && b.y - b.r <= padTop + pad.h && b.x >= pad.x - b.r && b.x <= pad.x + pad.w + b.r) {
      b.y = padTop - b.r;
      const off = Math.max(-1, Math.min(1, (b.x - (pad.x + pad.w / 2)) / (pad.w / 2)));
      const sp = Math.max(3.1 * g.dpr, Math.hypot(b.vx, b.vy));
      const ang = off * 1.0;
      b.vx = Math.sin(ang) * sp;
      b.vy = -Math.abs(Math.cos(ang) * sp);
    }
    for (let i = 0; i < g.bricks.length; i++) {
      const br = g.bricks[i];
      if (br.hp <= 0) continue;
      if (b.x + b.r > br.x && b.x - b.r < br.x + br.w && b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
        br.hp = 0;
        g.score += 10;
        const ox = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
        const oy = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
        if (ox < oy) b.vx = -b.vx;
        else b.vy = -b.vy;
        syncHud();
        break;
      }
    }
    if (b.y - b.r > g.H) { brickLose(g); return; }
  }
  let left = 0;
  for (let i = 0; i < g.bricks.length; i++) if (g.bricks[i].hp > 0) left++;
  if (!left) {
    g.level += 1;
    banner("第 " + g.level + " 关");
    brickSetup(g);
    syncHud();
  }
}

function drawBrick(g) {
  const ctx = g.ctx;
  ctx.clearRect(0, 0, g.W, g.H);
  ctx.fillStyle = "#221b17";
  ctx.fillRect(0, 0, g.W, g.H);
  const cols = ["#e2685a", "#e69a52", "#e8c25f", "#7fbf72", "#67b6c9", "#b48ad6"];
  for (let i = 0; i < g.bricks.length; i++) {
    const br = g.bricks[i];
    if (br.hp <= 0) continue;
    ctx.fillStyle = cols[br.row % cols.length];
    roundRect(ctx, br.x, br.y, br.w, br.h, 3 * g.dpr);
    ctx.fill();
  }
  const pad = g.pad;
  ctx.fillStyle = "#f6e7cf";
  roundRect(ctx, pad.x, g.H - pad.h - 6 * g.dpr, pad.w, pad.h, pad.h / 2);
  ctx.fill();
  if (g.ball) {
    ctx.beginPath();
    ctx.arc(g.ball.x, g.ball.y, g.ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "#fffdf7";
    ctx.fill();
  }
  if (g.ball && !g.ball.live) {
    ctx.fillStyle = "rgba(255,253,247,.72)";
    ctx.font = Math.round(13 * g.dpr) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("拖动挡板发球", g.W / 2, g.H * 0.55);
  }
}

/* ---------- 总入口 ---------- */
function gameInput(key) {
  const g = gameState;
  if (!g || g.over) return;
  if (g.kind === "g2048") {
    if (key === "left" || key === "right" || key === "up" || key === "down") move2048(g, key);
    return;
  }
  if (g.kind === "tetris") { tetInput(key); return; }
  if (g.kind === "brick") {
    if (key === "left") g.pad.x = Math.max(0, g.pad.x - 26 * g.dpr);
    else if (key === "right") g.pad.x = Math.min(g.W - g.pad.w, g.pad.x + 26 * g.dpr);
    else brickLaunch(g);
    drawBrick(g);
  }
}

function bindTouch() {
  const cv = document.getElementById && document.getElementById("game-canvas");
  if (!cv || !cv.addEventListener) return;
  function place(e) {
    const g = gameState;
    if (!g || g.kind !== "brick") return;
    const r = cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
    if (!r || !r.width) return;
    const x = (e.clientX - r.left) * (cv.width / r.width);
    g.pad.x = Math.max(0, Math.min(g.W - g.pad.w, x - g.pad.w / 2));
    if (!g.ball.live) brickLaunch(g);
  }
  cv.addEventListener("pointermove", place);
  cv.addEventListener("pointerdown", place);
}

function mountGame(kind) {
  stopGame();
  if (!kind || !GAME_META[kind]) kind = "g2048";
  if (typeof document === "undefined" || typeof document.getElementById !== "function") { gameState = null; return; }
  const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const g = { kind: kind, score: 0, level: 1, lines: 0, lives: 3, max: 2, won: false, over: false, dpr: dpr, acc: 0 };
  gameState = g;
  const ov = document.getElementById("game-over");
  if (ov) { ov.hidden = true; ov.innerHTML = ""; }
  const bn = document.getElementById("game-banner");
  if (bn) { bn.hidden = true; bn.classList.remove("on"); }
  if (kind === "g2048") {
    g.b = newBoard2048();
    addTile2048(g);
    addTile2048(g);
    syncHud();
    draw2048(g);
    return;
  }
  const cv = document.getElementById("game-canvas");
  if (!cv || typeof cv.getContext !== "function") { syncHud(); return; }
  const ctx = cv.getContext("2d");
  if (!ctx || !ctx.fillRect) { syncHud(); return; }
  g.cv = cv;
  g.ctx = ctx;
  if (kind === "tetris") {
    g.cell = 20 * dpr;
    cv.width = 10 * g.cell;
    cv.height = 20 * g.cell;
    g.grid = tetEmpty();
    g.dropMs = 800;
    tetSpawn(g);
  } else {
    cv.width = 300 * dpr;
    cv.height = 400 * dpr;
    brickSetup(g);
    bindTouch();
  }
  syncHud();
  g.last = nowMs();
  drawGame(g);
  g.raf = requestAnimationFrame(function (t) { gameTick(t); });
}

function drawGame(g) {
  if (g.kind === "tetris") drawTetris(g);
  else if (g.kind === "brick") drawBrick(g);
}

function gameTick(ts) {
  const g = gameState;
  if (!g || g.over) return;
  const dt = Math.min(60, ts - g.last);
  g.last = ts;
  if (g.kind === "tetris") {
    g.acc += dt;
    while (g.acc >= g.dropMs) {
      g.acc -= g.dropMs;
      tetStep(g);
      if (g.over) return;
    }
    drawTetris(g);
  } else if (g.kind === "brick") {
    brickUpdate(g, dt / 16.67);
    drawBrick(g);
  }
  if (!g.over && gameState === g) g.raf = requestAnimationFrame(function (t) { gameTick(t); });
}


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
  if (sh.type === "confirmdrop") {
    const c = (state.collections || []).find((x) => x.id === sh.fid);
    if (!c) return "";
    return "<div class='sheet-mask' data-sheet-mask><div class='sheet'>" +
      "<div class='sheet-head'><b>删除分类</b><span class='muted'>" + c.name + "</span></div>" +
      "<p class='sheet-note'>分类里的 " + c.dishes.length + " 道菜会一起删掉，菜品本身还在菜库里，随时能重新收藏。</p>" +
      "<div class='row-btns'><button class='btn' data-sheet-close>取消</button>" +
      "<button class='btn danger' data-drop-confirm='" + c.id + "'>删除</button></div>" +
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
  if (state.screen !== "game") stopGame();
  const v = $("#app");

  if (state.screen !== "game") stopGame();

  if (state.screen === "home") {
    v.innerHTML = "<div class='screen'>" +
      "<div class='hero-home'><span class='kicker'>今天吃什么</span>" +
      "<h1>别纠结了，<em>我帮你挑</em></h1>" +
      "<p class='sub'>回答几个问题，或者告诉我冰箱里有什么。</p></div>" +
      bigBtn("a", "🤔", "不知道吃什么", "问几个问题，按口味挑菜", "quiz") +
      bigBtn("b", "🥕", "家里有食材", "告诉我你有什么，我报菜名", "pantry") +
      bigBtn("c", "🔥", "今日推荐", "两组各 4 道，挑一组就走", "daily") +
      bigBtn("d", "📚", "学习指南", "从初级到大师，跟着视频练", "learn") +
      bigBtn("e", "🎯", "直接来一批", "不问条件，随便抽几道", "spin") +
      bigBtn("f", "🎮", "小游戏", "2048、俄罗斯方块、打砖块", "games") +
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
    const cur = DAILY.groups.find((g) => g.id === state.dailyGroup) || null;
    const picks = DAILY.groups.map((g) =>
      "<button class='daily-pick" + (cur && cur.id === g.id ? " on" : "") + "' data-daily='" + g.id + "'>" +
      "<span class='dp-t'>" + g.title + "</span><span class='dp-n'>" + g.items.length + " 道</span></button>").join("");
    let body = "";
    if (cur) {
      const items = cur.items.map((it) => ({ d: DISHES.find((x) => x.id === it[0]), why: it[1] })).filter((x) => x.d);
      body = "<div class='grid'>" + items.map((x, i) => card(x.d, i, x.why)).join("") + "</div>";
    }
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<div class='result-head'><h2>今日推荐</h2><span class='pill'>" + DAILY.updated + "</span></div></div>" +
      "<div class='daily-picks'>" + picks + "</div>" +
      (cur ? body : "<p class='daily-hint'>点一组，看这 " + DAILY.groups[0].items.length + " 道。</p>") +
      "</div>";
  }

  if (state.screen === "learn") {
    const lv = state.learnLevel || "初";
    const cur = LEARN.find((x) => x.lvl === lv) || LEARN[0];
    const topics = cur.topics.map((tp) =>
      "<div class='learn-topic'><div class='lt-title'>" + tp.t + "</div>" +
      "<div class='learn-list'>" + tp.items.map((it) =>
        "<a class='learn-item' href='" + (it.k === "视频" ? bili(it.q) : xcf(it.q)) + "' target='_blank' rel='noopener'>" +
        "<span class='lk'>" + it.k + "</span>" +
        "<span class='lt'><span class='t'>" + it.t + "</span><span class='d'>" + it.d + "</span></span>" +
        "<span class='arrow'>›</span></a>").join("") + "</div></div>").join("");
    const practice = (cur.practice || []).map((id) => {
      const d = DISHES.find((x) => x.id === id);
      return d ? "<button class='chipbtn' data-id='" + d.id + "'>" + d.name + "</button>" : "";
    }).join("");
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>学习指南</h2></div>" +
      "<div class='lvltabs'>" + LEARN.map((x) =>
        "<button class='chipbtn" + (x.lvl === lv ? " sel" : "") + "' data-lvl='" + x.lvl + "'>" + x.name + "</button>").join("") +
      "</div>" +
      "<p class='sub' style='margin:2px 0 16px'>" + cur.desc + "</p>" +
      topics +
      (practice ? "<div class='group-title'>练手菜</div><div class='near'>" + practice + "</div>" : "") +
      "<p class='foot-note'>教程在站外打开，不占安装包体积。</p>" +
      "</div>";
  }

  if (state.screen === "games") {
    const cards = GAME_KINDS.map(function (k) {
      const m = GAME_META[k];
      const best = MINI.best[k] ? "最高 " + MINI.best[k] + " 分" : "还没玩过";
      return "<button class='game-card' data-game='" + k + "'>" +
        "<span class='gc-ico'>" + m.ico + "</span>" +
        "<span class='gc-body'><span class='gc-t'>" + m.t + "</span>" +
        "<span class='gc-d'>" + m.d + "</span>" +
        "<span class='gc-best'>" + best + "</span></span>" +
        "<span class='arrow'>›</span></button>";
    }).join("");
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>小游戏</h2></div>" +
      "<div class='hub-pts'><span>累计得分</span><b>" + MINI.total + "</b></div>" +
      "<div class='game-list'>" + cards + "</div>" +
      "<p class='foot-note'>分数只留在这台设备上。</p>" +
      "</div>";
  }

  if (state.screen === "game") {
    const kind = (state.game && state.game.kind) || "g2048";
    const meta = GAME_META[kind] || GAME_META.g2048;
    const dirPad = "<div class='dpad'>" +
      "<button class='dbtn up' data-game-key='up' aria-label='上'>▲</button>" +
      "<button class='dbtn left' data-game-key='left' aria-label='左'>◀</button>" +
      "<button class='dbtn down' data-game-key='down' aria-label='下'>▼</button>" +
      "<button class='dbtn right' data-game-key='right' aria-label='右'>▶</button></div>";
    const tetPad = "<div class='tpad'>" +
      "<button class='tbtn' data-tet='left' aria-label='左移'>◀</button>" +
      "<button class='tbtn' data-tet='rot' aria-label='旋转'>↻</button>" +
      "<button class='tbtn' data-tet='right' aria-label='右移'>▶</button>" +
      "<button class='tbtn wide' data-tet='down'>▼ 下落</button>" +
      "<button class='tbtn wide' data-tet='drop'>⤓ 到底</button></div>";
    const bPad = "<div class='dpad two'>" +
      "<button class='dbtn' data-game-key='left' aria-label='左'>◀</button>" +
      "<button class='dbtn' data-game-key='right' aria-label='右'>▶</button></div>";
    let body;
    let tip;
    if (kind === "g2048") {
      body = "<div class='g2048' id='g2048'></div>" + dirPad;
      tip = "方向键、按钮或滑动屏幕都能合。";
    } else {
      body = "<div class='game-wrap'><canvas id='game-canvas'></canvas></div>" + (kind === "tetris" ? tetPad : bPad);
      tip = kind === "tetris" ? "◀ ▶ 移动，↻ 旋转，⤓ 直接落到底。" : "拖动挡板接球，球掉到底就少一条命。";
    }
    v.innerHTML = "<div class='screen game-screen gk-" + kind + "'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>" + meta.t + "</h2>" +
      "<span class='pill'><b id='game-score'>0</b> 分</span></div>" +
      "<div class='game-hud' id='game-hud'></div>" +
      body +
      "<div class='game-banner' id='game-banner' hidden></div>" +
      "<div class='game-over' id='game-over' hidden></div>" +
      "<p class='game-tip'>" + tip + "</p>" +
      "</div>";
    mountGame(kind);
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
  const t = e.target.closest("[data-go],[data-ans],[data-id],[data-add],[data-dislike],[data-soft],[data-save],[data-star],[data-eat],[data-copy],[data-photo],[data-folder],[data-rename],[data-drop],[data-newfolder],[data-folder-save],[data-folder-remove],[data-drop-confirm],[data-lvl],[data-daily],[data-game],[data-game-key],[data-game-retry],[data-tet]");
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
  if (t.dataset.dropConfirm) {
    const id = t.dataset.dropConfirm;
    dropFolder(id);
    state.sheet = null;
    if (state.screen === "folder") { state.screen = "saved"; state.folder = null; }
    toast("分类已删除");
    return render();
  }
  if (t.dataset.folderRemove) return askDropFolder(t.dataset.folderRemove);
  if (t.dataset.lvl) { state.learnLevel = t.dataset.lvl; return render(); }
  if (t.dataset.daily) { state.dailyGroup = t.dataset.daily; return render(); }
  if (t.dataset.tet) { tetInput(t.dataset.tet); return; }
  if (t.dataset.game) {
    pushNav();
    state.game = { kind: t.dataset.game };
    state.screen = "game";
    return render();
  }
  if (t.dataset.gameRetry) { mountGame(t.dataset.gameRetry); return; }
  if (t.dataset.gameKey) { gameDir(t.dataset.gameKey); return; }
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
  else if (go === "games") { state.screen = "games"; }
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
document.addEventListener("keydown", (e) => {
  if (!gameState || state.screen !== "game" || gameState.over) return;
  const arrow = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key];
  if (gameState.kind === "tetris") {
    if (e.key === " ") { tetInput("drop"); e.preventDefault(); return; }
    if (e.key === "ArrowUp") { tetInput("rot"); e.preventDefault(); return; }
    if (arrow) { tetInput(arrow); e.preventDefault(); }
    return;
  }
  if (arrow) { gameInput(arrow); e.preventDefault(); }
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
