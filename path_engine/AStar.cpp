#include "AStar.h"
#include <queue>
#include <cmath>
#include <algorithm>

/**
 * A* 算法节点
 */
struct Node {
    Point p;
    int f, g, h;
    // f(n) = g(n) + h(n)
    Node(Point _p, int _g, int _h) : p(_p), g(_g), h(_h), f(_g + _h) {}
    
    // 优先队列使用的小顶堆重载
    bool operator>(const Node& o) const { 
        if (f == o.f) return h > o.h; // 如果总代价相同，优先选启发值小的
        return f > o.f; 
    }
};

std::vector<int> astar_find_path(int startX, int startY, int endX, int endY, const std::vector<int>& mapData, int width, int height) {
    std::vector<int> ans; // 用于存储最终返回的路径坐标序列 [x1, y1, x2, y2, ...]

    // 1. 边界安全检查
    if (startX < 0 || startX >= width || startY < 0 || startY >= height ||
        endX < 0 || endX >= width || endY < 0 || endY >= height) {
        return ans;
    }

    // 2. 检查起点和终点是否已经被障碍物 (1) 占据
    if (mapData[startY * width + startX] == 1 || mapData[endY * width + endX] == 1) {
        return ans;
    }

    // 3. 算法核心数据结构分配
    std::vector<int> dist(width * height, 1e9);     // 记录从起点到各点的最小距离 g(n)
    std::vector<bool> vis(width * height, false);   // 记录节点是否在 Closed List 中
    std::vector<int> pre(width * height, -1);       // 记录路径前驱索引，方便最后回溯

    std::priority_queue<Node, std::vector<Node>, std::greater<Node>> pq; // Open List

    // 4. 起点初始化
    int startIdx = startY * width + startX;
    dist[startIdx] = 0;
    // 启发式函数 h(n)：使用曼哈顿距离计算
    int h = std::abs(startX - endX) + std::abs(startY - endY); 
    pq.push(Node(Point(startX, startY), 0, h));

    // 上下左右四个移动方向
    int dx[] = {0, 1, 0, -1};
    int dy[] = {1, 0, -1, 0};

    bool found = false;

    // 5. 寻路主循环
    while (!pq.empty()) {
        Node curr = pq.top();
        pq.pop();

        int uX = curr.p.x;
        int uY = curr.p.y;
        int uIdx = uY * width + uX;

        // 找到终点
        if (uX == endX && uY == endY) {
            found = true;
            break;
        }

        // 若已处理过该节点，则跳过
        if (vis[uIdx]) continue;
        vis[uIdx] = true;

        // 探索周围 4 个邻居
        for (int i = 0; i < 4; i++) {
            int vX = uX + dx[i];
            int vY = uY + dy[i];
            int vIdx = vY * width + vX;

            // 检查边界及是否是障碍物 (0 代表可行走)
            if (vX >= 0 && vX < width && vY >= 0 && vY < height && mapData[vIdx] == 0) {
                // 如果发现更短的到达邻居的路径
                if (dist[vIdx] > dist[uIdx] + 1) {
                    dist[vIdx] = dist[uIdx] + 1;
                    pre[vIdx] = uIdx;
                    int vH = std::abs(vX - endX) + std::abs(vY - endY);
                    pq.push(Node(Point(vX, vY), dist[vIdx], vH));
                }
            }
        }
    }

    // 6. 如果找到了终点，回溯构造路径
    if (found) {
        int currIdx = endY * width + endX;
        std::vector<Point> path;
        
        while (currIdx != -1) {
            path.push_back(Point(currIdx % width, currIdx / width));
            currIdx = pre[currIdx];
        }
        
        // 由于回溯是从终点到起点，所以需要翻转
        std::reverse(path.begin(), path.end());
        
        // 压入答案数组
        for (const auto& p : path) {
            ans.push_back(p.x);
            ans.push_back(p.y);
        }
    }

    return ans;
}
