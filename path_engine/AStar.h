#ifndef ASTAR_H
#define ASTAR_H

#include <vector>

/**
 * 坐标点结构体
 */
struct Point {
    int x, y;
    Point(int _x = 0, int _y = 0) : x(_x), y(_y) {}
    bool operator==(const Point& o) const { return x == o.x && y == o.y; }
};

/**
 * 核心 A* (A-Star) 寻路算法接口
 * 
 * 针对室内像素级网格坐标系，使用曼哈顿距离进行高效的路径规划。
 * 
 * @param startX 起点X坐标
 * @param startY 起点Y坐标
 * @param endX 终点X坐标
 * @param endY 终点Y坐标
 * @param mapData 一维化后的二维地图数据，0表示可行走，1表示障碍物
 * @param width 地图宽度（像素）
 * @param height 地图高度（像素）
 * @return std::vector<int> 包含路径点的一维数组，格式为 [x1, y1, x2, y2, ...]
 */
std::vector<int> astar_find_path(int startX, int startY, int endX, int endY, const std::vector<int>& mapData, int width, int height);

#endif // ASTAR_H
