const $ = (s, r = document) => r.querySelector(s);
const SEARCH = {
  img: (n) => "https://cn.bing.com/images/search?q=" + encodeURIComponent(n + " 成品"),
  recipes: (n) => "https://www.xiachufang.com/search/?keyword=" + encodeURIComponent(n),
  video: (n) => "https://search.bilibili.com/all?keyword=" + encodeURIComponent(n + " 做法")
};

let DISHES = [];
const state = { screen: "home", answers: {}, soft: new Set(), qi: 0, shown: new Set(), disliked: new Set(), batch: [], pantryText: "" };

const QUESTIONS = [
  { id: "src", q: "今天自己做，还是点外卖？", opts: [["自己动手做", "cook"], ["点外卖 / 出去吃", "out"], ["都行", "any"]] },
  { id: "diet", q: "想吃荤的还是素的？", opts: [["想吃肉", "荤"], ["想吃素", "素"], ["都行，不挑", "any"]] },
  { id: "spicy", q: "能接受多辣？", opts: [["一点辣都不要", "0"], ["能吃点辣", "2"], ["要够辣", "4"]] },
  { id: "form", q: "想吃哪一类？", opts: [["炒菜炖菜，配米饭", "菜"], ["汤和羹", "汤羹"], ["面、饭、饺子这类", "主食"], ["凉菜、小吃、卤味", "小吃"]] },
  { id: "time", q: "能花多少时间？", when: (a) => a.src !== "out", opts: [["十分钟内", "10"], ["半小时左右", "30"], ["不着急", "999"]] }
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
  { label: "鸡肉", kind: "ing", v: "鸡肉" },
  { label: "猪肉", kind: "ing", v: "猪肉" },
  { label: "牛肉", kind: "ing", v: "牛肉" },
  { label: "鱼", kind: "ing", v: "鱼" },
  { label: "虾", kind: "ing", v: "虾" },
  { label: "鸡蛋", kind: "ing", v: "鸡蛋" },
  { label: "豆腐", kind: "ing", v: "豆腐" }
];

const ING_KEYS = {
  "鸡肉": ["鸡胸肉", "鸡腿", "鸡翅", "鸡爪", "三黄鸡"],
  "猪肉": ["猪里脊", "五花肉", "排骨", "猪肉末", "火腿肠", "毛肚"],
  "牛肉": ["牛里脊", "牛腱", "牛肉末"],
  "鱼": ["鲈鱼", "草鱼", "鱼头"],
  "虾": ["鲜虾"],
  "鸡蛋": ["鸡蛋", "蛋清"],
  "豆腐": ["嫩豆腐"]
};

const EMOJI = [["鸡","🍗"],["鸭","🦆"],["牛","🥩"],["猪","🥓"],["排骨","🍖"],["鱼","🐟"],["虾","🦐"],["蛋","🥚"],
  ["豆腐","🍲"],["面","🍜"],["饭","🍚"],["粉","🍜"],["饺","🥟"],["茄子","🍆"],["土豆","🥔"],["黄瓜","🥒"],
  ["番茄","🍅"],["白菜","🥬"],["菜","🥬"],["汤","🥣"],["饼","🥞"],["花生","🥜"]];
const emojiOf = (d) => { for (const [k, e] of EMOJI) if (d.mainIngredients.join("").includes(k) || d.name.includes(k)) return e; return "🍱"; };
const hueOf = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const tint = (d) => "linear-gradient(135deg,hsl(" + hueOf(d.id) + ",72%,88%),hsl(" + ((hueOf(d.id) + 40) % 360) + ",64%,80%))";
const spicyWord = ["不辣", "微辣", "中辣", "麻辣", "爆辣"];

function score(d, a) {
  let s = d.popularity * 10;
  if (a.form && a.form !== "any" && d.form === a.form) s += 9;
  if (a.src === "cook" && d.difficulty === 3) s -= 6;
  if (a.src === "out" && d.popularity < 4) s -= 8;
  if (a.time) {
    const t = +a.time;
    if (d.timeMin <= t) s += 5;
    else s -= Math.min(18, (d.timeMin - t) / 4);
  }
  for (const k of state.soft || []) {
    const i = k.indexOf(":");
    const kind = k.slice(0, i), v = k.slice(i + 1);
    if (kind === "tag" && d.tags.includes(v)) s += 7;
    if (kind === "ing" && d.mainIngredients.some((x) => (ING_KEYS[v] || []).includes(x))) s += 8;
  }
  if (a.food && a.food.length) {
    const hit = d.mainIngredients.filter((x) => a.food.includes(x)).length;
    s += hit * 7;
  }
  s += Math.random() * 2.5;
  return s;
}

const hardPool = (a) => DISHES.filter((d) => {
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
  if (reset) state.shown = new Set();
  if (!pool.length) { state.batch = []; return; }
  if (pool.every((d) => state.shown.has(d.id))) state.shown = new Set();
  const rest = pool.filter((d) => !state.shown.has(d.id));
  const ranked = rest.map((d) => ({ d, s: score(d, state.answers) })).sort((x, y) => y.s - x.s);
  state.batch = ranked.slice(0, 12).map((x) => x.d);
  state.batch.forEach((d) => state.shown.add(d.id));
}

function thumb(d) {
  const img = d.image ? "<img src='" + d.image + "' loading='lazy' alt='' onerror='this.remove()'>" : "";
  return "<div class='thumb' style='background:" + tint(d) + "'>" + emojiOf(d) + img + "</div>";
}

function card(d) {
  return "<div class='dish' data-id='" + d.id + "'>" + thumb(d) +
    "<div class='dish-body'><div class='dish-name'>" + d.name + "</div>" +
    "<div class='meta'><span>" + d.timeMin + " 分钟</span><span>" + spicyWord[d.spicy] + "</span></div></div></div>";
}

function render() {
  const v = $("#app");

  if (state.screen === "home") {
    v.innerHTML = "<h1>今天吃什么</h1><p class='sub'>别纠结了，问你几个问题。</p>" +
      "<button class='big' data-go='quiz'><span class='ico'>🤔</span><span><div class='t'>不知道吃什么</div><div class='d'>问几个问题，给你 12 个选项</div></span><span class='arrow'>›</span></button>" +
      "<button class='big' data-go='pantry'><span class='ico'>🥕</span><span><div class='t'>家里有食材</div><div class='d'>告诉我你有什么，我报菜名</div></span><span class='arrow'>›</span></button>" +
      "<button class='big' data-go='spin'><span class='ico'>🎯</span><span><div class='t'>直接来一批</div><div class='d'>不问了，随便抽</div></span><span class='arrow'>›</span></button>" +
      "<p class='sub' style='margin-top:26px'>菜库 " + DISHES.length + " 道</p>";
  }

  if (state.screen === "quiz") {
    const qs = activeQs();
    const Q = qs[Math.min(state.qi, qs.length - 1)];
    const done = qs.filter((q) => state.answers[q.id] !== undefined).length;
    const ready = done >= Math.min(4, qs.length);
    v.innerHTML = "<button class='back' data-go='home'>‹ 返回</button>" +
      "<div class='progress'>" + qs.map((q, i) => "<div class='dot " + (i < done ? "on" : "") + "'></div>").join("") + "</div>" +
      "<h2>" + Q.q + "</h2>" +
      "<div>" + Q.opts.map(([label, val]) => "<button class='opt' data-ans='" + val + "'>" + label + "</button>").join("") + "</div>" +
      (ready ? "<div style='margin-top:22px'><button class='btn primary block' data-go='soft'>下一步 ›</button></div>" : "");
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
      v.innerHTML = "<button class='back' data-go='quiz'>‹ 改答案</button>" +
        "<h2>今天可以吃这些</h2><p class='sub' style='margin:-6px 0 14px'>点一道看做法，不满意就刷新。</p>" +
        "<div class='grid'>" + state.batch.map(card).join("") + "</div>" +
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
        "<div class='grid'>" + state.batch.map(card).join("") + "</div>" +
        "<div class='row'><button class='btn' data-go='pantryRefresh'>🎲 换一批</button><button class='btn' data-go='pantry'>↺ 改食材</button></div>";
    }
  }

  if (state.screen === "detail") {
    const d = DISHES.find((x) => x.id === state.current);
    const hero = d.image
      ? "<div class='hero' style='background:" + tint(d) + "'>" + emojiOf(d) + "<img src='" + d.image + "' alt='' onerror='this.remove()'></div>"
      : "<div class='hero' style='background:" + tint(d) + "'>" + emojiOf(d) + "</div>";
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
    if (state.qi < next.length - 1) state.qi++;
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
