package com.huangshicheng.navigation;

import com.huangshicheng.algorithm.NativePathProvider;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class NavigationControllerTests {
    private final NavigationController controller = new NavigationController();

    @Test
    void originalCppEngineFindsShortestDetourAndHandlesBlockedAndUnreachableGoals() {
        assertTrue(controller.status().available(), "Run sh path_engine/build-native.sh before tests");
        int[] blocked = new int[25];
        for (int y = 0; y < 4; y++) blocked[y * 5 + 2] = 1;
        var request = new NavigationController.PathRequest(5, 5, blocked, new int[]{0, 0}, new int[][]{{4, 0}});
        var result = controller.findPath(request);
        assertEquals("native-cpp-astar", result.engine());
        assertEquals(13, result.path().length);
        assertArrayEquals(new int[]{0, 0}, result.path()[0]);
        assertArrayEquals(new int[]{4, 0}, result.path()[12]);
        for (int i = 0; i < result.path().length; i++) {
            int[] p = result.path()[i];
            assertEquals(0, blocked[p[1] * 5 + p[0]]);
            if (i > 0) assertEquals(1, Math.abs(p[0] - result.path()[i - 1][0]) + Math.abs(p[1] - result.path()[i - 1][1]));
        }
        var nearest = controller.findPath(new NavigationController.PathRequest(5, 5, blocked,
            new int[]{0, 0}, new int[][]{{4, 0}, {0, 1}, {2, 0}}));
        assertEquals(2, nearest.path().length);
        blocked[22] = 1;
        assertEquals(0, controller.findPath(request).path().length);
        blocked[0] = 1;
        assertEquals(0, controller.findPath(request).path().length);
    }

    @Test
    void malformedAndOversizedRequestsAreRejectedBeforeJni() {
        for (var request : new NavigationController.PathRequest[]{
            new NavigationController.PathRequest(5, 5, new int[24], new int[]{0, 0}, new int[][]{{1, 1}}),
            new NavigationController.PathRequest(5, 5, new int[25], new int[]{-1, 0}, new int[][]{{1, 1}}),
            new NavigationController.PathRequest(1024, 1024, new int[0], new int[]{0, 0}, new int[][]{{1, 1}}),
            new NavigationController.PathRequest(5, 5, new int[25], new int[]{0, 0}, new int[][]{null}),
        }) {
            var error = assertThrows(ResponseStatusException.class, () -> controller.findPath(request));
            assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        }
    }

    @Test
    void jniGuardsRaggedNullAndInvalidMaps() {
        var nativeEngine = new NativePathProvider();
        assertTrue(nativeEngine.isAvailable());
        assertThrows(IllegalArgumentException.class, () -> nativeEngine.findPath(0, 0, 1, 0, null));
        assertThrows(IllegalArgumentException.class, () -> nativeEngine.findPath(0, 0, 1, 0, new int[][]{{0, 0}, {0}}));
        assertThrows(IllegalArgumentException.class, () -> nativeEngine.findPath(0, 0, 1, 0, new int[][]{{0, 2}}));
        assertArrayEquals(new int[0], nativeEngine.findPath(0, 0, 1, 0, new int[0][]));
        assertArrayEquals(new int[]{0, 0}, nativeEngine.findPath(0, 0, 0, 0, new int[][]{{0}}));
    }
}
