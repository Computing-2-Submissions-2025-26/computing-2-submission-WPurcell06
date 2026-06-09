/**
 * Havannah.test.js
 *
 * Unit tests for the Havannah game engine (Havannah.js).
 *
 * These tests cover the core public API with a focus on the three win
 * conditions — Bridge, Fork, and Ring — as well as basic stone placement
 * behaviour and turn alternation.
 *
 * Win-condition boards are hand-crafted using Havannah.place_stone directly
 * so we can set up the exact positions needed without interleaving opponent
 * moves.  The make_state helper then wraps a board into a minimal State so
 * Havannah.place can be called for the final stone, exercising the full
 * win-detection path.
 *
 * Run with:   npm test
 */

import assert   from "node:assert/strict";
import R        from "../ramda.js";
import Havannah from "../Havannah.js";

// ── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Pre-computed set of all valid "q,r" keys on the board.
 * Built once and reused by throw_if_invalid.
 */
const valid_coord_set = new Set(
    Havannah.get_all_coords().map(function (coord) {
        return `${coord[0]},${coord[1]}`;
    })
);

/**
 * Throws a descriptive error if the game state is structurally invalid.
 *
 * A valid state must satisfy:
 *   – board is an object (not null)
 *   – every key in the board is a recognised "q,r" coordinate
 *   – every value in the board is exactly 1 or 2
 *   – current_player is 1 or 2
 *
 * Stone-count balance is intentionally not checked here, because
 * the hand-crafted win-condition boards are not reached through
 * normal alternating play and would fail that check.
 *
 * @param {Havannah.State} state
 */
const throw_if_invalid = function (state) {
    if (typeof state !== "object" || state === null) {
        throw new Error("State is not an object.");
    }

    const board = state.board;

    if (typeof board !== "object" || board === null) {
        throw new Error("board is not an object.");
    }

    Object.keys(board).forEach(function (key) {
        if (!valid_coord_set.has(key)) {
            throw new Error(
                `Board contains an off-board key: "${key}".`
            );
        }
        if (board[key] !== 1 && board[key] !== 2) {
            throw new Error(
                `Invalid token at "${key}": ${board[key]}.` +
                " Expected 1 or 2."
            );
        }
    });

    if (state.current_player !== 1 && state.current_player !== 2) {
        throw new Error(
            `current_player is not 1 or 2: ${state.current_player}.`
        );
    }
};

/**
 * Builds a board by placing one player's stones at a list of coordinates.
 * Used to set up specific positions for win-condition tests.
 *
 * @param {(1|2)}              player
 * @param {Havannah.Coord[]}   coords   Array of [q, r] pairs to occupy.
 * @returns {Havannah.Board}
 */
const build_board = function (player, coords) {
    return R.reduce(
        function (board, coord) {
            return Havannah.place_stone(player, coord[0], coord[1], board);
        },
        Havannah.new_board(),
        coords
    );
};

/**
 * Wraps a board in a minimal State so that Havannah.place can be called
 * to add one more stone and trigger win-condition checking.
 *
 * @param {Havannah.Board} board
 * @param {(1|2)}          player  Whose turn it is.
 * @returns {Havannah.State}
 */
const make_state = function (board, player) {
    return Object.freeze({
        "board":          board,
        "current_player": player,
        "winner":         undefined
    });
};

// ── Test suites ───────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
describe("Board geometry", function () {
// ─────────────────────────────────────────────────────────────────────────────

    it("a base-4 board has 37 cells", function () {
        assert.strictEqual(Havannah.get_all_coords().length, 37);
    });

    it("every coord returned by get_all_coords satisfies the boundary rule", function () {
        const n = 3;
        Havannah.get_all_coords().forEach(function (coord) {
            const q = coord[0];
            const r = coord[1];
            assert.ok(
                Math.abs(q) <= n && Math.abs(r) <= n && Math.abs(q + r) <= n,
                `Coord [${q},${r}] violates the boundary rule.`
            );
        });
    });

});

// ─────────────────────────────────────────────────────────────────────────────
describe("A new game", function () {
// ─────────────────────────────────────────────────────────────────────────────

    it("starts with an empty board", function () {
        const game = Havannah.new_game();
        assert.strictEqual(Object.keys(game.board).length, 0);
    });

    it("has player 1 moving first", function () {
        const game = Havannah.new_game();
        assert.strictEqual(game.current_player, 1);
    });

    it("has no winner yet", function () {
        const game = Havannah.new_game();
        assert.strictEqual(game.winner, undefined);
    });

    it("produces a structurally valid state", function () {
        const game = Havannah.new_game();
        assert.doesNotThrow(function () {
            throw_if_invalid(game);
        });
    });

    it("get_cell returns 0 for every cell on an empty board", function () {
        const board = Havannah.new_board();
        assert.strictEqual(Havannah.get_cell(0, 0, board), 0);
        assert.strictEqual(Havannah.get_cell(-3, 0, board), 0);
        assert.strictEqual(Havannah.get_cell(0, 3, board), 0);
    });

});

// ─────────────────────────────────────────────────────────────────────────────
describe("Placing a stone", function () {
// ─────────────────────────────────────────────────────────────────────────────

    it(
        "given an empty board, " +
        "when player 1 places at (0, 0), " +
        "get_cell returns 1 at that position",
        function () {
            const game  = Havannah.new_game();
            const after = Havannah.place(game, 0, 0);
            assert.strictEqual(Havannah.get_cell(0, 0, after.board), 1);
        }
    );

    it(
        "given an empty board, " +
        "when player 1 places, " +
        "the resulting state is structurally valid",
        function () {
            const game  = Havannah.new_game();
            const after = Havannah.place(game, 0, 0);
            assert.doesNotThrow(function () {
                throw_if_invalid(after);
            });
        }
    );

    it(
        "given player 1 has just placed, " +
        "it is player 2's turn in the new state",
        function () {
            const game  = Havannah.new_game();
            const after = Havannah.place(game, 0, 0);
            assert.strictEqual(after.current_player, 2);
        }
    );

    it(
        "given player 2 has just placed, " +
        "it is player 1's turn again",
        function () {
            const after_p1 = Havannah.place(Havannah.new_game(), 0, 0);
            const after_p2 = Havannah.place(after_p1, 1, 0);
            assert.strictEqual(after_p2.current_player, 1);
        }
    );

    it(
        "placing on a cell already occupied returns undefined",
        function () {
            const after_p1  = Havannah.place(Havannah.new_game(), 0, 0);
            const after_p2  = Havannah.place(after_p1, 1, 0);
            const bad_move  = Havannah.place(after_p2, 0, 0); // (0,0) is taken
            assert.strictEqual(bad_move, undefined);
        }
    );

    it(
        "placing at a coordinate off the board returns undefined",
        function () {
            const bad_move = Havannah.place(Havannah.new_game(), 10, 10);
            assert.strictEqual(bad_move, undefined);
        }
    );

    it(
        "placing a stone after the game is already won returns undefined",
        function () {
            // Construct a Bridge win first, then attempt another placement.
            const bridge_board = build_board(1, [
                [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]
            ]);
            const win_state   = Havannah.place(make_state(bridge_board, 1), 3, 0);
            const extra_move  = Havannah.place(win_state, -1, 1);
            assert.strictEqual(extra_move, undefined);
        }
    );

    it(
        "the board is unchanged after an illegal move",
        function () {
            const after_p1 = Havannah.place(Havannah.new_game(), 0, 0);
            const illegal  = Havannah.place(after_p1, 0, 0); // occupied
            assert.strictEqual(illegal, undefined);
            // Confirm the board still has exactly one stone
            assert.strictEqual(Object.keys(after_p1.board).length, 1);
        }
    );

});

// ─────────────────────────────────────────────────────────────────────────────
describe("Bridge win", function () {
// ─────────────────────────────────────────────────────────────────────────────

    // A Bridge connects any two of the six corners.
    //
    // Board set-up: player 1 places along the horizontal axis r = 0,
    // from the left corner (-3, 0) towards the right corner (3, 0).
    // Six stones are pre-placed; Havannah.place adds the seventh at (3, 0)
    // and should detect the Bridge.
    //
    // Diagram (base-4, n = 3):
    //
    //   LEFT-CORNER                                     RIGHT-CORNER
    //      (-3,0) ── (-2,0) ── (-1,0) ── (0,0) ── (1,0) ── (2,0) ── (3,0)

    it(
        "given player 1 stones connect two corners, " +
        "Havannah.place returns a state whose winner.type is 'Bridge'",
        function () {
            const pre_board = build_board(1, [
                [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), 3, 0);

            assert.strictEqual(result.winner.type, "Bridge");
        }
    );

    it(
        "the winning player recorded in winner.player is 1",
        function () {
            const pre_board = build_board(1, [
                [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), 3, 0);

            assert.strictEqual(result.winner.player, 1);
        }
    );

    it(
        "the winning group contains all seven stones on the bridge path",
        function () {
            const pre_board = build_board(1, [
                [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), 3, 0);

            assert.strictEqual(result.winner.group.length, 7);
        }
    );

    it(
        "given player 1 stones touch only one corner, " +
        "there is no winner yet",
        function () {
            // Three stones from the left corner inward — only one corner reached.
            const pre_board = build_board(1, [
                [-3, 0], [-2, 0]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), -1, 0);

            assert.strictEqual(result.winner, undefined);
        }
    );

});

// ─────────────────────────────────────────────────────────────────────────────
describe("Fork win", function () {
// ─────────────────────────────────────────────────────────────────────────────

    // A Fork connects any three of the six edges (corners excluded from edges).
    //
    // Board set-up: player 1 builds a connected path that touches three edges:
    //
    //   Left edge    (q = −3)  via  (-3, 1)
    //   Top edge     (r =  3)  via  (-1, 3)
    //   Top-right    (q+r = 3) via  (1,  2)   ← placed last by Havannah.place
    //
    // Path:  (-3,1) → (-2,1) → (-1,1) → (-1,2) → (-1,3)
    //                                  → (0,2)  → (1,2)

    it(
        "given player 1 stones connect three distinct edges, " +
        "Havannah.place returns a state whose winner.type is 'Fork'",
        function () {
            const pre_board = build_board(1, [
                [-3, 1], [-2, 1], [-1, 1], [-1, 2], [-1, 3], [0, 2]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), 1, 2);

            assert.strictEqual(result.winner.type, "Fork");
        }
    );

    it(
        "the winning player recorded in winner.player is 1",
        function () {
            const pre_board = build_board(1, [
                [-3, 1], [-2, 1], [-1, 1], [-1, 2], [-1, 3], [0, 2]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), 1, 2);

            assert.strictEqual(result.winner.player, 1);
        }
    );

    it(
        "given player 1 stones touch only two edges, " +
        "there is no winner yet",
        function () {
            // Path: (-3,1) → (-2,1) → (-2,2) → (-2,3) → (-1,3)
            // Edges touched: Left (q=−3) and Top (r=3) — only two.
            const pre_board = build_board(1, [
                [-3, 1], [-2, 1], [-2, 2], [-2, 3]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), -1, 3);

            assert.strictEqual(result.winner, undefined);
        }
    );

});

// ─────────────────────────────────────────────────────────────────────────────
describe("Ring win", function () {
// ─────────────────────────────────────────────────────────────────────────────

    // A Ring is a closed loop of stones that encloses at least one cell.
    // The smallest possible ring on a hex grid is six stones arranged around
    // a single centre cell.
    //
    // Board set-up: the six direct neighbours of (0, 0) form a ring:
    //
    //     (0, 1) ── (1, 0)
    //    /                \
    // (-1,1)    (0,0)   (1,-1)
    //    \                /
    //    (-1,0) ── (0,-1)
    //
    // None of these six cells lie on a board corner or edge, so Bridge and
    // Fork cannot fire — only the Ring condition is satisfied.
    //
    // Five stones are pre-placed; Havannah.place adds (1,−1) to close the loop.

    it(
        "given six stones forming a closed hexagonal loop, " +
        "Havannah.place returns a state whose winner.type is 'Ring'",
        function () {
            const pre_board = build_board(1, [
                [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), 1, -1);

            assert.strictEqual(result.winner.type, "Ring");
        }
    );

    it(
        "the winning player recorded in winner.player is 1",
        function () {
            const pre_board = build_board(1, [
                [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), 1, -1);

            assert.strictEqual(result.winner.player, 1);
        }
    );

    it(
        "given five of the six ring stones (loop not yet closed), " +
        "there is no winner yet",
        function () {
            // Place four stones, then add a fifth — the sixth (1,−1) is still missing.
            const pre_board = build_board(1, [
                [1, 0], [0, 1], [-1, 1], [-1, 0]
            ]);
            const result = Havannah.place(make_state(pre_board, 1), 0, -1);

            assert.strictEqual(result.winner, undefined);
        }
    );

    it(
        "get_connected_group returns all six stones once the ring is complete",
        function () {
            const ring_board = build_board(1, [
                [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]
            ]);
            const group = Havannah.get_connected_group(ring_board, 0, 1);
            assert.strictEqual(group.length, 6);
        }
    );

    it(
        "get_connected_group returns an empty array for an empty cell",
        function () {
            const board = Havannah.new_board();
            const group = Havannah.get_connected_group(board, 0, 0);
            assert.strictEqual(group.length, 0);
        }
    );

    // ── Ring edge case: the 3-cycle false positive ────────────────────────
    //
    // In a hexagonal adjacency graph, three cells can be mutually adjacent,
    // forming a triangle (3-cycle): e.g. (0,0), (1,0), and (0,1) are all
    // neighbours of one another.
    //
    // The old E ≥ N algorithm counted E = 3 edges and N = 3 nodes and
    // incorrectly fired a Ring win.  The fix (flood fill from the boundary)
    // correctly sees that these three cells enclose no hex face at all — they
    // only share a single grid vertex, not a grid cell.
    //
    // This test is a regression guard: it must NEVER pass if E ≥ N is used.

    it(
        "three mutually adjacent stones (a triangle) do not trigger a Ring win " +
        "[regression: old E≥N algorithm falsely fired here]",
        function () {
            // (0,0), (1,0), (0,1) are pairwise adjacent in axial coords.
            // They form a 3-cycle but enclose no cell — not a Ring.
            const pre_board = build_board(1, [[0, 0], [1, 0]]);
            const result    = Havannah.place(make_state(pre_board, 1), 0, 1);

            assert.strictEqual(result.winner, undefined);
        }
    );

    // ── Ring edge case: a larger ring enclosing multiple cells ─────────────
    //
    // A ring does not have to be the minimum 6-stone loop.  Here eight stones
    // form a closed loop that encloses two interior cells — (0,0) and (1,0).
    //
    // Ring path (clockwise):
    //   (-1,0) → (0,-1) → (1,-1) → (2,-1) → (2,0) → (1,1) → (0,1) → (-1,1) → (-1,0)

    it(
        "a larger ring of eight stones enclosing two cells is a Ring win",
        function () {
            const pre_board = build_board(1, [
                [-1, 0], [0, -1], [1, -1], [2, -1], [2, 0], [1, 1], [0, 1]
            ]);
            // (-1,1) closes the loop
            const result = Havannah.place(make_state(pre_board, 1), -1, 1);

            assert.strictEqual(result.winner.type, "Ring");
        }
    );

});

// ─────────────────────────────────────────────────────────────────────────────
describe("Fork edge cases", function () {
// ─────────────────────────────────────────────────────────────────────────────

    // ── Corner cells do NOT count as edges ─────────────────────────────────
    //
    // Havannah rules: corners are corners, not edges.  A path that reaches two
    // edges AND a corner touches only two distinct edges, not three.
    //
    // Path:  (-3,1) → (-2,1) → (-1,1) → (-1,2) → (-1,3) → (0,3)
    //   (-3,1) is on the Left edge (q = −3)
    //   (-1,3) is on the Top edge  (r =  3)
    //   (0, 3) is a CORNER — it counts as a corner, not an edge
    //
    // Two distinct edges < three required → no Fork.

    it(
        "a path through two edges and one corner is not a Fork win " +
        "(corner does not count as an edge)",
        function () {
            const pre_board = build_board(1, [
                [-3, 1], [-2, 1], [-1, 1], [-1, 2], [-1, 3]
            ]);
            // (0,3) is a corner, not an edge cell
            const result = Havannah.place(make_state(pre_board, 1), 0, 3);

            assert.strictEqual(result.winner, undefined);
        }
    );

    // ── Disconnected stones on three edges are not a Fork ──────────────────
    //
    // A Fork requires ONE connected group that spans three edges.
    // Disconnected stones on three different edges do not count.

    it(
        "three stones each on a different edge but not connected are not a Fork",
        function () {
            // (-3,1): Left edge.  (-1,3): Top edge.  These two are not adjacent.
            // Place (1,2) on the Top-right edge — also not adjacent to either.
            const pre_board = build_board(1, [[-3, 1], [-1, 3]]);
            const result    = Havannah.place(make_state(pre_board, 1), 1, 2);

            assert.strictEqual(result.winner, undefined);
        }
    );

});

// ─────────────────────────────────────────────────────────────────────────────
describe("Player 2 can win", function () {
// ─────────────────────────────────────────────────────────────────────────────

    // All tests above used player 1.  Win detection must work equally for
    // player 2 — the player number is passed through from the board token.

    it(
        "player 2 wins a Bridge by connecting the top corner (0,3) " +
        "to the bottom corner (0,−3)",
        function () {
            // Player 2 stones along the q = 0 column, from (0,−3) to (0,3).
            const pre_board = build_board(2, [
                [0, -3], [0, -2], [0, -1], [0, 0], [0, 1], [0, 2]
            ]);
            const result = Havannah.place(make_state(pre_board, 2), 0, 3);

            assert.strictEqual(result.winner.type,   "Bridge");
            assert.strictEqual(result.winner.player, 2);
        }
    );

    it(
        "player 2 wins a Fork by connecting three edges",
        function () {
            // Same geometry as the player 1 Fork test but using player 2 tokens.
            const pre_board = build_board(2, [
                [-3, 1], [-2, 1], [-1, 1], [-1, 2], [-1, 3], [0, 2]
            ]);
            const result = Havannah.place(make_state(pre_board, 2), 1, 2);

            assert.strictEqual(result.winner.type,   "Fork");
            assert.strictEqual(result.winner.player, 2);
        }
    );

    it(
        "player 2 wins a Ring by closing a hexagonal loop",
        function () {
            const pre_board = build_board(2, [
                [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]
            ]);
            const result = Havannah.place(make_state(pre_board, 2), 1, -1);

            assert.strictEqual(result.winner.type,   "Ring");
            assert.strictEqual(result.winner.player, 2);
        }
    );

});
