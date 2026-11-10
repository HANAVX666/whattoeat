const $ = (s, r = document) => r.querySelector(s);
const SEARCH = {
  img: (n) => "https://cn.bing.com/images/search?q=" + encodeURIComponent(n + " 成品"),
  recipes: (n) => "https://www.xiachufang.com/search/?keyword=" + encodeURIComponent(n),
  video: (n) => "https://search.bilibili.com/all?keyword=" + encodeURIComponent(n + " 做法")
};

let DISHES = [];
let PHOTOS = {};
let THUMBS = new Set();
const state = { screen: "home", answers: {}, soft: new Set(), qi: 0, shown: new Set(), disliked: new Set(), saved: new Set(), eaten: [], batch: [], reasons: new Map(), refresh: 0, pantryText: "" };

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

function card(d, i) {
  const why = ((state.reasons && state.reasons.get(d.id)) || [])[0];
  const on = state.saved.has(d.id);
  return "<div class='dish' data-id='" + d.id + "' style='--i:" + (i || 0) + "'>" +
    "<button class='star" + (on ? " on" : "") + "' data-save='" + d.id + "' aria-label='收藏'>" + (on ? "★" : "☆") + "</button>" +
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

function render() {
  const v = $("#app");

  if (state.screen === "home") {
    v.innerHTML = "<div class='screen'>" +
      "<div class='hero-home'><span class='kicker'>今天吃什么</span>" +
      "<h1>别纠结了，<em>我帮你挑</em></h1>" +
      "<p class='sub'>回答几个问题，或者告诉我冰箱里有什么。</p></div>" +
      bigBtn("a", "🤔", "不知道吃什么", "问几个问题，按口味挑菜", "quiz") +
      bigBtn("b", "🥕", "家里有食材", "告诉我你有什么，我报菜名", "pantry") +
      bigBtn("c", "🎯", "直接来一批", "不问条件，随便抽几道", "spin") +
      recentStrip() +
      (state.saved.size ? "<button class='home-link' data-go='saved'>★ 我的收藏<span>" + state.saved.size + " 道</span>›</button>" : "") +
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
    const list = [...state.saved].map((id) => DISHES.find((d) => d.id === id)).filter(Boolean);
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='home' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>我的收藏</h2><span class='pill'>" + list.length + " 道</span></div>" +
      (list.length
        ? "<p class='result-sub'>都在这里了，点一下看做法，星星点掉就从收藏里去掉。</p><div class='grid'>" + list.map((d, i) => card(d, i)).join("") + "</div>"
        : "<div class='empty'><span class='big-emoji'>⭐</span>还没有收藏。<br>看到想吃的，点卡片右上角的星星。</div>") +
      "</div>";
  }

  if (state.screen === "detail") {
    const d = DISHES.find((x) => x.id === state.current);
    const no = state.disliked.has(d.id);
    const sv = state.saved.has(d.id);
    const ate = daysSinceEaten(d.id) < 1;
    const ph = (PHOTOS[d.id] || [])[0];
    const hero = "<div class='hero' style='background:" + tint(d) + "'>" +
      "<span>" + emojiOf(d) + "</span>" +
      (ph ? "<img class='cover' src='" + ph.u + "' alt='" + d.name + " 实物图'>" : "") +
      "<button class='photo' data-photo='" + d.id + "'>" + (ph ? "📷 更多图片" : "🔍 网上搜图") + "</button></div>";
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<span class='pill'>" + d.region + "菜</span><span class='pill'>大众度 " + d.popularity + "</span>" +
      "<span style='flex:1'></span>" +
      "<button class='icon-btn' data-share='" + d.id + "' aria-label='分享'>↗</button></div>" +
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
      "<button class='btn" + (ate ? " done" : "") + "' data-eat='" + d.id + "'" + (ate ? " disabled" : "") + ">" +
      (ate ? "✓ 今天吃过了" : "🍽 吃过了") + "</button></div>" +
      "<button class='dislike" + (no ? " on" : "") + "' data-dislike='" + d.id + "'>" + (no ? "✓ 已标记不想吃，不会再推" : "🙅 以后别再推这道") + "</button>" +
      nearHtml(d) +
      "<div class='sticky'><div class='inner'>" +
      "<a class='btn' href='" + SEARCH.recipes(d.name) + "' target='_blank' rel='noopener'>📖 找菜谱</a>" +
      "<a class='btn primary' href='" + SEARCH.video(d.name) + "' target='_blank' rel='noopener'>▶ 看视频</a>" +
      "</div></div></div>";
  }
  window.scrollTo(0, 0);
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

function openPhoto(id, i) {
  const d = DISHES.find((x) => x.id === id);
  const list = photoList(id);
  if (!d || !list.length) return;
  lbState = { id: id, i: ((i || 0) % list.length + list.length) % list.length };
  let box = $("#lightbox");
  if (!box) { box = document.createElement("div"); box.id = "lightbox"; box.className = "lightbox"; document.body.appendChild(box); }
  box.innerHTML = "<div class='lb-card'>" +
    "<div class='lb-img'><img src='" + list[lbState.i] + "' alt='" + d.name + "'></div>" +
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
  const wb = e.target.closest("[data-wheel-spin],[data-wheel-go],[data-wheel-close]");
  if (wb && (wb.dataset.wheelSpin !== undefined || wb.dataset.wheelGo !== undefined || wb.dataset.wheelClose !== undefined)) {
    if (wb.dataset.wheelSpin !== undefined) { wheelSpin(); return; }
    if (wb.dataset.wheelClose !== undefined) { closeWheel(); return; }
    if (wb.dataset.wheelGo !== undefined) {
      if (wheelState.spinning) return;
      const d = wheelState.winner;
      closeWheel();
      if (!d) return;
      state.current = d.id; state.from = state.screen; state.screen = "detail";
      return render();
    }
  }
  if (e.target.id === "lightbox") { closePhoto(); return; }
  const lb = e.target.closest("[data-lb-close],[data-lb-next]");
  if (lb && lb.dataset && (lb.dataset.lbClose !== undefined || lb.dataset.lbNext !== undefined)) {
    if (lb.dataset.lbClose !== undefined) closePhoto();
    else openPhoto(lbState.id, lbState.i + 1);
    return;
  }
  const t = e.target.closest("[data-go],[data-ans],[data-id],[data-add],[data-dislike],[data-soft],[data-save],[data-eat],[data-share],[data-photo]");
  if (!t) return;
  if (t.dataset.photo) {
    const id = t.dataset.photo;
    if (photoList(id).length) openPhoto(id, 0);
    else { const d = DISHES.find((x) => x.id === id); window.open(SEARCH.img(d ? d.name : ""), "_blank"); }
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
  if (t.dataset.save) {
    const id = t.dataset.save;
    const on = !state.saved.has(id);
    if (on) state.saved.add(id); else state.saved.delete(id);
    localStorage.setItem("saved", JSON.stringify([...state.saved]));
    // 同一道菜的星星可能同时出现在卡片和详情页，全同步，不整页重刷
    document.querySelectorAll("[data-save='" + id + "']").forEach((el) => {
      if (el.classList.contains("star")) { el.classList.toggle("on", on); el.textContent = on ? "★" : "☆"; }
      else { el.classList.toggle("primary", on); el.textContent = on ? "★ 已收藏" : "☆ 收藏"; }
    });
    if (state.screen === "saved") return render();   // 在收藏页取消，卡片要消失
    return;
  }
  if (t.dataset.eat) {
    markEaten(t.dataset.eat);
    t.textContent = "✓ 今天吃过了";
    t.classList.add("done");
    t.disabled = true;
    return;
  }
  if (t.dataset.share) {
    const d = DISHES.find((x) => x.id === state.current);
    const url = location.origin + location.pathname + "#" + d.id;
    if (navigator.share) { navigator.share({ title: d.name, text: "今天吃「" + d.name + "」，做法：" }).catch(() => {}); return; }
    const text = "今天吃「" + d.name + "」，做法：" + url;
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => { t.textContent = "✓"; }).catch(() => {}); return; }
    t.textContent = "✓";
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
    state.current = t.dataset.id;
    state.from = state.screen;
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
  const go = t.dataset.go;
  if (go === "saved") { state.screen = "saved"; return render(); }
  if (go === "home") { state.screen = "home"; state.qi = 0; state.answers = {}; state.soft = new Set(); }
  else if (go === "quiz") { state.screen = "quiz"; state.qi = 0; state.answers = {}; state.soft = new Set(); }
  else if (go === "soft") { state.screen = "soft"; }
  else if (go === "result") { state.screen = "result"; pick(true); }
  else if (go === "refresh") { state.screen = "result"; pick(false); }
  else if (go === "spin") { state.answers = {}; state.soft = new Set(); state.shown = new Set(); state.screen = "result"; pick(true); }
  else if (go === "one") { openWheel(); return; }
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
    try { PHOTOS = await (await fetch("./data/photos.json")).json(); } catch (e) { PHOTOS = {}; }
    try { THUMBS = new Set(await (await fetch("./data/thumbs.json")).json()); } catch (e) { THUMBS = new Set(); }
  } catch (err) {
    $("#app").innerHTML = "<div class='empty'>菜谱库加载失败。<br>请用本地服务器打开。</div>";
    return;
  }
  try { state.disliked = new Set(JSON.parse(localStorage.getItem("disliked") || "[]")); } catch (e) {}
  try { state.saved = new Set(JSON.parse(localStorage.getItem("saved") || "[]")); } catch (e) {}
  try { state.eaten = JSON.parse(localStorage.getItem("eaten") || "[]") || []; } catch (e) { state.eaten = []; }
  const hash = (typeof window !== "undefined" && window.location && window.location.hash) || "";
  const deep = hash.replace("#", "").trim();
  if (deep && DISHES.some((d) => d.id === deep)) { state.current = deep; state.from = "home"; state.screen = "detail"; }
  render();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
