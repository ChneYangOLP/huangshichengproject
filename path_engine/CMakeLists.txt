cmake_minimum_required(VERSION 3.10)
project(PathEngine)

# 设置 C++ 标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# 自动寻找系统 JDK 中 JNI 依赖 (适配 Mac/Win/Linux)
find_package(JNI REQUIRED)

# 包含 JNI 头文件目录 (jni.h 和 jni_md.h)
include_directories(${JNI_INCLUDE_DIRS})

# 包含当前目录的头文件
include_directories(${CMAKE_CURRENT_SOURCE_DIR})

# 添加源文件
set(SOURCES AStar.cpp NativePathProvider.cpp)

# 生成动态链接库 (.dylib on Mac, .dll on Windows, .so on Linux)
# 注意：生成的库文件前缀在 Unix 下默认带 "lib"，即 libPathEngine.dylib
add_library(PathEngine SHARED ${SOURCES})

# 链接 JNI 库
target_link_libraries(PathEngine ${JNI_LIBRARIES})

# ================= 自动化输出配置 =================
# 定义 Spring Boot 项目 resources/lib 的目标目录
set(SPRING_BOOT_LIB_DIR "${CMAKE_SOURCE_DIR}/../src/main/resources/lib")

# 添加构建后自动拷贝动作
add_custom_command(TARGET PathEngine POST_BUILD
    # 1. 如果目标目录不存在则创建
    COMMAND ${CMAKE_COMMAND} -E make_directory ${SPRING_BOOT_LIB_DIR}
    # 2. 拷贝生成的动态库文件到资源目录
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:PathEngine> ${SPRING_BOOT_LIB_DIR}/
    COMMENT "自动化部署: 将生成的动态库拷贝至 Spring Boot 目录 (${SPRING_BOOT_LIB_DIR})"
)
