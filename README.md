# 今天吃什么

手机优先的「吃什么」决策助手，外加一个「家里有什么食材 → 能做什么菜」的反推工具。
纯静态 PWA，没有后端、没有账号，全部计算在浏览器里完成，菜谱打包在 `data/` 的 JSON 里。

## 两个区块

### 1. 不知道吃什么

按顺序回答 9–10 个问题（自己做还是外卖 / 哪一顿 / 菜系路子 / 荤素 / 口味 / 辣度 / 想吃热的凉的 / 常吃的还是尝鲜 / 想吃哪一类 / 能花多少时间 / 有什么厨具），
再在软选项页勾一轮「今天就想吃 / 想吃到的主料 / 这些别放」，然后：

- 一屏推 6 道菜，卡片直接铺实拍照片；
- 不满意点「🎲 刷新换一批」，批数越多越往冷门走（大众度上限逐批收紧，但不会突然全变成没人听过的菜）；
- 犹豫不决点「🎡 转盘定一个」，扇形转盘停稳后直接进详情；
- 点进任意一道菜：实拍图 + 灯箱（可换图/搜更多）、食材属性、分步做法、小窍门、收藏 / 吃过了 / 以后别再推、分享（Web Share 或复制链接）；
- 底部「📖 找菜谱 / ▶ 看视频」跳到下厨房和 B 站搜索。

「吃过了」会记录时间，三天内吃过的菜会被压下去；「以后别再推」直接排除；收藏和「最近吃过」在首页可以回看。

### 2. 家里有食材

输入（或点选）家里有的食材，按「能用上的食材数量」反推菜名，同样支持换一批、转盘、进详情。
食材快选按钮按全库出现频次动态生成，库越大越准。

## 数据

- 菜谱：`data/dishes/batch-*.json`，字段与词表校验见 `scripts/db.mjs`
- 索引：`data/index.json`（由校验脚本重写）
- 照片：`data/photos.json`（Bing 图片搜索抓取，标题相关性校验）
- 缩略图：`data/thumbs/<dishId>.webp`（420×315，服务端同源，首屏 6 张约 100KB）

## 本地跑

```
npm start          # http://localhost:8080
```

手机同 WiFi 打开终端里打印的局域网地址即可。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm start` | 启动本地预览服务器 |
| `npm run validate` | 校验菜谱数据（字段、枚举、重名、覆盖度），并重写 `data/index.json` |
| `npm run build` | 生成 `dist/`，用于部署 |
| `npm run icons` | 重新生成应用图标 |
| `node test/ui-smoke.mjs` | 无浏览器冒烟测试（16 项） |
| `node scripts/photos-bing.mjs` | 给缺图的菜抓照片（`--limit` / `--only` / `--relax` / `--q=`） |
| `python scripts/make-thumbs.py` | 为新照片生成 webp 缩略图 |

## 加菜谱

在 `data/dishes/` 下新增 `batch-NN.json`（顶层数组），把文件名写进 `data/index.json` 的 `files`，然后：

```
npm run validate
node scripts/photos-bing.mjs
python scripts/make-thumbs.py
```

字段规则、词表见 `data/taxonomy.json`、`data/ingredients.json`，样例见 `data/dishes/batch-01.json`。

## 部署

见 [DEPLOY.md](./DEPLOY.md)。整目录是纯静态资源，GitHub Pages / Cloudflare Pages 都能直接托管。
