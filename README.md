[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/H6lPFq0J)
# Havannah

**CID: 02556131**

A web implementation of the abstract strategy game Havannah, built for the
Computing 2: Applications module at Imperial College London (2025/26).

---

## Quick start

```bash
npm install       # install dependencies (Ramda, Vite, Mocha, docdash)
npm run dev       # start the Vite dev server → open http://localhost:5173
npm test          # run the Mocha unit test suite
```

---

## The game

Havannah is a two-player abstract strategy game played on a hexagonal grid.
Players alternate placing one stone per turn on any empty cell.
The first player to complete **any one** of the following three structures wins:

| Structure  | Description |
|------------|-------------|
| **Ring**   | A closed loop of stones that encloses at least one cell (which may be occupied or empty). |
| **Bridge** | A connected chain linking any two of the six corner cells. |
| **Fork**   | A connected chain linking any three of the six sides. Corners are *not* counted as part of any side. |

---

## How the hexagonal grid works

### Axial coordinates

The board uses **axial coordinates (q, r)** — two axes inclined at 60° to each
other rather than the 90° of a square grid.  A cell is on the board when:

```
|q| ≤ n   AND   |r| ≤ n   AND   |q+r| ≤ n
```

where `n = BOARD_SIZE − 1`.  This implementation uses `BOARD_SIZE = 4`,
giving `n = 3` and **37 cells** in total.  The board centre is `(0, 0)`.

### The six neighbours of any cell

In axial coordinates, the six neighbours of `(q, r)` are always exactly the
same offsets regardless of position:

```
(q+1, r)   (q-1, r)
(q, r+1)   (q, r-1)
(q+1,r-1)  (q-1,r+1)
```

This makes neighbour look-ups O(1) and keeps the BFS code simple.

### Board representation

The board is a plain JavaScript object keyed by `"q,r"` strings.
Only occupied cells appear as keys — empty cells are simply absent.

```js
// Example: player 1 at the centre, player 2 to the right
{ "0,0": 1, "1,0": 2 }
```

`Havannah.get_cell(q, r, board)` returns `0` for any absent key.

### Corners and edges (n = 3)

**Corners** (6 cells):
```
(-3,3)   (0,3)   (3,0)   (3,-3)   (0,-3)   (-3,0)
```

**Edge conditions** (corners excluded from every edge):

| Edge        | Condition  |
|-------------|------------|
| Top         | `r = 3`    |
| Top-right   | `q+r = 3`  |
| Right       | `q = 3`    |
| Bottom      | `r = -3`   |
| Bottom-left | `q+r = -3` |
| Left        | `q = -3`   |

---

## Win detection — how it works

After every stone is placed, `Havannah.place` does the following:

**1. BFS** — a recursive breadth-first search builds the *connected group*: every
stone of the same colour reachable from the newly placed stone.

**2. Bridge check** — if the group contains ≥ 2 corner cells → Bridge win.

**3. Fork check** — map each cell in the group to its edge index (0–5); discard
interior cells and corners (they return `undefined`); remove duplicates.
If ≥ 3 distinct edge indices remain → Fork win.

**4. Ring check** — a flood-fill from the board boundary through all
non-player cells.  If any non-player cell is unreachable from the boundary,
it is enclosed by the player's stones → Ring win.

> **Why flood-fill instead of counting edges?**
> The simpler E ≥ N heuristic (extra edges → cycle) fails on hex grids
> because three mutually adjacent stones form a 3-cycle (E = N = 3) yet
> enclose no cell.  Flood-fill is exact: a cell is enclosed if and only if
> it cannot be reached from outside the player's group.

---

## File structure

```
web-app/
├── Havannah.js          Pure game logic.  No DOM access, no side effects.
├── main.js              UI layer.  Reads Havannah.js; updates the DOM.
├── index.html           HTML structure only.  No inline logic or styles.
├── main.css             All styling.  Values as CSS custom properties.
└── tests/
    └── Havannah.test.js  Mocha unit tests (run with: npm test)
```

---

## Controls

| Action | Input |
|--------|-------|
| Place a stone | Click the cell, or focus it with **Tab** then press **Enter** or **Space** |
| Navigate cells | **Tab** / **Shift-Tab** |
| Toggle debug mode | Click the **Debug Mode** button |

A yellow highlight appears around the focused cell during keyboard navigation only; mouse clicks show no highlight.

---

## Unit tests

```bash
npm test
```

The test suite covers:

- **Board geometry** — correct cell count (37), boundary rule holds for all cells
- **New game** — empty board, player 1 first, no winner, structurally valid
- **Placing stones** — valid moves appear on board; occupied/off-board cells
  return `undefined`; turn alternates; placing after a win returns `undefined`
- **Bridge** win — two-corner connection detected; one-corner path is not a win
- **Fork** win — three-edge connection detected; two-edge path is not a win
- **Ring** win — closed hexagonal loop detected; open five-stone chain is not a win
- **Ring edge cases** — three mutually adjacent stones (3-cycle) are *not* a Ring;
  a larger 8-stone loop *is* a Ring
- **Fork edge cases** — a path through a corner instead of a third edge is *not* a
  Fork; a disconnected group touching three edges is *not* a Fork
- **Player 2** — all three win conditions work identically for player 2

---

## Debug mode

Enable **Debug Mode** with the button, then click (or Tab + Enter) any stone
already on the board.  The browser console logs the stone's coordinates, its
direct same-colour neighbours, and its full connected group.

---

## Checklist

### Install dependencies locally
```bash
npm install
```

### Game Module – API
- [x] `web-app/Havannah.js` — JSDoc API with `@typedef`, `@memberof`, `@param`, `@returns`
- [x] `jsdoc.json` points to `Havannah.js`

### Game Module – Implementation
- [x] `Havannah.js` fully implemented with pure functions and Ramda

### Unit Tests – Specification
- [x] `web-app/tests/Havannah.test.js` — behaviour-based descriptions

### Unit Tests – Implementation
- [x] All tests implemented and passing (`npm test`)

### Web Application
- [x] `index.html`
- [x] `main.css`
- [x] `main.js`

### Finally
- [ ] Push to GitHub
- [ ] Sync the changes
- [ ] Check submission on GitHub website
