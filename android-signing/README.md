# 安卓签名

- `eatwha.jks`：固定签名密钥，别名 `eatwha`，口令 `eatwha2026`，JKS 格式，有效期到 2056 年。
- CI（`.github/workflows/android.yml`）先用 gradle 出 debug APK，再用 build-tools 里的 `zipalign -p 4` 对齐、`apksigner` 用这把钥匙重签。
- 仓库是公开的，所以这把钥匙的口令也是公开的。对一个免费、只做侧载的工具 App 来说这是可接受的取舍；它换来的是每次构建签名一致，新包能直接覆盖安装旧包。
- 不要删除或更换这把钥匙：一旦更换，所有已安装的旧版本都无法覆盖升级，只能卸载重装。要换必须同时改 workflow 里的文件名与口令。
