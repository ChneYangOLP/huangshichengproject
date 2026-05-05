package com.huangshicheng.algorithm;

/**
 * NativePathProvider 
 * 
 * JNI 调用桥梁类，用于连接 Java 侧的寻路请求与 C++ 侧的 A* 高性能寻路算法引擎。
 * 作用：在后端计算 152 座金匮殿宇内避开障碍物的最短路径。
 */
public class NativePathProvider {

    // 静态代码块，在类加载时自动加载 C++ 编译生成的动态链接库
    static {
        try {
            // 加载名为 PathEngine 的动态库 (Mac下自动解析为 libPathEngine.dylib，Win下为 PathEngine.dll)
            // 请确保编译后的动态库放置在 JVM 的库路径中，如 src/main/resources/lib 并配置启动参数 -Djava.library.path=...
            // 或者在应用启动时动态释放并使用 System.load() 绝对路径加载
            System.loadLibrary("PathEngine");
        } catch (UnsatisfiedLinkError e) {
            System.err.println("Native library failed to load.\n" + e);
        }
    }

    /**
     * native 方法：执行底层 A-Star 寻路算法。
     * 接收二维地图数据与起终点坐标，通过 JNI 传递给 C++ 侧，毫秒级返回路径。
     *
     * @param startX 起点 X 像素坐标
     * @param startY 起点 Y 像素坐标
     * @param endX   终点 X 像素坐标
     * @param endY   终点 Y 像素坐标
     * @param map    二维地图数组，0代表空地可行走，1代表障碍物（金匮、墙体、石台等）
     * @return 返回表示路径坐标的一维数组 [x1, y1, x2, y2, ...]，若无路径则返回空数组
     */
    public native int[] findPath(int startX, int startY, int endX, int endY, int[][] map);

    /**
     * Java 层封装的辅助方法：方便通过 ID 进行寻路。
     * 实际业务中，可以先从数据库或缓存中查出金匮的像素坐标，然后传入 C++。
     */
    public int[] findPathById(String startId, String endId, int[][] map) {
        // TODO: 查询库获取真实坐标 (伪代码演示)
        int startX = 0, startY = 0; // queryCoordinates(startId)
        int endX = 100, endY = 100; // queryCoordinates(endId)
        
        return findPath(startX, startY, endX, endY, map);
    }
}
