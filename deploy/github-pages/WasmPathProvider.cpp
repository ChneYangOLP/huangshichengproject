#include "AStar.h"
#include <algorithm>
#include <cstddef>
#include <vector>

// A small C ABI for the existing engine. Coordinates are grid cells.
// Returns the number of integers written, 0 for no route, -1 for bad input,
// or -2 if the output buffer is too small.
extern "C" int hsc_find_path(const int* map, int width, int height,
                             int sx, int sy, int ex, int ey,
                             int* output, int capacity) {
    if (!map || !output || width <= 0 || height <= 0 || capacity < 0) return -1;
    const auto cells = static_cast<std::size_t>(width) * height;
    if (cells > 200000) return -1;
    const std::vector<int> grid(map, map + cells);
    const auto path = astar_find_path(sx, sy, ex, ey, grid, width, height);
    if (path.size() > static_cast<std::size_t>(capacity)) return -2;
    std::copy(path.begin(), path.end(), output);
    return static_cast<int>(path.size());
}
