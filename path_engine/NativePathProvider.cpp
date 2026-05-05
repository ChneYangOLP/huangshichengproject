#include <jni.h>
#include <vector>
#include "AStar.h"

#ifdef __cplusplus
extern "C" {
#endif

/*
 * JNI 跨语言桥梁实现
 * 
 * 将 Java 层传入的二维数组和起终点数据，转化为 C++ 侧的高性能一维 Vector，
 * 调度 A* 算法，并将计算结果转化回 jintArray 供 Java 侧调用。
 * 
 * Class:     com_huangshicheng_algorithm_NativePathProvider
 * Method:    findPath
 * Signature: (IIII[[I)[I
 */
JNIEXPORT jintArray JNICALL Java_com_huangshicheng_algorithm_NativePathProvider_findPath
  (JNIEnv *env, jobject thisObj, jint startX, jint startY, jint endX, jint endY, jobjectArray mapDataArray) {
    
    // 1. 获取二维数组的高度 (行数)
    jsize height = env->GetArrayLength(mapDataArray);
    if (height == 0) {
        return env->NewIntArray(0); // 空地图直接返回空数组
    }

    // 2. 获取二维数组的宽度 (列数，取第一行长度)
    jintArray firstRow = (jintArray) env->GetObjectArrayElement(mapDataArray, 0);
    jsize width = env->GetArrayLength(firstRow);
    env->DeleteLocalRef(firstRow);

    // 3. 将 Java 中不连续的二维 jobjectArray 转换为 C++ 中连续存储的 std::vector (一维降维处理)
    // 这样做可以极大提高 A* 算法的寻址速度和缓存命中率
    std::vector<int> cppMapData(width * height, 0);
    for (int y = 0; y < height; ++y) {
        jintArray rowArray = (jintArray) env->GetObjectArrayElement(mapDataArray, y);
        jint *rowElements = env->GetIntArrayElements(rowArray, JNI_FALSE);
        
        for (int x = 0; x < width; ++x) {
            cppMapData[y * width + x] = rowElements[x];
        }
        
        // 释放 JVM 内存锁并清理引用
        env->ReleaseIntArrayElements(rowArray, rowElements, JNI_ABORT);
        env->DeleteLocalRef(rowArray);
    }

    // 4. 调用高性能 A* 核心算法
    std::vector<int> path = astar_find_path(startX, startY, endX, endY, cppMapData, width, height);

    // 5. 将 C++ 运算结果转换回 Java 的一维 int 数组 [x1, y1, x2, y2...]
    jintArray result = env->NewIntArray(path.size());
    if (path.size() > 0) {
        env->SetIntArrayRegion(result, 0, path.size(), &path[0]);
    }

    return result;
}

#ifdef __cplusplus
}
#endif
