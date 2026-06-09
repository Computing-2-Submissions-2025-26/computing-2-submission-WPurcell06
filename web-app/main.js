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

// ── Focus overlay ─────────────────────────────────────────────────────────────
//
// SVG has no z-index — elements paint in document order, so a later element
// always appears on top of an earlier one.  We want the keyboard-focus ring to
// paint over the black borders of every neighbouring tile.
//
// Approach: create a single <g id="focus-overlay"> that lives permanently at
// the END of the SVG.  When a hex receives keyboard focus we copy its transform
// onto the overlay so the ring polygon appears at that position.  Because the
// overlay is always last in the SVG it always paints on top of all hex borders.
//
// This replaces the earlier approach of moving the focused <g> tile to the end
// of the SVG, which corrupted Tab order because Tab follows DOM document order.

const HEX_SIZE  = 50;
const HEX_WIDTH = HEX_SIZE * Math.sqrt(3);

// Shared hexagon vertex list (flat-top, relative to tile centre).
const hex_points = R.pipe(
    R.map(R.join(",")),
    R.join(" ")
)([
    [-HEX_SIZE,          0          ],
    [-HEX_SIZE / 2, -HEX_WIDTH / 2 ],
    [ HEX_SIZE / 2, -HEX_WIDTH / 2 ],
    [ HEX_SIZE,          0          ],
    [ HEX_SIZE / 2,  HEX_WIDTH / 2 ],
    [-HEX_SIZE / 2,  HEX_WIDTH / 2 ]
]);

const focus_overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
focus_overlay.setAttribute("id", "focus-overlay");

const focus_ring = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
focus_ring.setAttribute("class", "focus-ring");
focus_ring.setAttribute("points", hex_points);
focus_overlay.appendChild(focus_ring);

// ── Hex tile creation ────────────────────────────────────────────────────────

/**
 * Creates one hexagonal SVG tile for cell (q, r) and wires up its handlers.
 * The tile is a <g> element containing a <polygon>.
 *
 * Geometry: flat-top orientation.
 *   pixel-x = size × 1.5 × q
 *   pixel-y = size × (√3/2 × q  +  √3 × r)
 *
 * @param {number} q  Axial q coordinate.
 * @param {number} r  Axial r coordinate.
 * @returns {SVGGElement}
 */
const create_hex = function (q, r) {
    // Convert axial coords to SVG pixel position (flat-top hex orientation).
    const pixel_x = HEX_SIZE * (1.5 * q);
    const pixel_y = HEX_SIZE * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("hex");
    g.dataset.q = q;
    g.dataset.r = r;
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", `Cell (${q}, ${r})`);
    g.setAttribute("transform", `translate(${pixel_x}, ${pixel_y})`);

    // Shared handler for both click and keyboard activation (Enter / Space).
    const handle_action = function () {
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
            // Read the placing player BEFORE updating game_state.
            const player_class = `player${game_state.current_player}`;
            g.classList.add(player_class);

            game_state        = next_state;
            window.game_state = game_state;

            if (game_state.winner !== undefined) {
                // Highlight every stone in the winning group.
                // Move each winner tile to the end of the SVG so its yellow
                // stroke paints over all neighbouring black borders.
                R.forEach(function (coord_key) {
                    const parts = coord_key.split(",");
                    const el = document.querySelector(
                        `[data-q="${parts[0]}"][data-r="${parts[1]}"]`
                    );
                    if (el) {
                        el.classList.add("winner");
                        board_container.appendChild(el); // paint last → on top
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
    };

    g.addEventListener("click", handle_action);

    // Keyboard activation: Enter places a stone; Space also places but we
    // must prevent the default scroll behaviour that Space normally triggers.
    g.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handle_action();
        }
    });

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", hex_points);
    g.appendChild(polygon);

    return g;
};

// ── Board rendering ──────────────────────────────────────────────────────────

/**
 * Creates and appends one hex tile for every cell on the board, then appends
 * the focus overlay as the very last SVG element so it always paints on top.
 * Called once at start-up and again after each restart.
 */
const render_board = function () {
    R.forEach(function (coord) {
        board_container.appendChild(create_hex(coord[0], coord[1]));
    }, Havannah.get_all_coords());

    // Focus overlay must be last so it renders over all hex tile borders.
    board_container.appendChild(focus_overlay);
};

// ── Restart ──────────────────────────────────────────────────────────────────

/**
 * Resets the game to its initial state.
 *
 * We cannot simply strip CSS classes: the win-highlight code moves winner tiles
 * to the end of the SVG to fix paint order, so they would still render on top
 * in the next game.  Clearing the SVG and re-rendering from scratch guarantees
 * a clean document order.
 */
const restart_game = function () {
    game_state        = Havannah.new_game();
    window.game_state = game_state;
    modal_overlay.classList.add("hidden");

    // Dismiss any lingering focus ring before clearing the SVG.
    focus_ring.classList.remove("active");

    // Remove every child of the SVG and rebuild from scratch.
    while (board_container.firstChild) {
        board_container.removeChild(board_container.firstChild);
    }
    render_board();
};

restart_btn.addEventListener("click", restart_game);

view_board_btn.addEventListener("click", function () {
    modal_overlay.classList.add("hidden");
});

// ── Keyboard focus ring ───────────────────────────────────────────────────────
//
// We want the yellow ring only for keyboard navigation (Tab), not mouse clicks.
// CSS :focus-visible does this correctly in CSS, but querying it from inside a
// JS focusin handler is unreliable: the browser resolves :focus-visible AFTER
// the focusin event fires, so element.matches(":focus-visible") returns false
// even when Tab was the trigger.
//
// Solution: mirror the browser's own heuristic with a boolean flag.  Any
// keydown sets it true; any mousedown clears it.  The focusin handler then
// reads the flag — this is synchronously accurate because keydown always fires
// before the focusin that results from it.

let keyboard_navigation_active = false;

document.addEventListener("keydown", function () {
    keyboard_navigation_active = true;
});

document.addEventListener("mousedown", function () {
    keyboard_navigation_active = false;
});

// When a hex receives keyboard focus, position the overlay over it and show it.
// Because the overlay is the last element in the SVG it renders on top of all
// borders without moving any hex tile — Tab order is completely undisturbed.
board_container.addEventListener("focusin", function (event) {
    if (!keyboard_navigation_active) {
        return; // Mouse-initiated focus — no ring wanted.
    }
    const hex = event.target.closest(".hex");
    if (hex) {
        focus_overlay.setAttribute("transform", hex.getAttribute("transform"));
        focus_ring.classList.add("active");
    }
});

// Hide the ring when keyboard focus leaves the board area.
board_container.addEventListener("focusout", function (event) {
    if (event.target.closest(".hex")) {
        focus_ring.classList.remove("active");
    }
});

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
    render_board();

    // Expose to the browser console for manual testing / debugging.
    window.Havannah   = Havannah;
    window.game_state = game_state;
});
