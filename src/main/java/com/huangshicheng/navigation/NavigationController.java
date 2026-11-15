package com.huangshicheng.navigation;

import com.huangshicheng.algorithm.NativePathProvider;
import java.util.Arrays;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/navigation")
public class NavigationController {
    private static final int MAX_CELLS = 200_000;
    private final NativePathProvider engine = new NativePathProvider();

    // Coordinates are grid indices. The frontend converts plan pixels to/from its 4 px grid.
    public record PathRequest(int width, int height, int[] blocked, int[] start, int[][] destinations) {}
    public record PathResponse(String engine, int[][] path) {}
    public record EngineStatus(String engine, boolean available) {}

    @GetMapping("/status")
    public EngineStatus status() {
        return new EngineStatus("native-cpp-astar", engine.isAvailable());
    }

    @PostMapping("/path")
    public PathResponse findPath(@RequestBody PathRequest request) {
        validate(request);
        if (!engine.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "原版 A* 引擎尚未加载，请先编译 PathEngine 并重启后端");
        }
        int[][] map = new int[request.height()][request.width()];
        for (int y = 0; y < request.height(); y++) {
            System.arraycopy(request.blocked(), y * request.width(), map[y], 0, request.width());
        }
        int[] best = null;
        for (int[] destination : request.destinations()) {
            int[] path = engine.findPath(request.start()[0], request.start()[1],
                destination[0], destination[1], map);
            if (path.length > 0 && (best == null || path.length < best.length)) best = path;
        }
        int[][] points = new int[best == null ? 0 : best.length / 2][2];
        for (int i = 0; i < points.length; i++) {
            points[i][0] = best[i * 2];
            points[i][1] = best[i * 2 + 1];
        }
        return new PathResponse("native-cpp-astar", points);
    }

    private static void validate(PathRequest r) {
        if (r == null || r.width() < 1 || r.height() < 1 || r.width() > 1024 || r.height() > 1024 ||
            (long) r.width() * r.height() > MAX_CELLS || r.blocked() == null ||
            r.blocked().length != r.width() * r.height() ||
            Arrays.stream(r.blocked()).anyMatch(value -> value != 0 && value != 1) ||
            !validPoint(r.start(), r.width(), r.height()) || r.destinations() == null ||
            r.destinations().length < 1 || r.destinations().length > 4 ||
            Arrays.stream(r.destinations()).anyMatch(p -> !validPoint(p, r.width(), r.height()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的寻路网格或坐标");
        }
    }

    private static boolean validPoint(int[] point, int width, int height) {
        return point != null && point.length == 2 && point[0] >= 0 && point[1] >= 0 &&
            point[0] < width && point[1] < height;
    }
}
