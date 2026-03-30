# DCL — Directional Constraint Locking

> **[繁體中文版 README](README.zh.md)**

A spatial-movement-driven multidimensional filtering algorithm.

Instead of setting filter criteria upfront, users **navigate in 8 directions** on a 2D canvas. Each movement locks a dimension's value; locked constraints accumulate, forming a multi-dimensional intersection query defined entirely by movement trajectory.

**Core idea: "Where you go is what you filter."**

## How It Works

```
     ↖  ↑  ↗
      \ | /
   ←  ─ ● ─  →
      / | \
     ↙  ↓  ↘
```

1. Each card holds **8 distinct values drawn from {1…N}** (N configurable, default 8; one per direction) — no duplicates. When N = 8, this is a full permutation; when N > 8, it is a partial permutation P(N,8).
2. Moving in a direction for the first time **locks** that dimension to the current card's value.
3. All cards matching every locked constraint form a **candidate pool**. Keep moving to randomly pick from it.
4. Constraints only accumulate (up to 8). When no cards satisfy all constraints, the **oldest lock is released first** (FIFO unlock), guaranteeing you never hit a dead end.

## Quick Example

```
Start: Card A  {→:8, ↑:7, ↗:6, ←:3, ↓:4, ↖:2, ↘:5, ↙:1}

Step 1: Move → → Lock →=8
        Pool: all cards where →=8 → enter Card B

Step 2: Move ↑ → Lock ↑=7 (Card B's ↑ value)
        Pool: →=8 AND ↑=7 → narrower set

Step 3: Move ↗ → Lock ↗=...
        Pool: →=8 AND ↑=7 AND ↗=? → even narrower
```

## Live Demo

Try the interactive demo: **[reidevbx.github.io/dcl](https://reidevbx.github.io/dcl)** (or run locally — see below).

Available in [English](https://reidevbx.github.io/dcl) and [繁體中文](https://reidevbx.github.io/dcl/zh/).

## Documentation

| Document | EN | 中文 |
|----------|----|----|
| Algorithm Specification | [specification.md](docs/en/specification.md) | [specification.md](docs/zh/specification.md) |
| Concept Document | [concept.md](docs/en/concept.md) | [concept.md](docs/zh/concept.md) |

## Run Locally

The demo is a single static HTML file with zero dependencies.

```bash
# Clone
git clone https://github.com/reidevbx/dcl.git
cd dcl

# Serve (any static server works)
npx serve public
# or
python3 -m http.server -d public 8000
```

Open `http://localhost:8000` (or `3000` for `serve`).

## Deploy

Deployed via [GitHub Pages](https://pages.github.com). Push to `main` triggers automatic deployment through GitHub Actions.

To enable: go to repo **Settings > Pages > Source**, select **GitHub Actions**.

## Project Structure

```
dcl/
├── public/
│   ├── index.html        # Interactive demo (EN)
│   ├── zh/index.html     # Interactive demo (繁中)
│   ├── style.css         # Shared styles
│   ├── dcl.js            # Core algorithm (zero DOM dependencies)
│   └── demo.js           # UI rendering layer
├── docs/
│   ├── en/
│   │   ├── specification.md
│   │   └── concept.md
│   └── zh/
│       ├── specification.md
│       └── concept.md
├── .github/workflows/
│   └── deploy.yml        # GitHub Pages deployment
├── package.json
├── LICENSE
├── README.md             # English (this file)
└── README.zh.md          # 繁體中文
```

## Potential Applications

- **Fashion exploration**: dimensions = silhouette, color tone, style, occasion, ...
- **Music discovery**: rhythm, mood, instrument, era, ...
- **Product curation**: material, price range, aesthetic, brand, ...
- **Inspiration boards**: free-form drifting through visual style space
- Any scenario requiring multidimensional exploration without complex filter UIs

## Plugin System

DCL supports an opt-in plugin architecture. Plugins extend the engine without altering the core algorithm.

```js
var engine = DCL.create({ cardCount: 100, categories: 20 });

// Opt-in: enable the memory plugin
DCL.use(engine, 'memory');

engine.navigate('right');   // lock right dimension
engine.navigate('up');      // lock up dimension
engine.navigate('down');    // opposite of up → auto-undo back
engine.navigate('left');    // opposite of right → auto-undo back to start
engine.canUndo();           // true / false
```

### Built-in Plugins

| Plugin | Methods Added | Description |
|--------|--------------|-------------|
| `memory` | `undo()`, `redo()`, `canUndo()`, `canRedo()`, `peek(dir)`, `peekAll()` | Full path backtracking. Moving in the opposite direction auto-undoes. The entire path is retraced step by step — not just the last move. Lock state is fully restored on each undo. |

### Custom Plugins

```js
DCL.register('myPlugin', function (engine, priv) {
  // wrap or extend engine methods
  // priv contains internal helpers (e.g., priv.setState)
});
DCL.use(engine, 'myPlugin');
```

## Algorithm Properties

| Property | Guarantee |
|----------|-----------|
| Monotonic accumulation | \|L\| only increases (unless FIFO unlock fires) |
| Max constraints | \|L\| ≤ 8 |
| No dead ends | FIFO unlock ensures P ≠ ∅ as long as \|C\| > 1 |
| Random navigation | Finite pool → randomly selects each time |
| Selection constraint | A(c, ·) selects 8 distinct values from {1…N} → no duplicate values per card |

## Open Questions

- Should dimension semantics be fixed by the product or dynamically generated per dataset?
- Can values support fuzzy matching (e.g., ±1 tolerance) for richer pools on small datasets?
- How to auto-assign directional scores via AI (e.g., CLIP embeddings)?

## License

[MIT](LICENSE)
