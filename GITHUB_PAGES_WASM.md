# 皇史宬：GitHub Pages + WebAssembly 部署教程

这条路线不需要安装 Ubuntu、Docker，也不需要租服务器。GitHub Pages 托管网页；原版 `path_engine/AStar.cpp` 编译成 WebAssembly（简称 WASM），在访问者的浏览器里计算路线。

```text
你修改并上传代码
       ↓
GitHub Actions 自动编译 C++ → astar.wasm，再构建网页
       ↓
GitHub Pages 发布网页、平面图、模型、档案数据和 WASM
       ↓
别人打开网址，在自己的浏览器里查看模型、档案并寻路
```

WebAssembly 是浏览器能够执行的一种编译格式，这里仍然执行你原来的 C++ A* 算法。Java/JNI 后端不用部署。GitHub Pages 本身只能托管静态网站，不能运行 Spring Boot；把寻路移入浏览器正好解决这个问题。[GitHub Pages 说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Emscripten 模块说明](https://emscripten.org/docs/compiling/Modularized-Output.html)。

**当前状态：教程与示例已备好；网页尚未切换到 WASM，也尚未发布。** 按下面顺序操作即可。已有 Docker 方案可以保留，两条路线任选其一。

## 1. 确定要使用的 GitHub 仓库

本项目目前的 `origin` 地址是：

[ChneYangOLP/huangshichengproject](https://github.com/ChneYangOLP/huangshichengproject)

下面按这个仓库的 `main` 分支操作。你需要有该仓库的写入权限，以及设置 Pages 的权限。GitHub Free 可以给公开仓库开通 Pages；私有仓库是否支持取决于账户方案。[官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)。

打开 Mac 的终端，进入项目：

```bash
cd /Users/hatys/IdeaProjects/hsc
git remote -v
git branch --show-current
```

检查 `origin` 是否是你准备发布的仓库，分支是否为 `main`。本项目还有别的远程地址，本教程明确推送到 `origin`。

## 2. 将网页寻路切换为 WebAssembly

在同一个终端运行：

```bash
node deploy/github-pages/prepare.mjs
```

这是本教程提供的准备脚本。它会完成三件事：

1. 新建 `frontend/src/utils/wasmNavigation.ts`，负责加载 WASM、传入地图和读取路线。
2. 把 `LeafletMicroView.vue` 的寻路导入切换到 WASM，并更新加载失败提示。
3. 新建 `.github/workflows/pages.yml`，让 GitHub 自动编译、测试和发布。

它不会安装大型软件，也不会提交或上传代码。如果目标文件已有不同内容，会停止并提示你核对。

切换后，原有交互继续使用同一套位置和路线状态：首次从入口寻路，之后从当前金匮旁出发；寻路不会主动放大图片。西殿 W、主殿 N 编号、时间轴和东殿禁入逻辑不需要另外修改。

想了解具体改动，可以打开 `frontend/src/components/LeafletMicroView.vue`。原来的：

```ts
import { routeToCabinetNative } from '../utils/nativeNavigation';
```

将变成：

```ts
import { routeToCabinetWasm as routeToCabinetNative } from '../utils/wasmNavigation';
```

这里用别名保持现有调用方式，内部变为直接调用浏览器中的 C++。

**本步骤只接好代码，还没有生成 WASM 文件。** 在第一次云端编译成功之前，本地网页点寻路会提示模块未能载入；模型和档案浏览仍可使用。第 7 步说明如何把云端编译结果拿回来用于本地预览。

## 3. 在 GitHub 开启 Pages

用浏览器打开你的仓库，依次进入：

**Settings → Pages → Build and deployment → Source → GitHub Actions**

选择的是 **GitHub Actions**，不用选择分支中的根目录或 `docs` 文件夹。Vue/Vite 需要先构建，我们的工作流会负责这一步。[Vite 官方教程](https://vite.dev/guide/static-deploy.html#github-pages)。

如果没有 Settings，检查自己是否有仓库管理权限；如果仓库设置禁止 Actions，需要先由仓库管理员启用。

## 4. 上传这次需要的源码

先查看改动：

```bash
git status --short
```

本项目里已有许多本地修改。下面明确选择网页源码、素材、C++ 原算法和部署文件，不把本地依赖、打包目录一起上传：

```bash
git add .github/workflows/pages.yml
git add deploy/github-pages GITHUB_PAGES_WASM.md README.md .gitignore
git add frontend/src frontend/public
git add frontend/package.json frontend/package-lock.json frontend/index.html
git add frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.node.json
git add frontend/tests
git add path_engine/AStar.cpp path_engine/AStar.h
git diff --cached --stat
```

最后一条会列出这次准备提交的文件。确认其中包含两张平面图、`models/huangshicheng.glb`、档案数据和寻路源码。仓库历史里已经跟踪了一些 `node_modules`、`dist` 文件；本次无需再选择它们，Actions 会重新安装依赖和构建。

如果你之前已经暂存过其他文件，最后的清单也会包含它们，请一起核对。公开发布后，网页使用的模型、图片、档案数据都能被访问者下载。

确认清单后：

```bash
git commit -m "Add GitHub Pages deployment with C++ WebAssembly pathfinding"
git push origin main
```

如果提示登录 GitHub，按你的 Git 工具提示登录即可，不要把密码或令牌写进源码。如果推送提示远端已有新提交，先同步并核对冲突，不要强制推送。

## 5. 等待自动构建和发布

仓库顶部打开 **Actions**，找到 **Build WebAssembly and deploy Pages**。

本次工作流会依次：

1. 安装网页依赖。
2. 下载官方 Emscripten 编译器，编译原版 `AStar.cpp` 和一个小型接口文件。
3. 生成 `frontend/public/wasm/astar.mjs` 和 `astar.wasm`。
4. 用实际 WASM 检查绕过障碍、不可达和原地寻路，再运行现有数据逻辑测试。
5. 构建 `frontend/dist`，上传并发布到 Pages。

文件中会出现 `runs-on: ubuntu-latest`。**这是 GitHub 临时提供的云端构建电脑，不是让你在 Mac 安装 Ubuntu，也不是要你购买 Ubuntu 服务器。** 构建结束后由 GitHub 管理它。Emscripten 的下载、安装和启用方式来自[官方安装文档](https://emscripten.org/docs/getting_started/downloads.html)。

当前编译脚本的核心是：

```bash
em++ path_engine/AStar.cpp deploy/github-pages/WasmPathProvider.cpp \
  -I path_engine -std=c++17 -O3 --no-entry \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node \
  -sALLOW_MEMORY_GROWTH=1 \
  '-sEXPORTED_FUNCTIONS=["_hsc_find_path","_malloc","_free"]' \
  '-sEXPORTED_RUNTIME_METHODS=["HEAP32"]' \
  '-sINCOMING_MODULE_JS_API=["locateFile","wasmBinary"]' \
  -o frontend/public/wasm/astar.mjs
```

你不需要在本机执行这段命令，工作流已经会运行 `build-wasm.sh`。两个输出文件需要配套使用：`.mjs` 是加载接口，`.wasm` 是编译后的算法。[C++ 与 JavaScript 互调说明](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html)。

为了让项目网址中的图片和 WASM 正确加载，工作流会按仓库名设置 Vite 的 `base`。当前仓库对应 `/huangshichengproject/`；你本机开发仍默认使用 `/`。如果以后换为 `用户名.github.io` 这种根站点仓库，或绑定独立域名，应将工作流中的构建命令改为 `npm --prefix frontend run build -- --base /`。[路径设置依据](https://vite.dev/guide/static-deploy.html#github-pages)。

## 6. 打开网页并检查寻路

等 Actions 全部变绿，打开 **Settings → Pages** 显示的网址。

如果仓库、账号保持上面的名称，成功发布后预计网址是：

[https://chneyangolp.github.io/huangshichengproject/](https://chneyangolp.github.io/huangshichengproject/)

**这不是已发布成功的确认；以 Pages 页面显示的网址和 Actions 结果为准。**

用这个网址检查：模型可见；西殿与主殿图片正常；点击东殿提示暂不开放；点击金匮能查看档案；时间轴高亮正常；连续选择两个金匮寻路时，第二段从当前金匮旁出发且画面比例保持不变。

此时可以关闭本机 Java 服务和 Docker，再用手机或其他电脑打开公网网址测试。浏览器中应该加载 `wasm/astar.mjs` 与 `wasm/astar.wasm`，寻路不再请求 `/api/navigation/path`。不要把 `127.0.0.1:5173` 发给别人，那仍是你自己的本机地址。

## 7. 以后如何本地预览、更新

第一次 Pages 发布成功后，可下载这两个编译结果供本机开发使用。在项目根目录运行：

```bash
mkdir -p frontend/public/wasm
curl --fail --location https://chneyangolp.github.io/huangshichengproject/wasm/astar.mjs -o frontend/public/wasm/astar.mjs
curl --fail --location https://chneyangolp.github.io/huangshichengproject/wasm/astar.wasm -o frontend/public/wasm/astar.wasm
npm --prefix frontend run dev
```

打开终端显示的本地网址。此时不需要启动 Java，也不需要 Docker。如果修改 C++，先推送让云端重新编译，再同时下载这两个新文件；只有改网页、图、模型、档案时，本地已有的 WASM 通常可继续用。

以后发布：修改文件 → 只暂存本次需要的源码 → 提交 → `git push origin main`。GitHub Actions 会重新编译和更新网址，无需手动上传 `dist`，也无需提交编译出来的 `frontend/public/wasm` 文件。

编译器在工作流中使用 `latest`，方便首次安装。需要长期保持构建环境完全一致时，可把两处 `latest` 改成首次成功构建所使用的同一个 Emscripten 版本号。

## 8. 常见问题

| 现象 | 检查与处理 |
| --- | --- |
| Actions 没出现工作流 | 确认 `.github/workflows/pages.yml` 已推送到 GitHub；示例目录中的 `pages.yml` 本身不会触发发布。 |
| 发布步骤提示 Pages 未启用 | 回到 Settings → Pages，把 Source 设为 GitHub Actions。 |
| Actions 有红叉 | 打开失败的步骤，查看具体报错。若下载编译器时网络失败，可以在 Actions 页面选择 Re-run failed jobs。 |
| 网页空白、图片或 WASM 404 | 确认使用 Pages 给出的完整项目网址；确认构建 `base` 是 `/仓库名/`，并已提交 `frontend/public` 下素材。 |
| 点击寻路仍提示启动后端 | 准备脚本未运行，或修改后的 `LeafletMicroView.vue` 没提交；核对它是否导入 `wasmNavigation`。 |
| 提示寻路模块未能载入 | 同时检查 `astar.mjs` 和 `astar.wasm` 是否可以从站点的 `wasm/` 目录访问；更新时必须使用同一次编译生成的两个文件。 |
| 本机切换后寻路暂时不能用 | 按第 7 步取回云端生成的 WASM；本地仅切换适配器不会自动安装编译器。 |
| 网址在某些网络中访问缓慢或无法打开 | GitHub Pages 在不同网络下可达性不同，可以先换网络验证。 |

已在隔离副本检查：准备脚本可重复运行；C++ 接口可编译并通过绕障、不可达等检查；切换后的 Vue/TypeScript 网页可按仓库路径构建；现有 10 项测试通过。本机没有安装 Emscripten，因此这些检查不等于实际 WASM 已编译成功。

本教程没有替你推送、启用 Pages 或发布网站；首次真正的 WASM 编译和浏览器运行验证仍需通过上述 Actions 和公网检查完成。
