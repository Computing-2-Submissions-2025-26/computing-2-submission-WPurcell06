/**
 * Havannah game engine.
 * @namespace Havannah
 */
import R from "./ramda.js";

const Havannah = Object.create(null);

/**
 * The size of the board (base-4).
 * @constant {number}
 */
const BOARD_SIZE = 4;

/**
 * Checks if a coordinate is within the board boundaries.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {boolean} True if the coordinate is valid.
 */
const is_on_board = function (q, r) {
    const n = BOARD_SIZE - 1;
    return (
        Math.abs(q) <= n &&
        Math.abs(r) <= n &&
        Math.abs(q + r) <= n
    );
};

/**
 * Returns the neighbors of a given coordinate.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {Array<[number, number]>} Array of [q, r] neighbor pairs.
 */
const get_neighbors = function (q, r) {
    return [
        [q + 1, r], [q - 1, r],
        [q, r + 1], [q, r - 1],
        [q + 1, r - 1], [q - 1, r + 1]
    ].filter(function ([nq, nr]) {
        return is_on_board(nq, nr);
    });
};

/**
 * Generates a list of all valid coordinates for the board.
 * @returns {Array<[number, number]>} Array of [q, r] pairs.
 */
Havannah.get_all_coords = function () {
    const n = BOARD_SIZE - 1;
    const coords = [];
    for (let q = -n; q <= n; q += 1) {
        for (let r = -n; r <= n; r += 1) {
            if (is_on_board(q, r)) {
                coords.push([q, r]);
            }
        }
    }
    return coords;
};

/**
 * Returns an empty board.
 * @returns {Object} A new empty board object.
 */
Havannah.new_board = function () {
    return Object.freeze(Object.create(null));
};

/**
 * Returns a new initial game state.
 * @memberof Havannah
 * @returns {Object} The starting state.
 */
Havannah.new_game = function () {
    return Object.freeze({
        "board": Havannah.new_board(),
        "currentPlayer": 1
    });
};

/**
 * Returns the opponent of the given player.
 * @memberof Havannah
 * @param {number} player The current player (1 or 2).
 * @returns {number} The next player (2 or 1).
 */
Havannah.next_player = function (player) {
    return (player === 1 ? 2 : 1);
};

/**
 * Returns a new game state with the player toggled.
 * @memberof Havannah
 * @param {Object} state The current game state.
 * @returns {Object} The new game state.
 */
Havannah.next_turn = function (state) {
    return Object.freeze({
        ...state,
        "currentPlayer": Havannah.next_player(state.currentPlayer)
    });
};

/**
 * Returns a new board with a stone placed at the given coordinates.
 * @memberof Havannah
 * @param {number} player 1 or 2.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @param {Object} board The current board object.
 * @returns {Object|undefined} A new board object or undefined if illegal.
 */
Havannah.place_stone = function (player, q, r, board) {
    if (!is_on_board(q, r) || board[`${q},${r}`] !== undefined) {
        return undefined;
    }

    return Object.freeze({
        ...board,
        [`${q},${r}`]: player
    });
};

/**
 * Returns the stone at a given coordinate.
 * @memberof Havannah
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @param {Object} board The board object.
 * @returns {number} 0 (empty), 1, or 2.
 */
Havannah.get_cell = function (q, r, board) {
    return board[`${q},${r}`] || 0;
};

/**
 * Checks if a coordinate is a corner of the board.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {boolean} True if the coordinate is a corner.
 */
const is_corner = function (q, r) {
    const n = BOARD_SIZE - 1;
    const corners = [
        [0, n], [n, 0], [n, -n],
        [0, -n], [-n, 0], [-n, n]
    ];
    return R.any(R.equals([q, r]), corners);
};

/**
 * Returns which edge a coordinate belongs to, excluding corners.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {number|undefined} Edge index (0-5) or undefined if not an edge.
 */
const get_edge = function (q, r) {
    if (is_corner(q, r)) {
        return undefined;
    }
    const n = BOARD_SIZE - 1;
    if (r === n) {
        return 0; // Top
    }
    if (q + r === n) {
        return 1; // Top-right
    }
    if (q === n) {
        return 2; // Right
    }
    if (r === -n) {
        return 3; // Bottom
    }
    if (q + r === -n) {
        return 4; // Bottom-left
    }
    if (q === -n) {
        return 5; // Left
    }
    return undefined;
};

/**
 * Checks for a Ring win condition.
 * A Ring is a closed loop surrounding at least one cell.
 * @param {Object} board The board object.
 * @param {number} player 1 or 2.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {boolean} True if a ring is formed.
 */
const check_ring = function (board, player, q, r) {
    // Find all cells (empty or opponent) not reachable from outside.
    // If a move creates a new "captured" region, it's a ring.
    // For simplicity, we can check if any empty/opponent neighbor of (q,r)
    // is now part of an enclosed region.

    const neighbors = get_neighbors(q, r);
    const non_player_neighbors = neighbors.filter(function ([nq, nr]) {
        return Havannah.get_cell(nq, nr, board) !== player;
    });

    const is_enclosed = function (start_q, start_r) {
        const recur = function (queue, visited) {
            if (queue.length === 0) {
                return true; // Enclosed!
            }
        const curr_q = queue[0][0];
        const curr_r = queue[0][1];
        const curr_neighbors = get_neighbors(curr_q, curr_r);

        // If we touch the boundary, it's not enclosed.
        // Boundary means having fewer than 6 neighbors.
        if (curr_neighbors.length < 6) {
            return false;
        }

            const targets = curr_neighbors.filter(function (neighbor) {
                const nq = neighbor[0];
                const nr = neighbor[1];
                const key = `${nq},${nr}`;
                return (
                    Havannah.get_cell(nq, nr, board) !== player &&
                    !visited.includes(key) &&
                    !R.any(R.equals([nq, nr]), queue)
                );
            });

            return recur(
                R.concat(R.drop(1, queue), targets),
                R.append(`${curr_q},${curr_r}`, visited)
            );
        };
        return recur([[start_q, start_r]], []);
    };

    return R.any(function ([nq, nr]) {
        return is_enclosed(nq, nr);
    }, non_player_neighbors);
};

/**
 * Checks if the last move won the game.
 * @param {Object} board The board object.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {Object|undefined} Win info or undefined.
 */
const check_win = function (board, q, r) {
    const player = Havannah.get_cell(q, r, board);
    const group = get_connected_group(board, q, r);

    // Bridge: 2+ corners
    const corners_hit = R.pipe(
        R.map(function (key) {
            const parts = key.split(",");
            return is_corner(Number(parts[0]), Number(parts[1]));
        }),
        R.filter(R.identity),
        R.length
    )(group);

    if (corners_hit >= 2) {
        return { "type": "Bridge", player, group };
    }

    // Fork: 3+ edges
    const edges_hit = R.pipe(
        R.map(function (key) {
            const parts = key.split(",");
            return get_edge(Number(parts[0]), Number(parts[1]));
        }),
        R.reject(R.isNil),
        R.uniq,
        R.length
    )(group);

    if (edges_hit >= 3) {
        return { "type": "Fork", player, group };
    }

    // Ring: closed loop
    if (check_ring(board, player, q, r)) {
        return { "type": "Ring", player, group };
    }

    return undefined;
};

/**
 * Returns a new game state with a stone placed.
 * @memberof Havannah
 * @param {Object} state The current game state.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {Object|undefined} The new game state or undefined if illegal.
 */
Havannah.place = function (state, q, r) {
    if (state.winner !== undefined) {
        return undefined;
    }

    const new_board = Havannah.place_stone(
        state.currentPlayer,
        q,
        r,
        state.board
    );

    if (new_board === undefined) {
        return undefined;
    }

    const win_info = check_win(new_board, q, r);

    return Object.freeze({
        "board": new_board,
        "currentPlayer": Havannah.next_player(state.currentPlayer),
        "winner": win_info
    });
};

/**
 * Returns a set of all coordinates connected to the given one (same player).
 * Uses a pure functional BFS approach.
 * @param {Object} board The board object.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {Array<string>} Array of "q,r" coordinate strings in the group.
 */
const get_connected_group = function (board, q, r) {
    const player = Havannah.get_cell(q, r, board);
    if (player === 0) {
        return [];
    }

    const recur = function (queue, visited) {
        if (queue.length === 0) {
            return visited;
        }

        const curr_q = queue[0][0];
        const curr_r = queue[0][1];
        const neighbors = get_neighbors(curr_q, curr_r);

        const new_neighbors = R.filter(function (neighbor) {
            const nq = neighbor[0];
            const nr = neighbor[1];
            const n_key = `${nq},${nr}`;
            return (
                Havannah.get_cell(nq, nr, board) === player &&
                !visited.includes(n_key) &&
                !R.any(R.equals([nq, nr]), queue)
            );
        }, neighbors);

        return recur(
            R.concat(R.drop(1, queue), new_neighbors),
            R.append(`${curr_q},${curr_r}`, visited)
        );
    };

    return recur([[q, r]], []);
};

/**
 * Returns which of the adjacent tiles are connected (same player).
 * @memberof Havannah
 * @param {Object} state The current game state.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {Array<[number, number]>} List of adjacent connected tiles.
 */
Havannah.checkAdjacent = function (state, q, r) {
    const player = Havannah.get_cell(q, r, state.board);
    if (player === 0) {
        return [];
    }

    const neighbors = get_neighbors(q, r);
    return neighbors.filter(function ([nq, nr]) {
        return Havannah.get_cell(nq, nr, state.board) === player;
    });
};

/**
 * Returns a set of all coordinates connected to the given one (same player).
 * @memberof Havannah
 * @param {Object} board The board object.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {Array<string>} Array of "q,r" coordinate strings in the group.
 */
Havannah.get_connected_group = function (board, q, r) {
    return get_connected_group(board, q, r);
};

export default Object.freeze(Havannah);

