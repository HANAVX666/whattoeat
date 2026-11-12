const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 深浅色：auto 跟随系统，手动选择记在本机 ---------- */
const THEME_KEY = "theme";
function themeResolved() {
  if (state.theme === "light" || state.theme === "dark") return state.theme;
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch (e) { return "light"; }
}
function applyTheme() {
  const r = themeResolved();
  try {
    const d = document.documentElement;
    d.dataset.theme = r;
    d.style.colorScheme = r;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", r === "dark" ? "#14100d" : "#fbf8f3");
  } catch (e) {}
  return r;
}
function setTheme(t) {
  state.theme = t === "light" || t === "dark" ? t : "auto";
  try { localStorage.setItem(THEME_KEY, state.theme); } catch (e) {}
  applyTheme();
  render();
}
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
const state = { screen: "home", theme: "auto", answers: {}, soft: new Set(), qi: 0, shown: new Set(), disliked: new Set(), saved: new Set(), eaten: [], batch: [], reasons: new Map(), refresh: 0, pantryText: "", collections: [], stack: [], folder: null, sheet: null, learnLevel: "初", current: null, dailyGroup: null, query: "", stepsMiss: new Set(), exhausted: false, poolN: 0, remaining: 0 };

const QUESTIONS = [
  { id: "src", q: "今天自己做，还是点外卖？", opts: [["自己动手做", "cook"], ["点外卖 / 出去吃", "out"], ["都行", "any"]] },
  { id: "meal", q: "这是今天的哪一顿？", opts: [["早饭", "breakfast"], ["午饭", "lunch"], ["晚饭", "dinner"], ["宵夜", "night"], ["都行", "any"]] },
  { id: "people", q: "几个人吃？", opts: [["一个人吃", "1"], ["家里一起吃", "family"], ["有客人来", "party"], ["都行", "any"]] },
  { id: "route", q: "想吃哪个路子的菜？", opts: [["家常菜就行", "家常"], ["川湘：香辣下饭", "川湘"], ["粤闽：鲜甜本味", "粤闽"], ["江浙：清淡鲜嫩", "江浙"], ["西北：面食扎实", "西北"], ["都行", "any"]] },
  { id: "diet", q: "想吃荤的还是素的？", opts: [["想吃肉", "荤"], ["想吃素", "素"], ["都行，不挑", "any"]] },
  { id: "taste", q: "口味想清淡点还是够味？", opts: [["清淡一点", "清淡"], ["家常就行", "适中"], ["要够味", "重口"], ["都行", "any"]] },
  { id: "spicy", q: "吃辣吗？", opts: [["不吃辣", "0"], ["能吃点辣", "2"], ["越辣越好", "4"], ["都行", "any"]] },
  { id: "temp", q: "想吃热乎的，还是凉快的？", opts: [["热乎的，最好带汤", "hot"], ["凉快的，爽口解腻", "cold"], ["都行", "any"]] },
  { id: "novelty", q: "想吃常吃的，还是换换口味？", opts: [["就吃熟悉的", "familiar"], ["来点没试过的", "novel"], ["都行", "any"]] },
  { id: "form", q: "想吃哪一类？", opts: [["炒菜炖菜，配米饭", "菜"], ["汤和羹", "汤羹"], ["面、饭、饺子这类", "主食"], ["凉菜、小吃、卤味", "小吃"], ["都行", "any"]] },
  { id: "time", q: "能花多少时间？", when: (a) => a.src !== "out", opts: [["十分钟内", "10"], ["半小时左右", "30"], ["不着急", "999"], ["都行", "any"]] },
  { id: "budget", q: "想省着点，还是吃好点？", opts: [["越便宜越好", "cheap"], ["差不多就行", "any"], ["想吃好点", "good"]] },
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
  { label: "想吃炒的", kind: "method", v: "炒" },
  { label: "想吃炖的", kind: "method", v: "炖煮" },
  { label: "想吃蒸的", kind: "method", v: "蒸" },
  { label: "想吃炸的", kind: "method", v: "炸" },
  { label: "想吃煎烤的", kind: "method", v: "煎烤" },
  { label: "想吃面饭", kind: "form", v: "主食" },
  { label: "想吃炒菜", kind: "form", v: "菜" },
  { label: "想吃凉菜小吃", kind: "form", v: "小吃" },
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
  { label: "不吃豆制品", kind: "avoid", v: "豆制品" },
  { label: "不吃鱼", kind: "avoid", v: "鱼" },
  { label: "不吃牛肉", kind: "avoid", v: "牛肉" },
  { label: "不吃羊肉", kind: "avoid", v: "羊肉" },
  { label: "不吃面食", kind: "avoid", v: "面食" },
  { label: "不吃米饭", kind: "avoid", v: "米饭" },
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
  "豆制品": ["豆腐", "豆干", "香干", "腐竹", "豆皮", "豆花", "烤麸", "面筋"],
  "鱼": ["鱼"],
  "牛肉": ["牛"],
  "羊肉": ["羊"],
  "面食": ["面", "粉", "米线", "河粉", "凉皮", "年糕", "馍", "馕", "吐司", "面包"],
  "米饭": ["米饭", "大米"]
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
    else if (kind === "method" && d.method === v) { s += 16; softHit++; why.push(v === "凉拌" ? "凉拌爽口" : "是" + v + "的"); }
    else if (kind === "form" && d.form === v) { s += 14; softHit++; why.push(SOFT_MAP[k] || v); }
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

function searchHits(q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return [];
  const out = [];
  for (const d of DISHES) {
    let sc = 0;
    const nm = d.name.toLowerCase();
    if (nm === s) sc = 100;
    else if (nm.startsWith(s)) sc = 80;
    else if (nm.includes(s)) sc = 60;
    else if ((d.aliases || []).some((a) => a.toLowerCase().includes(s))) sc = 45;
    else if (d.mainIngredients.some((x) => x.includes(s))) sc = 30;
    else if ((d.tags || []).some((t) => t.includes(s))) sc = 15;
    if (sc) out.push([d, sc + d.popularity]);
  }
  return out.sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 60);
}

function hitsHtml(q) {
  const s = String(q || "").trim();
  if (!s) {
    const quick = topIngredients(12);
    return "<div class='group-title'>常见食材</div><div class='chips'>" +
      quick.map((x) => "<button class='chipbtn' data-fillq='" + esc(x) + "'>" + esc(x) + "</button>").join("") + "</div>" +
      "<p class='foot-note'>菜库 " + DISHES.length + " 道，输入一个字就开始筛。</p>";
  }
  const hits = searchHits(s);
  if (!hits.length) return "<div class='empty'><span class='big-emoji'>🔍</span>没找到「" + esc(s) + "」。<br>换个说法，或者只输入一个字试试。</div>";
  return "<div class='grid'>" + hits.map((d, i) => card(d, i)).join("") + "</div>";
}

function pick(reset) {
  let pool = hardPool(state.answers);
  if (state.answers.food && state.answers.food.length) {
    const hit = pool.filter((d) => d.mainIngredients.some((x) => state.answers.food.includes(x)));
    if (hit.length) pool = hit;
  }
  if (reset) { state.shown = new Set(); state.refresh = 0; }
  state.poolN = pool.length;
  if (!pool.length) { state.batch = []; state.reasons = new Map(); state.exhausted = false; state.remaining = 0; return; }

  const rest = pool.filter((d) => !state.shown.has(d.id));
  if (!rest.length) { state.batch = []; state.reasons = new Map(); state.exhausted = true; state.remaining = 0; return; }
  state.exhausted = false;
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
  state.remaining = pool.filter((d) => !state.shown.has(d.id)).length;
}

function condList() {
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
  if (a.budget === "cheap") c.push("想省点");
  if (a.budget === "good") c.push("吃好点");
  if (a.equip === "oven") c.push("有烤箱");
  if (a.equip === "basic") c.push("一口锅");
  for (const k of state.soft || []) c.push(SOFT_MAP[k] || k.slice(k.indexOf(":") + 1));
  return c.filter(Boolean);
}

function condChips() {
  const c = condList();
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
function clearHash() {
  try {
    if (typeof history !== "undefined" && history.replaceState && window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  } catch (e) {}
}

function navBack() {
  clearHash();
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

function recipeText(d) {
  return "「" + d.name + "」做法（" + d.timeMin + " 分钟 · " + d.method + "）\n" +
    (d.steps || []).map((s, i) => (i + 1) + ". " + s).join("\n") +
    (d.tips ? "\n💡 " + d.tips : "") + "\n—— 来自「今天吃什么」";
}

function doCopy(text) {
  const fallback = () => { state.sheet = { type: "copy", text }; render(); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast("已复制，去粘贴给朋友"), fallback);
      return;
    }
  } catch (e) {}
  fallback();
}

function copyText(id) {
  const d = DISHES.find((x) => x.id === id);
  if (!d) return;
  if (!d.steps) {
    ensureSteps(d).then(() => { if (d.steps) doCopy(recipeText(d)); else toast("做法还没加载出来，稍后再试"); });
    return;
  }
  doCopy(recipeText(d));
}

/* ---------- 今日推荐（按当天从菜库里算，不写死） ---------- */
const SEASON = {
  1: ["白萝卜", "大白菜", "白菜", "萝卜", "羊肉", "酸菜", "红薯", "红枣", "桂圆", "冬笋", "栗子", "牛肉"],
  2: ["白萝卜", "大白菜", "白菜", "萝卜", "羊肉", "酸菜", "红薯", "红枣", "冬笋", "春笋", "韭菜"],
  3: ["韭菜", "春笋", "荠菜", "豌豆", "菠菜", "香椿", "豆芽", "蒜苗", "莴笋", "芹菜"],
  4: ["韭菜", "春笋", "荠菜", "豌豆", "菠菜", "香椿", "豆芽", "蒜苗", "莴笋", "芹菜"],
  5: ["韭菜", "春笋", "荠菜", "豌豆", "菠菜", "香椿", "豆芽", "蒜苗", "莴笋", "黄瓜", "蚕豆"],
  6: ["黄瓜", "冬瓜", "丝瓜", "苦瓜", "茄子", "番茄", "毛豆", "莲藕", "绿豆", "豆角", "空心菜"],
  7: ["黄瓜", "冬瓜", "丝瓜", "苦瓜", "茄子", "番茄", "毛豆", "莲藕", "绿豆", "豆角", "空心菜"],
  8: ["黄瓜", "冬瓜", "丝瓜", "苦瓜", "茄子", "番茄", "毛豆", "莲藕", "绿豆", "豆角", "空心菜", "南瓜"],
  9: ["南瓜", "莲藕", "山药", "板栗", "栗子", "芋头", "芋艿", "白萝卜", "大白菜", "白菜", "萝卜", "银耳", "螃蟹", "红薯", "玉米"],
  10: ["南瓜", "莲藕", "山药", "板栗", "栗子", "芋头", "芋艿", "白萝卜", "大白菜", "白菜", "萝卜", "银耳", "螃蟹", "红薯", "玉米"],
  11: ["南瓜", "莲藕", "山药", "板栗", "栗子", "芋头", "芋艿", "白萝卜", "大白菜", "白菜", "萝卜", "银耳", "螃蟹", "红薯", "冬笋", "玉米"],
  12: ["白萝卜", "大白菜", "白菜", "萝卜", "羊肉", "酸菜", "红薯", "红枣", "桂圆", "冬笋", "栗子", "牛肉"]
};
const monthOf = () => { try { return new Date().getMonth() + 1; } catch (e) { return 11; } };
const dayKey = () => {
  try { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  catch (e) { return "2025-1-1"; }
};
function seedNum(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seasonScore(d, m) {
  const words = SEASON[m] || [];
  const ing = d.mainIngredients || [];
  const name = d.name || "";
  let total = 0;
  for (const w of words) {
    if (name.includes(w)) total += 3;
    else {
      const idx = ing.indexOf(w);
      if (idx === 0) total += 3;
      else if (idx > 0) total += idx < 3 ? 2 : 1;
    }
  }
  return total;
}
function seasonHit(d, m) {
  const words = SEASON[m] || [];
  const ing = d.mainIngredients || [];
  const name = d.name || "";
  let best = "", bestScore = 0;
  for (const w of words) {
    let sc = 0;
    if (name.includes(w)) sc = 3;
    else {
      const idx = ing.indexOf(w);
      if (idx === 0) sc = 3;
      else if (idx > 0) sc = idx < 3 ? 2 : 1;
    }
    if (sc > bestScore) { bestScore = sc; best = w; }
  }
  return best;
}
function whySeason(d, m) {
  const hit = seasonHit(d, m);
  const bits = [];
  if (hit) bits.push(hit + "正当时");
  if (d.timeMin <= 15) bits.push("十几分钟上桌");
  else if (d.timeMin <= 30) bits.push("半小时内能好");
  if (bits.length < 2) {
    if (d.diet === "素") bits.push("清爽不腻");
    else if (d.spicy >= 3) bits.push("够味下饭");
    else if (d.form === "汤羹") bits.push("连汤带水，暖胃");
    else bits.push("好上手，不容易翻车");
  }
  return bits.slice(0, 2).join("，");
}
function whyLight(d) {
  const bits = [d.form === "汤羹" ? "汤水为主，少油" : "素的，清爽"];
  bits.push(d.spicy === 0 ? "不辣，胃里舒服" : "微辣不刺激");
  return bits.slice(0, 2).join("，");
}
function seededTop(list, n, seed, skip) {
  const pool = skip ? list.filter((d) => !skip.has(d.id)) : list;
  return pool.map((d) => ({ d, k: seedNum(seed + "|" + d.id) }))
    .sort((x, y) => x.k - y.k).slice(0, n).map((x) => x.d);
}
let DAILY_CACHE = null;
function buildDaily() {
  const m = monthOf();
  const seed = dayKey();
  const hotCand = DISHES
    .filter((d) => seasonScore(d, m) > 0 && d.popularity >= 3.5 && d.timeMin <= 50)
    .sort((x, y) => (seasonScore(y, m) * 0.6 + y.popularity) - (seasonScore(x, m) * 0.6 + x.popularity))
    .slice(0, 60);
  const lightCand = DISHES
    .filter((d) => (d.form === "汤羹" || d.diet === "素") && d.spicy <= 1 && d.timeMin <= 45 && d.popularity >= 3)
    .sort((x, y) => y.popularity - x.popularity)
    .slice(0, 60);
  const hot = seededTop(hotCand, 4, seed + "|hot");
  const light = seededTop(lightCand, 4, seed + "|light", new Set(hot.map((d) => d.id)));
  return {
    seed,
    groups: [
      { id: "hot", title: "这个月正当时", items: hot.map((d) => [d.id, whySeason(d, m)]) },
      { id: "light", title: "清爽养胃", items: light.map((d) => [d.id, whyLight(d)]) }
    ]
  };
}
function getDaily() {
  const key = dayKey();
  if (!DAILY_CACHE || DAILY_CACHE.seed !== key) DAILY_CACHE = buildDaily();
  return DAILY_CACHE;
}

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
  const v = $("#app");

  if (state.screen === "home") {
    v.innerHTML = "<div class='screen'>" +
      "<div class='hero-home'><span class='kicker'>今天吃什么</span>" +
      "<button class='theme-btn' data-theme-cycle aria-label='切换深浅色' title='" + (themeResolved() === "dark" ? "切到浅色" : "切到深色") + "'>" + (themeResolved() === "dark" ? "☀️" : "🌙") + "</button>" +
      "<h1>别纠结了，<em>我帮你挑</em></h1></div>" +
      "<button class='home-search' data-go='search'><span class='hs-ico'>🔍</span>" +
      "<span class='hs-t'>搜菜名、食材</span><span class='hs-n'>" + DISHES.length + " 道</span><span class='hs-a'>›</span></button>" +
      bigBtn("a", "🤔", "不知道吃什么", "问几个问题，按口味挑菜", "quiz") +
      bigBtn("b", "🥕", "家里有食材", "告诉我你有什么，我报菜名", "pantry") +
      bigBtn("c", "🔥", "今日推荐", "两组各 4 道，挑一组就走", "daily") +
      bigBtn("d", "📚", "学习指南", "从初级到大师，跟着视频练", "learn") +
      bigBtn("e", "🎯", "直接来一批", "不问条件，随便抽几道", "spin") +
      recentStrip() +
      "<button class='home-link' data-go='saved'>★ 我的收藏<span>" + state.saved.size + " 道</span>›</button>" +
      "<button class='home-link' data-go='profile'>⚙ 口味档案<span>不想吃 " + state.disliked.size + " · 吃过 " + (state.eaten || []).length + "</span>›</button>" +
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
      ["今天就想吃", SOFT.filter((o) => o.kind === "tag" || o.kind === "method" || o.kind === "form")],
      ["想吃到的主料", SOFT.filter((o) => o.kind === "ing")],
      ["这些别放", SOFT.filter((o) => o.kind === "avoid")]
    ];
    const picked = (state.soft || new Set()).size;
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='quiz' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>还有什么讲究？</h2><span class='pill' id='softcount'>已选 " + picked + "</span></div>" +
      "<p class='sub' style='margin:-10px 0 18px'>可以多选，也可以一个都不选。「这些别放」会真的把带它的菜去掉，其余只影响排序。</p>" +
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
      const body = state.exhausted
        ? "<div class='empty'><span class='big-emoji'>🍽</span>符合条件的 " + state.poolN + " 道都看过了。<br>换一下条件，或者从头再看一遍。</div>" +
          "<button class='btn block' data-go='quiz'>改一下答案</button>" +
          "<button class='btn block' data-go='restartBatch'>从头再看一遍</button>"
        : "<div class='empty'><span class='big-emoji'>🥲</span>筛得太狠了，一道都不剩。<br>回去放宽一个条件试试。</div>" +
          "<button class='btn block' data-go='quiz'>改一下答案</button>";
      v.innerHTML = "<div class='screen'><div class='topbar'><button class='back' data-go='home'>‹</button></div>" + body + "</div>";
    } else {
      const tag = state.refresh > 1 ? "第 " + state.refresh + " 批" : "按条件排的";
      const conds = condList();
      const sub = conds.length
        ? "按上面 " + conds.length + " 个条件排序，勾得越准越贴。不满意就换一批——越往后越冷门。"
        : "没加条件，按大众度挑的。不满意就换一批——越往后越冷门。";
      const left = state.remaining || 0;
      const foot = (left > 0 ? "还有 " + left + " 道没看过" : "这批之后没有新的了，再点刷新会从头开始") + " · 点过「不想吃」的不会再出现";
      v.innerHTML = "<div class='screen'>" +
        "<div class='topbar'><button class='back' data-go='quiz' aria-label='改答案'>‹</button>" +
        "<div class='result-head'><h2>" + (MEAL_TITLE[state.answers.meal] || "今天可以吃这些") + "</h2><span class='pill'>" + tag + "</span></div></div>" +
        condChips() +
        "<p class='result-sub'>" + sub + "</p>" +
        "<div class='grid'>" + state.batch.map((d, i) => card(d, i)).join("") + "</div>" +
        "<p class='foot-note'>" + foot + "</p>" +
        "<div class='sticky'><div class='inner'>" +
        "<button class='btn' data-go='one'>🎡 转盘定一个</button>" +
        "<button class='btn primary' data-go='refresh'>🎲 刷新换一批</button>" +
        "</div></div></div>";
    }
  }

  if (state.screen === "search") {
    const q = state.query || "";
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>搜索</h2><span class='pill' id='hitcount'>" +
      (q.trim() ? searchHits(q).length + " 道" : "菜名 / 食材") + "</span></div>" +
      "<div class='search-box'><input id='searchq' type='search' enterkeyhint='search' placeholder='搜菜名、别名或食材，比如 番茄、牛腩' value='" + esc(q) + "'></div>" +
      "<div id='hitwrap'>" + hitsHtml(q) + "</div>" +
      "</div>";
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
      const body = state.exhausted
        ? "<div class='empty'><span class='big-emoji'>🍳</span>用这些食材的 " + state.poolN + " 道都看过了。<br>换几样食材，或者从头再看一遍。</div>" +
          "<button class='btn block' data-go='pantry'>改一下食材</button>" +
          "<button class='btn block' data-go='restartBatch'>从头再看一遍</button>"
        : "<div class='empty'><span class='big-emoji'>🍳</span>库里暂时没有用这些食材的菜。<br>试试少写两样，或者换一个。</div>" +
          "<button class='btn block' data-go='pantry'>改一下食材</button>";
      v.innerHTML = "<div class='screen'><div class='topbar'><button class='back' data-go='pantry'>‹</button></div>" + body + "</div>";
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

  if (state.screen === "profile") {
    const dis = [...state.disliked].map((id) => DISHES.find((d) => d.id === id)).filter(Boolean);
    const ate = (state.eaten || []).map((e) => ({ d: DISHES.find((d) => d.id === e.id), ts: e.ts })).filter((x) => x.d);
    const dayStr = (ts) => {
      const n = Math.floor((Date.now() - ts) / 86400000);
      return n <= 0 ? "今天" : n === 1 ? "昨天" : n + " 天前";
    };
    const row = (d, sub, action, attr) =>
      "<div class='folder-row'><div class='folder-open static'><span class='fname'>" + d.name + "</span>" +
      "<span class='fsub'>" + sub + "</span></div>" +
      "<button class='fedit' " + attr + "='" + d.id + "'>" + action + "</button></div>";
    const disRows = dis.map((d) => row(d, d.region + "菜 · " + d.timeMin + " 分钟", "恢复", "data-undislike")).join("");
    const ateRows = ate.map((x) => row(x.d, dayStr(x.ts) + " 吃过", "清除", "data-uneat")).join("");
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<h2 style='flex:1;font-size:19px'>口味档案</h2></div>" +
      "<div class='group-title'>不想吃<span class='n'>" + dis.length + "</span></div>" +
      (dis.length ? "<div class='folders'>" + disRows + "</div>" : "<p class='daily-hint'>还没有排除任何菜。</p>") +
      "<div class='group-title' style='margin-top:26px'>最近吃过<span class='n'>" + ate.length + "</span></div>" +
      (ate.length ? "<div class='folders'>" + ateRows + "</div>" : "<p class='daily-hint'>还没记录过。</p>") +
      "<div class='appearance'><div class='group-title'>外观<span class='n'>" + (state.theme === "auto" ? "跟随系统" : state.theme === "dark" ? "深色" : "浅色") + "</span></div>" +
      "<div class='chips'>" + [["auto", "跟随系统"], ["light", "浅色"], ["dark", "深色"]].map(([k, l]) =>
        "<button class='chipbtn" + (state.theme === k ? " sel" : "") + "' data-theme-set='" + k + "'>" + l + "</button>").join("") + "</div>" +
      "<p class='theme-note'>晚上用深色不刺眼；选择只记在这台设备上。</p></div>" +
      "<p class='foot-note'>这些记录只存在这台设备上。</p></div>";
  }

  if (state.screen === "daily") {
    const D = getDaily();
    const cur = D.groups.find((g) => g.id === state.dailyGroup) || null;
    const picks = D.groups.map((g) =>
      "<button class='daily-pick" + (cur && cur.id === g.id ? " on" : "") + "' data-daily='" + g.id + "'>" +
      "<span class='dp-t'>" + g.title + "</span><span class='dp-n'>" + g.items.length + " 道</span></button>").join("");
    let body = "";
    if (cur) {
      const items = cur.items.map((it) => ({ d: DISHES.find((x) => x.id === it[0]), why: it[1] })).filter((x) => x.d);
      body = "<div class='grid'>" + items.map((x, i) => card(x.d, i, x.why)).join("") + "</div>";
    }
    v.innerHTML = "<div class='screen'>" +
      "<div class='topbar'><button class='back' data-go='back' aria-label='返回'>‹</button>" +
      "<div class='result-head'><h2>今日推荐</h2><span class='pill'>" + monthOf() + " 月</span></div></div>" +
      "<div class='daily-picks'>" + picks + "</div>" +
      (cur ? body : "<p class='daily-hint'>点一组，看这 " + D.groups[0].items.length + " 道。</p>") +
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
      "<h3 style='margin-bottom:10px'>做法</h3>" +
      (d.steps
        ? "<div class='steps'>" + d.steps.map((s, i) => "<div class='step'><span class='n'>" + (i + 1) + "</span><span class='txt'>" + s + "</span></div>").join("") + "</div>" +
          (d.tips ? "<div class='tip'>💡 " + d.tips + "</div>" : "")
        : state.stepsMiss.has(d.id)
          ? "<div class='empty'><span class='big-emoji'>📄</span>做法没加载出来。<br>点下面的「找菜谱」看网页版。</div>"
          : "<div class='steps'><div class='step'><span class='n'>…</span><span class='txt'>做法加载中…</span></div></div>") +
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
    if (!d.steps && !state.stepsMiss.has(d.id)) {
      ensureSteps(d).then(() => { if (state.screen === "detail" && state.current === d.id) render(); });
    }
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

const stepsCache = new Map();
const stepsLoading = new Map();

function applySteps(b) {
  const j = stepsCache.get(b);
  if (!j) return false;
  let n = 0;
  for (const d of DISHES) {
    if (d.b === b && j[d.id] && !d.steps) { d.steps = j[d.id].steps; d.tips = j[d.id].tips; n++; }
  }
  return n > 0;
}

// 做法不进首屏：lite.json 只有菜名/标签/食材，进详情页才按批次拉
function ensureSteps(d) {
  if (!d) return Promise.resolve(false);
  if (d.steps) return Promise.resolve(true);
  if (!d.b) { state.stepsMiss.add(d.id); return Promise.resolve(false); }
  if (stepsCache.has(d.b)) { applySteps(d.b); return Promise.resolve(!!d.steps); }
  if (stepsLoading.has(d.b)) return stepsLoading.get(d.b).then(() => !!d.steps);
  const p = fetch("./data/steps/" + d.b)
    .then((r) => r.json())
    .then((j) => { stepsCache.set(d.b, j || {}); applySteps(d.b); })
    .catch(() => {})
    .then(() => { stepsLoading.delete(d.b); if (!d.steps) state.stepsMiss.add(d.id); return !!d.steps; });
  stepsLoading.set(d.b, p);
  return p;
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
  const tb = e.target.closest("[data-theme-cycle],[data-theme-set]");
  if (tb && tb.dataset) {
    if (tb.dataset.themeCycle !== undefined) { setTheme(themeResolved() === "dark" ? "light" : "dark"); return; }
    if (tb.dataset.themeSet) { setTheme(tb.dataset.themeSet); return; }
  }
  const t = e.target.closest("[data-go],[data-ans],[data-id],[data-add],[data-dislike],[data-soft],[data-save],[data-star],[data-eat],[data-copy],[data-photo],[data-folder],[data-rename],[data-drop],[data-newfolder],[data-folder-save],[data-folder-remove],[data-drop-confirm],[data-lvl],[data-daily],[data-undislike],[data-uneat],[data-fillq]");
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
  if (t.dataset.undislike !== undefined) {
    const id = t.dataset.undislike;
    state.disliked.delete(id);
    try { localStorage.setItem("disliked", JSON.stringify([...state.disliked])); } catch (e) {}
    toast("已恢复，这道会重新出现");
    return render();
  }
  if (t.dataset.uneat !== undefined) {
    unmarkEaten(t.dataset.uneat);
    return render();
  }
  if (t.dataset.fillq !== undefined) {
    state.query = t.dataset.fillq;
    const inp = $("#searchq"); if (inp) inp.value = state.query;
    const wrap = $("#hitwrap"); if (wrap) wrap.innerHTML = hitsHtml(state.query);
    const cnt = $("#hitcount"); if (cnt) cnt.textContent = searchHits(state.query).length + " 道";
    return;
  }
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
  else if (go === "search") { state.screen = "search"; state.query = ""; }
  else if (go === "profile") { state.screen = "profile"; }
  else if (go === "restartBatch") {
    const pantry = state.screen === "pantryResult" || !!(state.answers.food && state.answers.food.length);
    state.shown = new Set(); state.refresh = 0; state.exhausted = false;
    state.screen = pantry ? "pantryResult" : "result";
    pick(true);
  }
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

document.addEventListener("input", (e) => {
  if (e.target.id === "pantry") state.pantryText = e.target.value;
  if (e.target.id === "searchq") {
    state.query = e.target.value;
    const wrap = document.getElementById ? document.getElementById("hitwrap") : null;
    const cnt = document.getElementById ? document.getElementById("hitcount") : null;
    if (wrap) wrap.innerHTML = hitsHtml(state.query);
    if (cnt) cnt.textContent = state.query.trim() ? searchHits(state.query).length + " 道" : "菜名 / 食材";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const wb = document.getElementById && document.getElementById("wheel");
  if (wb && wb.classList.contains("on")) { closeWheel(); return; }
  closePhoto();
});

async function loadDishes() {
  try {
    const lite = await (await fetch("./data/lite.json")).json();
    if (Array.isArray(lite) && lite.length) return lite;
  } catch (e) {}
  const idx = await (await fetch("./data/index.json")).json();
  const lists = await Promise.all(idx.files.map((f) => fetch("./data/dishes/" + f).then((r) => r.json())));
  return lists.flat();
}

(async () => {
  try {
    DISHES = await loadDishes();
    try { THUMBS = new Set(await (await fetch("./data/thumbs.json")).json()); } catch (e) { THUMBS = new Set(); }
  } catch (err) {
    $("#app").innerHTML = "<div class='empty'>菜谱库加载失败。<br>请用本地服务器打开。</div>";
    return;
  }
  try { const th = localStorage.getItem(THEME_KEY); if (th === "auto" || th === "light" || th === "dark") state.theme = th; } catch (e) {}
  applyTheme();
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

// 系统深浅色变化时，只有「跟随系统」才跟着切
if (typeof window !== "undefined" && window.matchMedia) {
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSys = () => {
      if (state.theme !== "auto") return;
      applyTheme();
      if (state.screen === "home" || state.screen === "profile") render();
    };
    if (mq.addEventListener) mq.addEventListener("change", onSys);
    else if (mq.addListener) mq.addListener(onSys);
  } catch (e) {}
}

// 分享/浏览器里直接改 hash 时也能进详情，不用整页重载
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("hashchange", () => {
    const id = (window.location.hash || "").replace("#", "").trim();
    if (!id || !DISHES.some((d) => d.id === id)) return;
    if (state.screen === "detail" && state.current === id) return;
    pushNav();
    state.current = id;
    state.screen = "detail";
    render();
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
