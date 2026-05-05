# 皇史宬时空图谱系统 (HSC Spatial Atlas System)

本项目为皇史宬大殿提供从宏观建筑 3D 展示到微观金匮 2D 档案查阅的全栈解决方案，并配备基于 C++ 的底层高性能计算引擎。

## 目录结构
- `/frontend` : 基于 Vue 3 + Vite + Tailwind CSS 的前端可视化工程（包含 3D 与 2D 联动逻辑）。
- `/src/main/java/...` : Spring Boot 后端工程代码。
- `/path_engine` : C++ 高性能算法引擎（用于 JNI 调用的 A* 寻路模块）。

---

## 模块说明：C++ 寻路引擎与 JNI 桥接

为了实现在复杂的室内环境中进行毫秒级的像素网格路径规划（比如避开 152 座金匮进行导航），我们通过 **JNI (Java Native Interface)** 将底层 A* (A-Star) 算法以 C++ 实现，并在 Spring Boot 端调用。

### 1. JNI 头文件生成 (Mac 适配)

如果你修改了 Java 侧的 `NativePathProvider.java`，需要重新生成 JNI C++ 头文件。

请打开终端，并在项目根目录下执行以下命令：
```bash
# 进入 Java 源码根目录
cd src/main/java

# 编译生成 JNI 头文件 (将自动在当前目录下生成 com_huangshicheng_algorithm_NativePathProvider.h)
javac -h . com/huangshicheng/algorithm/NativePathProvider.java
```
*注：你可以将生成的 `.h` 文件拷贝到 `path_engine` 目录下供开发参考，但目前 `NativePathProvider.cpp` 已根据签名直接实现了对应的方法。*

### 2. C++ 编译与自动部署 (CMake)

我们在 `path_engine` 中配置了跨平台的 CMake 构建脚本。无论你是在 Mac 还是将来的 Windows 上，都可以使用标准流程编译。

```bash
# 进入 C++ 工程目录
cd path_engine

# 创建并进入构建目录
mkdir build && cd build

# 运行 CMake 配置 (会自动寻找你系统中的 JDK 和 JNI 头文件)
cmake ..

# 开始编译
make
```

**自动化特性：**
当你执行 `make` (或在 Win 下使用 MSVC 构建) 完成后，CMakeLists 中配置的 `POST_BUILD` 脚本会自动将生成的动态链接库（Mac 下为 `libPathEngine.dylib`，Win 下为 `PathEngine.dll`）拷贝到 Spring Boot 的 `src/main/resources/lib` 目录下。
Java 层的 `NativePathProvider` 中配置了静态代码块 `System.loadLibrary("PathEngine")`，只需确保在运行 Java 程序时，指明 Library 路径即可加载成功。

### 3. 数据通信协议
C++ 引擎与 Java 之间通过基本类型和数组进行高速交互：
- **传入：** 一维降维处理后的 Java `int[][]` 数组，以及起终点坐标，通过 JNI `GetIntArrayElements` 获取指针。
- **返回：** C++ 端寻路完成后，组装成一维 `jintArray` 格式 `[x1, y1, x2, y2...]` 交回给 Java，避免复杂对象的序列化开销，确保百毫秒内响应。

---

## 项目使用教程 (快速启动)

### 1. 启动后端 (Spring Boot)
后端包含了业务逻辑和对 C++ 寻路引擎的 JNI 调用：
1. 确保已通过上方指南编译生成了 C++ 动态链接库。
2. 使用 IntelliJ IDEA 打开项目根目录。
3. 运行 `HscApplication.java` 启动 Spring Boot 服务。
*(注：如果遇到找不到 `PathEngine` 动态库的报错，请确保在运行配置中的 VM Options 加入 `-Djava.library.path=src/main/resources/lib` 或对应路径)*

### 2. 启动前端 (Vue 3)
前端包含了 3D 宏观建筑、2D 殿内微观漫游以及文创扫码系统：
```bash
# 进入前端工程目录
cd frontend

# 安装项目依赖包 (首次运行需执行)
npm install

# 启动本地开发服务器
npm run dev
```
启动成功后，控制台会输出一个本地访问地址（如 `http://localhost:5173`），在浏览器中打开即可体验系统。

### 3. 前端打包部署 (生产环境)
如果你需要将网页部署到服务器上供他人访问：
```bash
cd frontend
npm run build
```
执行完毕后，`frontend` 目录下会生成一个 `dist` 文件夹。你可以将该文件夹部署到 Nginx、Vercel 或任何静态文件托管平台上。

### 4. 核心功能体验指南
*   **空间漫游**：初始界面为 3D 宏观外景，点击相应入口即可进入大殿内部的 2D 金匮平面图。
*   **档案检索与导览**：使用顶部搜索框查找档案（如“大明实录”），系统会自动定位到该档案所在的金匮并展示高亮的最佳寻路路线。点击金匮可在右侧专家面板查阅详细卷宗。
*   **时间轴穿越**：拖动底部的年份时间轴，体验不同年代档案的动态存续变化。
*   **文创扫码互动**：点击右上角的“数字文创”按钮，进入文创空间。点击“扫一扫”可调用真实的物理摄像头（需在 `localhost` 或 `https` 环境下访问）扫描文创产品的防伪二维码，实时获取区块链溯源信息。
