/*jslint browser */
import R        from "./ramda.js";
import Havannah from "./Havannah.js";

// ── DOM references ───────────────────────────────────────────────────────────

const board_container  = document.getElementById("havannah-board");
const debug_button     = document.getElementById("debug-toggle");
const modal_overlay    = document.getElementById("modal-overlay");
const win_message      = document.getElementById("win-message");
const win_detail       = document.getElementById("win-detail");
const view_board_btn   = document.getElementById("view-board-button");
const restart_btn      = document.getElementById("restart-button");

// ── Mutable UI state ─────────────────────────────────────────────────────────

let game_state = Havannah.new_game();
let debug_mode = false;

// ── Debug mode toggle ────────────────────────────────────────────────────────

/**
 * Toggles debug mode on/off.
 * When debug mode is active, clicking a hex logs its connected group
 * to the console instead of placing a stone.
 */
const toggle_debug = function () {
    debug_mode = !debug_mode;
    debug_button.textContent = (
        debug_mode
        ? "Debug Mode: ON"
        : "Debug Mode: OFF"
    );
    debug_button.classList.toggle("active");
};

debug_button.addEventListener("click", toggle_debug);

// ── Hex tile creation ────────────────────────────────────────────────────────

/**
 * Creates one hexagonal SVG tile for cell (q, r) and wires up its click
 * handler.  The tile is a <g> element containing a <polygon>.
 *
 * Geometry: flat-top orientation.
 *   pixel-x = size * 1.5 * q
 *   pixel-y = size * (sqrt(3)/2 * q  +  sqrt(3) * r)
 *
 * @param {number} q  Axial q coordinate.
 * @param {number} r  Axial r coordinate.
 * @returns {SVGGElement}
 */
const create_hex = function (q, r) {
    const size  = 50;
    const sqrt3 = Math.sqrt(3);
    const width = size * sqrt3;

    // Convert axial coords to SVG pixel position (flat-top hex orientation).
    const pixel_x = size * (1.5 * q);
    const pixel_y = size * ((sqrt3 / 2) * q + sqrt3 * r);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("hex");
    g.dataset.q = q;
    g.dataset.r = r;
    g.setAttribute("tabindex", "0");
    g.setAttribute("transform", `translate(${pixel_x}, ${pixel_y})`);

    g.addEventListener("click", function () {
        if (debug_mode) {
            // Debug mode: log connection info instead of placing a stone.
            const stone = Havannah.get_cell(q, r, game_state.board);
            console.log(`DEBUG [q:${q}, r:${r}] player: ${stone}`);
            if (stone !== 0) {
                const adjacent = Havannah.check_adjacent(game_state, q, r);
                const group    = Havannah.get_connected_group(
                    game_state.board,
                    q,
                    r
                );
                console.log("Adjacent same-colour:", JSON.stringify(adjacent));
                console.log("Full connected group:", JSON.stringify(group));
            }
            return;
        }

        // Normal play: try to place the current player's stone.
        const next_state = Havannah.place(game_state, q, r);

        if (next_state !== undefined) {
            // Add the CSS class for the player who just moved
            // (use game_state, not next_state, because game_state still holds
            // the player who clicked).
            const player_class = `player${game_state.current_player}`;
            g.classList.add(player_class);

            game_state       = next_state;
            window.game_state = game_state;

            if (game_state.winner !== undefined) {
                // Highlight every stone in the winning group.
                R.forEach(function (coord_key) {
                    const parts = coord_key.split(",");
                    const el = document.querySelector(
                        `[data-q="${parts[0]}"][data-r="${parts[1]}"]`
                    );
                    if (el) {
                        el.classList.add("winner");
                    }
                }, game_state.winner.group);

                // Show the win modal.
                win_message.textContent = (
                    `Player ${game_state.winner.player} Wins!`
                );
                win_detail.textContent = (
                    `Condition: ${game_state.winner.type}`
                );
                modal_overlay.classList.remove("hidden");
            }
        }
    });

    // Flat-top hexagon: six vertices relative to the tile's centre.
    const points = R.pipe(
        R.map(R.join(",")),
        R.join(" ")
    )([
        [-size,      0         ],
        [-size / 2, -width / 2 ],
        [ size / 2, -width / 2 ],
        [ size,      0         ],
        [ size / 2,  width / 2 ],
        [-size / 2,  width / 2 ]
    ]);

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", points);
    g.appendChild(polygon);

    return g;
};

// ── Board rendering ──────────────────────────────────────────────────────────

/**
 * Creates and appends one hex tile for every cell on the board.
 * Called once at startup.
 */
const render_board = function () {
    R.forEach(function (coord) {
        const hex = create_hex(coord[0], coord[1]);
        board_container.appendChild(hex);
    }, Havannah.get_all_coords());
};

// ── Restart ──────────────────────────────────────────────────────────────────

/**
 * Resets the game to its initial state and clears all visual classes
 * from every hex tile.
 */
const restart_game = function () {
    game_state        = Havannah.new_game();
    window.game_state = game_state;
    modal_overlay.classList.add("hidden");

    R.forEach(function (hex) {
        hex.classList.remove("player1", "player2", "winner");
    }, Array.from(document.querySelectorAll(".hex")));
};

restart_btn.addEventListener("click", restart_game);

view_board_btn.addEventListener("click", function () {
    modal_overlay.classList.add("hidden");
});

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
    render_board();

    // Expose to the browser console for manual testing / debugging.
    window.Havannah  = Havannah;
    window.game_state = game_state;
});
