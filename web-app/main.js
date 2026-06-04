/*jslint browser */
import R from "./ramda.js";
import Havannah from "./Havannah.js";

const board_container = document.getElementById("havannah-board");
const debug_button = document.getElementById("debug-toggle");
const modal_overlay = document.getElementById("modal-overlay");
const win_message = document.getElementById("win-message");
const win_detail = document.getElementById("win-detail");
const view_board_button = document.getElementById("view-board-button");
const restart_button = document.getElementById("restart-button");

let gameState = Havannah.new_game();
let debug_mode = false;

/**
 * Toggles the debug mode.
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

/**
 * Creates a hexagonal tile element.
 * @param {number} q Axial q coordinate.
 * @param {number} r Axial r coordinate.
 * @returns {SVGElement} The hexagon group element.
 */
const create_hex = function (q, r) {
    const size = 50;
    const sqrt3 = Math.sqrt(3);
    const width = size * sqrt3;

    // Axial to Pixel conversion (Flat-top orientation)
    const x = size * (1.5 * q);
    const y = size * ((sqrt3 / 2) * q + sqrt3 * r);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("hex");
    g.dataset.q = q;
    g.dataset.r = r;
    g.setAttribute("transform", `translate(${x}, ${y})`);

    g.addEventListener("click", function () {
        if (debug_mode) {
            const stone = Havannah.get_cell(q, r, gameState.board);
            const connected = Havannah.checkAdjacent(gameState, q, r);
            console.log(`DEBUG: [q:${q}, r:${r}] | Player: ${stone}`);
            if (stone !== 0) {
                const group = Havannah.get_connected_group(gameState.board, q, r);
                console.log(`Connected neighbors: ${JSON.stringify(connected)}`);
                console.log(`Full connected group: ${JSON.stringify(group)}`);
            }
            return;
        }

        const nextState = Havannah.place(gameState, q, r);
        if (nextState !== undefined) {
            const playerClass = `player${gameState.currentPlayer}`;
            g.classList.add(playerClass);
            gameState = nextState;
            window.gameState = gameState;

            if (gameState.winner !== undefined) {
                // Highlight winning group
                R.forEach(function (coord_key) {
                    const parts = coord_key.split(",");
                    const el = document.querySelector(
                        `[data-q="${parts[0]}"][data-r="${parts[1]}"]`
                    );
                    if (el) {
                        el.classList.add("winner");
                    }
                }, gameState.winner.group);

                // Show modal
                win_message.textContent = `Player ${gameState.winner.player} Wins!`;
                win_detail.textContent = `Condition: ${gameState.winner.type}`;
                modal_overlay.classList.remove("hidden");
            }
        }
    });

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    // Points for a flat-top hexagon centered at (0,0)
    const points = R.pipe(
        R.map(R.join(",")),
        R.join(" ")
    )([
        [-size, 0],
        [-size / 2, -width / 2],
        [size / 2, -width / 2],
        [size, 0],
        [size / 2, width / 2],
        [-size / 2, width / 2]
    ]);

    polygon.setAttribute("points", points);
    g.appendChild(polygon);

    return g;
};

/**
 * Renders the game board.
 */
const render_board = function () {
    const coords = Havannah.get_all_coords();
    R.forEach(function (coord) {
        const q = coord[0];
        const r = coord[1];
        const hex = create_hex(q, r);
        board_container.appendChild(hex);
    }, coords);
};

/**
 * Restarts the game.
 */
const restart_game = function () {
    gameState = Havannah.new_game();
    window.gameState = gameState;
    modal_overlay.classList.add("hidden");
    
    // Clear the board
    const hexes = document.querySelectorAll(".hex");
    R.forEach(function (hex) {
        hex.classList.remove("player1", "player2", "winner");
    }, hexes);
};

restart_button.addEventListener("click", restart_game);

view_board_button.addEventListener("click", function () {
    modal_overlay.classList.add("hidden");
});

document.addEventListener("DOMContentLoaded", function () {
    render_board();
    // Expose Havannah and gameState to the window for console debugging
    window.Havannah = Havannah;
    window.gameState = gameState;
});
