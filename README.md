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

1. Each card holds 8 values (one per direction), forming a **permutation of 1–8** — no duplicates.
2. Moving in a direction for the first time **locks** that dimension to the current card's value.
3. All cards matching every locked constraint form a **loop pool**. Keep moving to cycle through it.
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

## Algorithm Properties

| Property | Guarantee |
|----------|-----------|
| Monotonic accumulation | \|L\| only increases (unless FIFO unlock fires) |
| Max constraints | \|L\| ≤ 8 |
| No dead ends | FIFO unlock ensures P ≠ ∅ as long as \|C\| > 1 |
| Cyclic navigation | Finite pool → loops back to start |
| Permutation constraint | A(c, ·) is a bijection → no duplicate values per card |

## Open Questions

- Should dimension semantics be fixed by the product or dynamically generated per dataset?
- Can values support fuzzy matching (e.g., ±1 tolerance) for richer pools on small datasets?
- How to auto-assign directional scores via AI (e.g., CLIP embeddings)?

## License

[MIT](LICENSE)
