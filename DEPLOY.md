# 完整发布教程（GitHub + Cloudflare Pages）

> 目标：拿到一个 https 链接，谁点开都能用，你电脑关机也不影响。
> 改动菜谱后 `git push` 一次，网站自动更新。

## 准备清单

| 要的东西 | 怎么弄 |
|---|---|
| 一个 GitHub 账号 | 你已有 |
| Git（命令行工具） | 见第 1 步，大概 3 分钟 |
| 一个 Cloudflare 账号 | 第 4 步注册，免费，不用信用卡 |

不需要：服务器、域名、备案、信用卡、Node.js（本地不装也能部署）。

---

## 第 1 步：确认/安装 Git

按 `Win + R`，输入 `cmd` 回车，然后输入：

```
git --version
```

- 显示 `git version 2.x.x` → 装好了，跳到第 2 步。
- 提示「不是内部或外部命令」→ 去 https://git-scm.com/download/win 下载 `64-bit Git for Windows Setup`，安装时一路点 Next（默认选项都对），装完**关掉 cmd 重新开一个**。

---

## 第 2 步：在 GitHub 上建仓库

1. 浏览器打开 https://github.com ，登录。
2. 右上角 `+` → `New repository`。
3. `Repository name` 填 `whattoeat`。
4. 选 **Public**（公开）。
5. **下面三个勾一个都别勾**（Add a README / .gitignore / license）。勾了会多出一个提交，第一次推送会冲突，新手最容易卡在这。
6. 点 `Create repository`。

建好后页面会显示一个地址，记住它，形如：

```
https://github.com/你的用户名/whattoeat.git
```

---

## 第 3 步：把本地文件夹变成仓库并推上去

打开 cmd，把下面几条**一条一条**粘进去回车（别一次全粘）。

进入项目目录：

```
cd /d "C:\Users\LENOVO\Documents\deepseek-harness\default-workspace\whattoeat"
```

> `cd /d` 的 `/d` 是用来跨盘符切换的，别漏。

初始化仓库并设置身份（把名字和邮箱换成你自己的）：

```
git init
git config user.name "你的GitHub用户名"
git config user.email "你的GitHub注册邮箱"
```

提交全部文件：

```
git add .
git commit -m "init: 菜谱库 + PWA 前端"
```

连到 GitHub 并推送：

```
git branch -M main
git remote add origin https://github.com/你的用户名/whattoeat.git
git push -u origin main
```

推送时会**弹出一个浏览器窗口让你登录 GitHub**，点授权（Authorize）就行。这是 Git Credential Manager 在帮你登录，不用输密码。

成功后刷新 GitHub 页面，能看到一堆文件，就成了。

> 为什么 `dist` 没被推上去？因为 `.gitignore` 里排除了它。它由 Cloudflare 自动构建，不需要提交。

---

## 第 4 步：Cloudflare Pages 接你的仓库

1. 打开 https://dash.cloudflare.com/sign-up 注册（邮箱 + 密码，验证邮件点一下。**不用绑卡**）。
2. 登录后左侧菜单 → **Workers & Pages**。
3. 点 **Create** → 选 **Pages** 标签 → **Connect to Git**。
4. 点 **Connect GitHub**，弹出授权窗口，选 `Only select repositories` → 勾上 `whattoeat` → Install & Authorize。
5. 回到 Cloudflare，选中 `whattoeat` 仓库 → **Begin setup**。
6. 表单这样填（**这四项最关键**）：

| 字段 | 填什么 |
|---|---|
| Project name | `eat-what`（会变成网址的一部分，随便起，英文小写） |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |

7. 点 **Save and Deploy**。
8. 等 1 分钟左右，状态变成 `Success`，顶部就会显示你的网址：

```
https://eat-what.pages.dev
```

这个链接就是成品。电脑关机、换网络都不影响。

---

## 第 5 步：验证三件事

1. **手机能打开**：把链接发到自己微信，点开。
2. **能装到主屏**：手机浏览器打开 → 菜单 → 「添加到主屏幕」。装好后有独立图标、全屏显示。
3. **能离线**：装好之后，关掉 WiFi 只留数据流量，甚至开飞行模式，再点图标——应该还能打开、能出菜。

> 离线要**打开两次**才生效：第一次是把文件存进手机，第二次才是从缓存里读。

---

## 第 6 步：以后怎么加菜

改完 `data/dishes/*.json`（新批次要写进 `data/index.json` 的 files 数组），然后在 cmd 里：

```
cd /d "C:\Users\LENOVO\Documents\deepseek-harness\default-workspace\whattoeat"
npm run validate
git add .
git commit -m "add batch-04"
git push
```

Cloudflare 监听到 push 会自动重新构建，1 分钟后网站就更新了。网址不变，不用重新发链接。

> `npm run validate` 需要本地装 Node.js（https://nodejs.org 下 LTS 版）。不想装可以跳过，但建议装——它能在推之前拦住写错的数据。

---

## 出问题了怎么办

**push 卡住不动 / 超时**
国内访问 GitHub 偶尔不稳。等 30 秒看有没有反应，没有就 Ctrl+C 重跑一次 `git push`。多次都失败就需要网络代理。

**push 时提示输入用户名密码**
说明没弹出浏览器登录。别输 GitHub 密码（早就不能用了）。解决办法：
```
git config --global credential.helper manager
git push
```
再不行就装 GitHub Desktop（https://desktop.github.com），用它登录一次，认证信息会被系统记住，之后命令行也能推。

**Cloudflare 构建失败**
看日志里最后几行红字。最常见是 Build output directory 填错（必须是 `dist`）或 Build command 填错（必须是 `npm run build`）。

**网站打开是 404**
多半是仓库根目录不是项目根目录——确认 GitHub 仓库首页能直接看到 `index.html` 和 `package.json`，而不是它们还被套在一个 `whattoeat/` 文件夹里。

**朋友说打开很慢或打不开**
`pages.dev` 在国内不是 100% 稳定。换网络（比如从 WiFi 切 4G）通常能好。真要做到完全稳定只能上国内备案方案，现阶段不值当。

---

## 装到手机主屏幕（像 App 一样用）

网站上线、拿到 `https://` 链接之后：

### iPhone / iPad（Safari）

1. 用 **Safari** 打开链接（微信里打开的不行，右上角「…」→「在浏览器打开」）。
2. 点底部中间的「分享」按钮（方框带向上箭头）。
3. 往下滑，点「**添加到主屏幕**」，名字改成「吃什么」，点「添加」。
4. 桌面上会多一个图标，点开就是全屏，没有地址栏。

### Android（Chrome / Edge）

1. 用 Chrome 打开链接。
2. 右上角「⋮」→「**安装应用**」或「添加到主屏幕」。
3. 确认后桌面出现图标；首次打开后即可离线使用。

> 页面首页也会显示一条「装到主屏幕」的提示，点 × 可以永久关掉。

### 为什么必须是 https

- 离线缓存（Service Worker）只在 `https` 或 `localhost` 下生效；`http://192.168.x.x` 能看，但装到桌面后断网打不开。
- 所以先在 Cloudflare Pages 部署好，再用那个 https 链接装。

### 想要真正的安装包（.apk）

两条路，都不改现有代码：

| 方式 | 做法 | 适合 |
|---|---|---|
| TWA 套壳 | 用 [PWABuilder](https://www.pwabuilder.com/) 输入网址，一键生成 Android 包（底层是 Chrome 内核） | 只想发个 apk 给朋友装 |
| Capacitor 打包 | 把 `index.html / app.js / style.css / data` 放进 Capacitor 工程，生成 apk / ipa | 想上架应用商店 |

iOS 的 `.ipa` 需要苹果开发者账号（99 美元/年）或自签工具，个人用「添加到主屏幕」就够了。


## 安卓安装包（APK）

推代码到 main 后，GitHub Actions 会自动编译一个**离线可用**的安卓安装包（网页资源全部打进包里，装上不联网也能用，不受域名被墙影响）。

- 打开仓库 → Actions → 左侧「打安卓离线包」→ 最近一次运行 → 页面底部 Artifacts 里下载 `eatwha-apk`
- 或者直接下载固定链接：https://github.com/HANAVX666/whattoeat/releases/download/apk/eatwha.apk
- 手机安装：把 eatwha.apk 传到安卓手机 → 用文件管理打开 → 允许「安装未知应用」→ 继续安装
- 这是 debug 签名的包，适合自己发朋友用；要上架 Google Play 需要另外配置正式签名
