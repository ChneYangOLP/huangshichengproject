# 皇史宬完整站点部署教程

这套教程会同时发布网页和原版 C++ A* 寻路。建筑模型、平面图、档案查询、时间轴和连续寻路都包含在内。GitHub 可用于保存代码，实际网站运行在你的云服务器上。发布成功后，你自己的电脑可以关机，服务器需要保持运行。

以下按一台全新的 **Ubuntu 24.04 LTS 云服务器**编写。无需在服务器手动安装 Java、Node.js、C++ 或 MySQL，Docker 会完成应用的构建和运行。

**1. 准备服务器**

在云服务商控制台准备一台有公网 IP 的 Ubuntu 24.04 服务器，建议 2 核、4 GB 内存，留出约 20 GB 可用磁盘用于编译和容器镜像。这是便于首次构建的建议配置，不是程序的硬性最低要求。

在服务器的安全组中允许网页访问 TCP 80、443 端口，并保留你登录服务器所需的 SSH 22 端口。后端 18080 只在容器内部使用，不需要对外开放。若服务器另外启用了系统防火墙，也需要允许网页端口。

先用公网 IP 测试，不需要马上购买域名。下文 `SERVER_IP` 全部替换为服务器的真实公网 IP；`ubuntu` 替换为控制台给出的登录用户名，有些服务商使用 `root`。

**2. 在你的 Mac 上打包当前项目并上传**

打开 Mac 终端，执行：

```bash
cd /Users/hatys/IdeaProjects/hsc
sh deploy/package.sh
scp /tmp/hsc-deploy.tar.gz ubuntu@SERVER_IP:/tmp/hsc-deploy.tar.gz
```

如果服务器要求 SSH 私钥，用你的服务商提供的连接方式登录；`scp` 同样支持 `-i` 指定私钥文件。不要把私钥放进项目中。

打包脚本会包括你目前工作区的新模型、最新前后端代码和部署配置，排除 `node_modules`、本地构建产物和 Mac 动态库。它不会提交或推送 Git，也不会夹带项目根目录中无关的 PDF 等文件。这里使用上传当前文件的方式，是因为只从 GitHub 克隆不一定包含你尚未推送的修改。

**3. 登录服务器并解压**

还是在 Mac 终端执行：

```bash
ssh ubuntu@SERVER_IP
```

连接成功后，下面的命令都在服务器上执行：

```bash
mkdir -p ~/hsc
tar -xzf /tmp/hsc-deploy.tar.gz -C ~/hsc
cd ~/hsc
```

之后每次重新登录服务器，先执行 `cd ~/hsc`，再运行本文中的 Docker Compose 命令。

**4. 安装 Docker**

如果服务器已经能运行 `sudo docker compose version`，跳过安装，直接进入下一步。

全新的 Ubuntu 服务器执行：

```bash
sudo sh deploy/install-docker-ubuntu.sh
sudo docker compose version
```

安装脚本使用 Docker 官方 Ubuntu 软件源，并安装 Compose 插件；如果已有其他 Docker、Podman 或 containerd 安装，请先按[Docker 官方安装文档](https://docs.docker.com/engine/install/ubuntu/)处理软件包冲突，不要把这台服务器当作全新环境直接覆盖。

**5. 构建并启动网站**

第一次部署执行：

```bash
cp deploy/.env.example .env
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose ps
```

首次构建会下载镜像、npm 包和 Maven 依赖，需要等待终端命令执行完毕。看到 `backend` 为 `healthy`、`web` 为运行状态后，继续下一步。`-d` 表示后台运行，关闭 SSH 窗口也会继续运行；配置也会在 Docker 启动后恢复服务。

这一步会自动完成：

- 将原版 `path_engine/AStar.cpp` 编译成适用于服务器的 Linux JNI 动态库。
- 构建并运行 Spring Boot，使用现有的 `navigation` 配置，无需数据库。
- 构建 Vue 网页，把 GLB 模型、两殿平面图和馆藏数据一起打包。
- 用 Caddy 提供网页，并把同一网址下的 `/api/*` 请求转发到原版寻路后端。

不要把 Mac 上生成的 `.dylib` 当作服务器引擎使用；部署配置会在 Linux 容器中重新编译。Java 编译环境和运行环境使用同一 Ubuntu 基础版本。

**6. 打开网页并验证寻路**

在手机或另一台电脑的浏览器地址栏输入：

```text
http://SERVER_IP
```

这是服务器地址，不是本机的 `127.0.0.1:5173`，也不需要加 `:5173`。

在服务器终端验证后端：

```bash
curl -fsS http://127.0.0.1/api/navigation/status
```

应返回类似：

```json
{"engine":"native-cpp-astar","available":true}
```

再在网页上逐项确认：

1. 首页能显示组员提供的新建筑模型。
2. 主殿、西殿可以进入，东殿点击后提示“暂不开放”。
3. 金匮能显示档案信息，拖动时间轴后匹配的金匮发光。
4. 对第一个金匮点击“寻路”，路线从入口出发。
5. 对另一个金匮点击“寻路”，路线从上一个金匮旁出发，图片不自动放大。

**7. 有域名后启用 HTTPS**

这一步可在公网 IP 测试通过后再做。

在域名服务商添加一条 DNS 的 `A` 记录，例如把你拥有的 `hsc.你的域名` 指向服务器公网 IP。等待解析生效，并确保外部能访问服务器的 80、443 端口。

服务器执行：

```bash
cd ~/hsc
nano .env
```

把原来的 `SITE_ADDRESS=:80` 改为你的真实域名，例如：

```dotenv
SITE_ADDRESS=hsc.example.com
```

`hsc.example.com` 只是示例，必须替换。只填写域名，不要写路径。保存文件后执行：

```bash
sudo docker compose up -d --force-recreate web
sudo docker compose logs --tail=80 web
```

之后使用 `https://你的真实域名` 访问。配置中的 Caddy 会在域名解析正确、端口可达时申请并续期证书，并将 HTTP 跳转到 HTTPS，参见[Caddy 自动 HTTPS 文档](https://caddyserver.com/docs/automatic-https)。证书保存在 Docker 命名卷中，普通更新不需要删除这些卷。

网页中的摄像头扫码需要浏览器授予权限；正式分享时使用 HTTPS，参见[浏览器摄像头的安全上下文要求](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#security)。

**8. 以后修改代码或模型，如何更新**

先在 Mac 的项目目录重新打包并上传：

```bash
cd /Users/hatys/IdeaProjects/hsc
sh deploy/package.sh
scp /tmp/hsc-deploy.tar.gz ubuntu@SERVER_IP:/tmp/hsc-deploy.tar.gz
```

再登录服务器，解压后重新构建：

```bash
cd ~/hsc
tar -xzf /tmp/hsc-deploy.tar.gz -C ~/hsc
sudo docker compose up -d --build
sudo docker compose ps
```

更新时不用再次复制 `.env.example`，这样会保留已经配置的真实域名。构建失败时查看报错并修复，重新执行构建命令；不要把失败的构建当作已经更新成功。

如果以后代码都已同步至 GitHub，也可以改成在服务器拉取仓库后执行 `sudo docker compose up -d --build`。无论用上传还是 Git，都需要确保新模型已包含在 `frontend/public/models/` 中。

**9. 常用检查命令**

以下均在服务器的 `~/hsc` 目录执行：

```bash
# 查看容器状态
sudo docker compose ps

# 查看最近的后端、网页日志
sudo docker compose logs --tail=100 backend web

# 检查后端容器内的 JNI 引擎状态
sudo docker compose exec backend curl -fsS http://127.0.0.1:18080/api/navigation/status

# 普通重启
sudo docker compose restart

# 停止服务，保留证书卷
sudo docker compose down
```

| 现象 | 先检查什么 |
| --- | --- |
| 公网 IP 打不开 | 容器是否运行，安全组和系统防火墙是否允许 80，服务器上 80 是否被其他服务占用。 |
| `web` 等待后端、无法启动 | 查看 `backend` 的日志和健康状态；确认原版 JNI 引擎的 `available` 为 `true`。 |
| 网页可打开，寻路请求失败 | 查看 `backend` 日志以及 `/api/navigation/status`；部署配置应保留 `/api` 路径前缀。 |
| 模型或平面图没更新 | 检查上传包是否为当前版本，并重新构建 `web`；确认浏览器没有继续显示旧缓存。 |
| 镜像或依赖下载超时 | 确认服务器能连接 Docker Hub、npm 和 Maven 官方源，再重新构建。 |
| 域名 HTTPS 失败 | 检查域名是否已经解析到这台服务器、80/443 是否可达，再查看 `web` 日志。 |

**配置文件在哪里**

- `compose.yaml`：同时启动网页和后端，仅对外发布网页的 80、443 端口。
- `deploy/backend.Dockerfile`：构建 Linux 原版 A*、JNI 和 Spring Boot。
- `deploy/web.Dockerfile`：构建包含 GLB 模型的网页，并通过 Caddy 提供访问。
- `deploy/Caddyfile`：静态网页、API 转发和域名 HTTPS 配置。
- `deploy/.env.example`：首次部署的站点地址示例。
- `deploy/install-docker-ubuntu.sh`：全新 Ubuntu 的 Docker 安装脚本。
- `deploy/package.sh`：打包当前工作区的部署文件，不依赖是否已推送到 GitHub。

本教程不把 GitHub Pages 当作后端服务器。若只把前端放到 GitHub Pages，仍需要另行部署 Java/C++ 后端，并调整 API 地址与跨域配置；本教程通过同一个服务器入口同时提供前后端，避免这一步额外配置。

**本次验证状态（2026-10-19）**

Compose 配置解析、两个 Shell 脚本的语法检查、部署包中必要文件及排除项检查均已通过。本机尝试实际构建镜像时，连接 Docker Hub 的认证服务超时，未能拉取基础镜像，因此完整镜像构建和公网运行尚未验证。部署时请按第 6 步确认网站和原版寻路实际可用。
