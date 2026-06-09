/**
 * Havannah game engine.
 *
 * Havannah is a two-player abstract strategy game played on a hexagonal board.
 * The first player to complete any one of three structures wins:
 *
 *   Ring   – a closed loop of stones that encloses at least one cell
 *   Bridge – a chain of stones connecting any two of the six board corners
 *   Fork   – a chain of stones connecting any three of the six board edges
 *            (corners do not count as part of any edge)
 *
 * ── Coordinate system ──────────────────────────────────────────────────────
 *
 * The board uses axial coordinates (q, r). A cell is on the board when:
 *
 *   |q| ≤ n   AND   |r| ≤ n   AND   |q+r| ≤ n,   where n = BOARD_SIZE − 1
 *
 * The centre of the board is (0, 0). For the base-4 board used here,
 * n = 3 and there are 37 cells in total.
 *
 * ── Board representation ───────────────────────────────────────────────────
 *
 * A board is a plain object whose keys are coordinate strings "q,r" and
 * whose values are player tokens (1 or 2). Empty cells are simply absent.
 *
 *   { "0,0": 1, "1,0": 2, "-1,1": 1 }
 *
 * ── Design principles ──────────────────────────────────────────────────────
 *
 * All functions are pure: they never mutate their arguments and always
 * return a new value. State is carried forward explicitly via Havannah.place.
 *
 * @namespace Havannah
 * @author William Purcell  wep24@ic.ac.uk
 * @version 2025/26
 */
import R from "./ramda.js";

const Havannah = Object.create(null);

// ── Type definitions ────────────────────────────────────────────────────────

/**
 * A Board maps "q,r" coordinate strings to player tokens.
 * Only occupied cells appear as keys — empty cells are absent.
 * @memberof Havannah
 * @typedef {Object} Board
 */

/**
 * A player token: 1 for player one, 2 for player two.
 * @memberof Havannah
 * @typedef {(1|2)} Token
 */

/**
 * A cell's contents: either a player token or 0 (empty).
 * @memberof Havannah
 * @typedef {(Havannah.Token|0)} Token_or_empty
 */

/**
 * An axial coordinate pair [q, r].
 * @memberof Havannah
 * @typedef {number[]} Coord
 */

/**
 * A complete game state snapshot.
 * @memberof Havannah
 * @typedef {Object} State
 * @property {Havannah.Board}       board          The current board.
 * @property {(1|2)}               current_player Whose turn it is.
 * @property {Object|undefined}    winner         Win info, or undefined if
 *                                                the game is still in progress.
 */

// ── Board geometry ──────────────────────────────────────────────────────────

/**
 * Cells along each side of the hexagonal board.
 * A base-4 board (BOARD_SIZE = 4) has n = 3 and 37 cells in total.
 * Changing this constant is the only thing needed to resize the board.
 * @constant {number}
 */
const BOARD_SIZE = 4;

/**
 * Returns true if the axial coordinate (q, r) lies on the board.
 *
 * The hexagonal board is the intersection of three "strips" in axial space:
 *   |q| ≤ n,   |r| ≤ n,   |q+r| ≤ n,   where n = BOARD_SIZE − 1.
 *
 * @param {number} q
 * @param {number} r
 * @returns {boolean}
 */
const is_on_board = function (q, r) {
    const n = BOARD_SIZE - 1;
    return (
        Math.abs(q)     <= n &&
        Math.abs(r)     <= n &&
        Math.abs(q + r) <= n
    );
};

/**
 * Returns all board-valid neighbours of (q, r).
 *
 * In axial coordinates the six neighbour directions are always the same
 * fixed offsets regardless of position — this is a key advantage of axial
 * coordinates for hex grids.  We then filter out any that fall outside
 * the board boundary.
 *
 * @param {number} q
 * @param {number} r
 * @returns {Havannah.Coord[]}  Between 3 and 6 neighbour pairs.
 */
const get_neighbors = function (q, r) {
    const directions = [
        [q + 1, r    ],
        [q - 1, r    ],
        [q,     r + 1],
        [q,     r - 1],
        [q + 1, r - 1],
        [q - 1, r + 1]
    ];
    return R.filter(
        function (coord) {
            return is_on_board(coord[0], coord[1]);
        },
        directions
    );
};

/**
 * Every valid cell on the board, precomputed once at module load.
 * Shared by Havannah.get_all_coords (public) and check_ring (private).
 * @type {Havannah.Coord[]}
 */
const ALL_COORDS = Object.freeze(
    R.filter(
        function (coord) {
            return is_on_board(coord[0], coord[1]);
        },
        R.xprod(
            R.range(-(BOARD_SIZE - 1), BOARD_SIZE),
            R.range(-(BOARD_SIZE - 1), BOARD_SIZE)
        )
    )
);

/**
 * Converts a "q,r" key string back into a [q, r] coordinate pair.
 * Used when iterating over the keys of a board object.
 *
 * @param {string} key  A string of the form "q,r".
 * @returns {Havannah.Coord}
 */
const key_to_coord = function (key) {
    const parts = key.split(",");
    return [Number(parts[0]), Number(parts[1])];
};

// ── Corner and edge identification ──────────────────────────────────────────

/**
 * The six corner cells of the board, listed clockwise from the top-right.
 * On a base-4 board (n = 3) these are the cells that lie at the vertex of
 * two edge boundaries simultaneously.
 *
 *          (-3, 3) ────── (0, 3)
 *         /                      \
 *   (-3, 0)                    (3, 0)
 *         \                      /
 *          (0,-3) ────── (3,-3)
 *
 * @type {Havannah.Coord[]}
 */
const CORNERS = Object.freeze([
    [ 0,               BOARD_SIZE - 1 ],
    [ BOARD_SIZE - 1,  0              ],
    [ BOARD_SIZE - 1, -(BOARD_SIZE - 1)],
    [ 0,              -(BOARD_SIZE - 1)],
    [-(BOARD_SIZE - 1), 0             ],
    [-(BOARD_SIZE - 1), BOARD_SIZE - 1]
]);

/**
 * Returns true if (q, r) is one of the six board corners.
 *
 * @param {number} q
 * @param {number} r
 * @returns {boolean}
 */
const is_corner = function (q, r) {
    return R.any(R.equals([q, r]), CORNERS);
};

/**
 * Returns which edge (0–5) the cell (q, r) lies on, or undefined.
 *
 * The six edges are indexed clockwise:
 *   0 = Top          (r  =  n)
 *   1 = Top-right    (q+r =  n)
 *   2 = Right        (q  =  n)
 *   3 = Bottom       (r  = −n)
 *   4 = Bottom-left  (q+r = −n)
 *   5 = Left         (q  = −n)
 *
 * Corner cells satisfy two edge conditions simultaneously.  Havannah rules
 * treat them as corners only, so this function returns undefined for corners.
 *
 * @param {number} q
 * @param {number} r
 * @returns {number|undefined}  Edge index 0–5, or undefined.
 */
const get_edge = function (q, r) {
    if (is_corner(q, r)) {
        return undefined;
    }
    const n = BOARD_SIZE - 1;
    if (r     ===  n) { return 0; } // Top
    if (q + r ===  n) { return 1; } // Top-right
    if (q     ===  n) { return 2; } // Right
    if (r     === -n) { return 3; } // Bottom
    if (q + r === -n) { return 4; } // Bottom-left
    if (q     === -n) { return 5; } // Left
    return undefined;
};

// ── BFS: connected group ────────────────────────────────────────────────────

/**
 * Returns every cell connected to (q, r) that shares the same player token.
 *
 * Uses a pure recursive breadth-first search.  The queue and visited list
 * are passed as arguments — nothing is mutated.
 *
 * @param {Havannah.Board} board
 * @param {number} q
 * @param {number} r
 * @returns {string[]}  "q,r" strings of every cell in the connected group.
 */
const get_connected_group = function (board, q, r) {
    const player = (board[`${q},${r}`] || 0);

    if (player === 0) {
        return [];
    }

    // BFS state is (queue of [q,r] pairs to visit, visited keys already seen).
    const recur = function (queue, visited) {
        if (queue.length === 0) {
            return visited;
        }

        const head_q   = queue[0][0];
        const head_r   = queue[0][1];
        const head_key = `${head_q},${head_r}`;

        // Neighbours that share the player's token, haven't been visited,
        // and aren't already in the queue.
        const unvisited_same_colour = R.filter(
            function (neighbor) {
                const neighbor_key = `${neighbor[0]},${neighbor[1]}`;
                const in_queue = R.any(
                    R.equals([neighbor[0], neighbor[1]]),
                    queue
                );
                return (
                    (board[neighbor_key] || 0) === player &&
                    !R.includes(neighbor_key, visited) &&
                    !in_queue
                );
            },
            get_neighbors(head_q, head_r)
        );

        return recur(
            R.concat(R.drop(1, queue), unvisited_same_colour),
            R.append(head_key, visited)
        );
    };

    return recur([[q, r]], []);
};

// ── Win-condition detection ─────────────────────────────────────────────────

/**
 * Returns true if the given player's stones form a Ring on the board.
 *
 * ── Why E ≥ N is wrong for hex grids ───────────────────────────────────────
 *
 * In a hexagonal adjacency graph, three mutually adjacent cells form a
 * 3-cycle (triangle): e.g. (0,0)–(1,0)–(0,1)–(0,0).  Here E = N = 3,
 * so E ≥ N fires — but this triangle encloses no cell at all.  It only
 * shares a single grid *vertex*, not a grid *face*.
 *
 * ── Correct approach: flood fill from the board boundary ───────────────────
 *
 * A Ring is defined by enclosure: the player's stones must surround at least
 * one cell so that cell cannot reach the board boundary without crossing a
 * player stone.
 *
 * Algorithm:
 *   1. Collect all non-player cells (empty or opponent's stones).
 *   2. Start a BFS from every non-player cell that lies on the board boundary.
 *      (Boundary cells have fewer than 6 valid neighbours.)
 *   3. Flood through non-player cells only.
 *   4. If any non-player cell was never reached → it is enclosed → Ring.
 *
 * @param {Havannah.Board} board
 * @param {(1|2)}          player
 * @returns {boolean}
 */
const check_ring = function (board, player) {
    // Predicate: cell is NOT one of the player's stones.
    const is_non_player = function (coord) {
        return (board[`${coord[0]},${coord[1]}`] || 0) !== player;
    };

    const non_player_cells = R.filter(is_non_player, ALL_COORDS);

    // Seed the flood fill from every non-player cell on the board boundary.
    // Boundary cells have fewer than 6 valid neighbours (they're on the edge).
    const boundary_seeds = R.filter(
        function (coord) {
            return (
                is_non_player(coord) &&
                get_neighbors(coord[0], coord[1]).length < 6
            );
        },
        ALL_COORDS
    );

    // Pure recursive BFS — queue holds [q, r] pairs, visited holds "q,r" keys.
    const bfs = function (queue, visited) {
        if (queue.length === 0) {
            return visited;
        }

        const head_q   = queue[0][0];
        const head_r   = queue[0][1];
        const head_key = `${head_q},${head_r}`;

        const unvisited_non_player = R.filter(
            function (neighbor) {
                const neighbor_key = `${neighbor[0]},${neighbor[1]}`;
                const in_queue = R.any(
                    R.equals([neighbor[0], neighbor[1]]),
                    queue
                );
                return (
                    is_non_player(neighbor) &&
                    !R.includes(neighbor_key, visited) &&
                    !in_queue
                );
            },
            get_neighbors(head_q, head_r)
        );

        return bfs(
            R.concat(R.drop(1, queue), unvisited_non_player),
            R.append(head_key, visited)
        );
    };

    const reachable_from_boundary = bfs(boundary_seeds, []);

    // Ring confirmed if any non-player cell is unreachable from the boundary.
    return R.any(
        function (coord) {
            return !R.includes(`${coord[0]},${coord[1]}`, reachable_from_boundary);
        },
        non_player_cells
    );
};

/**
 * Checks whether the stone just placed at (q, r) has completed a win.
 * Tests Bridge → Fork → Ring in that order.
 *
 * @param {Havannah.Board} board  Board after the stone has been placed.
 * @param {number} q
 * @param {number} r
 * @returns {{ type: string, player: number, group: string[] } | undefined}
 */
const check_win = function (board, q, r) {
    const player = (board[`${q},${r}`] || 0);
    const group  = get_connected_group(board, q, r);

    // ── Bridge: does the group touch two or more corners? ──────────────────
    const corners_in_group = R.pipe(
        R.map(key_to_coord),
        R.filter(function (coord) {
            return is_corner(coord[0], coord[1]);
        }),
        R.length
    )(group);

    if (corners_in_group >= 2) {
        return {"type": "Bridge", player, group};
    }

    // ── Fork: does the group touch three or more distinct edges? ───────────
    const distinct_edges = R.pipe(
        R.map(key_to_coord),
        R.map(function (coord) {
            return get_edge(coord[0], coord[1]);
        }),
        R.reject(R.isNil),   // discard interior cells and corners
        R.uniq,              // each edge index counted at most once
        R.length
    )(group);

    if (distinct_edges >= 3) {
        return {"type": "Fork", player, group};
    }

    // ── Ring: are any non-player cells enclosed by the player's stones? ──────
    if (check_ring(board, player)) {
        return {"type": "Ring", player, group};
    }

    return undefined;
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns every valid cell on the board as an array of [q, r] pairs.
 *
 * Uses the Cartesian product of the axis range (−n … +n) with itself,
 * then filters to cells that satisfy the hexagonal boundary condition.
 * For BOARD_SIZE = 4 (n = 3) this yields 37 cells.
 *
 * @memberof Havannah
 * @function
 * @returns {Havannah.Coord[]}
 */
Havannah.get_all_coords = function () {
    return ALL_COORDS;
};

/**
 * Returns a new, empty board.
 *
 * @memberof Havannah
 * @function
 * @returns {Havannah.Board}
 */
Havannah.new_board = function () {
    return Object.freeze(Object.create(null));
};

/**
 * Returns a fresh game state: empty board, player 1 to move, no winner yet.
 *
 * @memberof Havannah
 * @function
 * @returns {Havannah.State}
 */
Havannah.new_game = function () {
    return Object.freeze({
        "board":          Havannah.new_board(),
        "current_player": 1,
        "winner":         undefined
    });
};

/**
 * Returns the player who moves after the given player (toggles 1 ↔ 2).
 *
 * @memberof Havannah
 * @function
 * @param {(1|2)} player
 * @returns {(1|2)}
 */
Havannah.next_player = function (player) {
    return (player === 1 ? 2 : 1);
};

/**
 * Returns a copy of the state with the current player toggled.
 * Does not check legality or win conditions.
 *
 * @memberof Havannah
 * @function
 * @param {Havannah.State} state
 * @returns {Havannah.State}
 */
Havannah.next_turn = function (state) {
    return Object.freeze({
        ...state,
        "current_player": Havannah.next_player(state.current_player)
    });
};

/**
 * Returns the token at cell (q, r), or 0 if the cell is empty.
 *
 * @memberof Havannah
 * @function
 * @param {number} q             Axial q coordinate.
 * @param {number} r             Axial r coordinate.
 * @param {Havannah.Board} board
 * @returns {Havannah.Token_or_empty}
 */
Havannah.get_cell = function (q, r, board) {
    return (board[`${q},${r}`] || 0);
};

/**
 * Places a stone for the given player at (q, r) and returns the new board.
 * Returns undefined if the move is illegal:
 *   – the coordinate is off the board, or
 *   – the cell is already occupied.
 *
 * This function does not enforce turn order or check for a winner.
 * Use {@link Havannah.place} for a full state transition.
 *
 * @memberof Havannah
 * @function
 * @param {(1|2)}          player
 * @param {number}         q
 * @param {number}         r
 * @param {Havannah.Board} board
 * @returns {Havannah.Board|undefined}
 */
Havannah.place_stone = function (player, q, r, board) {
    if (!is_on_board(q, r)) {
        return undefined;
    }
    if (board[`${q},${r}`] !== undefined) {
        return undefined;
    }
    return Object.freeze({
        ...board,
        [`${q},${r}`]: player
    });
};

/**
 * Applies a complete turn: places the current player's stone at (q, r),
 * checks for a win condition, then advances to the next player.
 *
 * Returns undefined if:
 *   – the move is illegal (off-board or occupied cell), or
 *   – the game has already been won.
 *
 * @memberof Havannah
 * @function
 * @param {Havannah.State} state
 * @param {number}         q
 * @param {number}         r
 * @returns {Havannah.State|undefined}
 */
Havannah.place = function (state, q, r) {
    if (state.winner !== undefined) {
        return undefined;
    }

    const new_board = Havannah.place_stone(
        state.current_player,
        q,
        r,
        state.board
    );

    if (new_board === undefined) {
        return undefined;
    }

    const win_info = check_win(new_board, q, r);

    return Object.freeze({
        "board":          new_board,
        "current_player": Havannah.next_player(state.current_player),
        "winner":         win_info
    });
};

/**
 * Returns every direct neighbour of (q, r) that holds the same player token.
 * Used by the UI to draw the connection-highlight overlay.
 *
 * @memberof Havannah
 * @function
 * @param {Havannah.State} state
 * @param {number}         q
 * @param {number}         r
 * @returns {Havannah.Coord[]}
 */
Havannah.check_adjacent = function (state, q, r) {
    const player = Havannah.get_cell(q, r, state.board);
    if (player === 0) {
        return [];
    }
    return R.filter(
        function (coord) {
            return Havannah.get_cell(coord[0], coord[1], state.board) === player;
        },
        get_neighbors(q, r)
    );
};

/**
 * Returns all cells connected to (q, r) by a chain of same-player stones.
 * Exposes the internal BFS as a public utility for the UI overlay.
 *
 * @memberof Havannah
 * @function
 * @param {Havannah.Board} board
 * @param {number}         q
 * @param {number}         r
 * @returns {string[]}  "q,r" strings for every cell in the connected group.
 */
Havannah.get_connected_group = function (board, q, r) {
    return get_connected_group(board, q, r);
};

export default Object.freeze(Havannah);
