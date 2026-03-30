# Directional Constraint Locking
## Concept Document

**Version:** v0.5
**Date:** 2026-03-30
**Status:** Proof of concept (Prototype complete)

---

## 1. Concept Summary

Directional Constraint Locking (DCL) is a **multidimensional filtering algorithm driven by spatial movement**.

Instead of configuring filter criteria upfront, users **move in directions** on a 2D canvas to accumulate constraints. Each movement in a new direction locks a dimension value; locked conditions accumulate over time, ultimately forming a multi-dimensional intersection query defined entirely by the movement trajectory.

Core philosophy: **"Where you go is what you filter."**

---

## 2. Formal Definition

### 2.1 Basic Notation

| Symbol | Definition |
|--------|-----------|
| `C` | Set of all cards, \|C\| = n |
| `D` | {↖ ↑ ↗ ← → ↙ ↓ ↘}, 8 directions |
| `N` | Category count (configurable, N ≥ 8, default 8) |
| `A(c, d)` | Card c's attribute value in direction d, A : C × D → {1…N} |
| `L` | Current lock set, L ⊆ D × {1…N} |
| `Q` | Lock-order queue (FIFO), recording the sequence of locked directions |
| `cₜ` | Current card |

**Selection Constraint (Core Rule):**
For each card c, `A(c, ·)` selects **8 distinct values from {1…N}** (a partial permutation P(N,8)).
Each card's 8 directional values are all different — no repeats.
When N = 8, this is a full bijection (permutation); when N > 8, values are drawn from a larger pool.

### 2.2 Candidate Pool Function

```
P(L, cₜ) = { c ∈ C | c ≠ cₜ ∧ ∀(d, v) ∈ L : A(c, d) = v }
```

All cards satisfying every locked constraint, excluding the current card.

### 2.3 Navigation Function nav(d)

```
1. If d ∉ L, lock the current value:
   L ← L ∪ {(d, A(cₜ, d))}
   Q.enqueue(d)

2. Compute the candidate pool:
   P ← P(L, cₜ)

3. If P = ∅, perform FIFO unlock until P ≠ ∅:
   while P = ∅ ∧ Q ≠ ∅:
     d' ← Q.dequeue()
     L  ← L \ {(d', ·)}
     P  ← P(L, cₜ)

4. Random select next card:
   cₜ ← P[random(0, |P|-1)]
```

### 2.4 Algorithm Properties

- **Monotonic accumulation**: |L| only increases, unless FIFO unlock fires
- **Maximum lock count**: |L| ≤ 8 (limited by the number of directions)
- **Deadlock freedom**: As long as |C| > 1, P(∅, cₜ) ≠ ∅ always holds; FIFO unlock guarantees candidates
- **Random navigation**: Under fixed L, each navigation randomly selects from the candidate pool, without guaranteeing complete coverage
- **Selection constraint**: A(c, ·) selects 8 distinct values from {1…N} ⟹ a card cannot have the same value in two directions

---

## 3. Basic Rules (Intuitive Explanation)

### 3.1 Direction-to-Dimension Mapping

The canvas has 8 movement directions, each corresponding to a fixed data dimension:

```
                 [U]
                  |
   [LU]  \        |        /  [RU]
           \      |      /
             \    |    /
               \  |  /
    [L] --------- o --------- [R]
               /  |  \
             /    |    \
           /      |      \
   [LD]  /        |        \  [RD]
                  |
                 [D]
```

Each card holds 8 distinct values drawn from {1…N} (where N is configurable, default 8), one per direction — no repeats across directions.

### 3.2 Locking Mechanism

- The **first time** a user moves in a direction, that dimension's value is locked
- The locked value comes from the **departing card's** value in that direction
- Every subsequent step must satisfy all locked constraints
- Locked conditions **only accumulate**, up to 8 simultaneous dimensions

### 3.3 Constraint Accumulation Example

```
Start: Card A
  {→:8, ↑:7, ↗:6, ←:3, ↓:4, ↖:2, ↘:5, ↙:1}

Step 1: Move → → Lock →=8
  Query: all cards where →=8, enter one (Card B)

Step 2: Move ↑ → Add lock ↑=7 (note: this is Card B's ↑ value)
  Query: →=8 AND ↑=7

Step 3: Move ↗ → Add lock ↗=(Card B's ↗ value)
  Query: →=8 AND ↑=7 AND ↗=?

...and so on, up to 8 simultaneous locks
```

### 3.4 Random Exploration

Cards satisfying the current constraints form a **Candidate Pool**.
Moving continuously in the same direction randomly picks from this pool — you never reach a dead end.

```
Cards where →=8: {A, C, F, H} → randomly pick one each time
```

### 3.5 FIFO Unlock

When the intersection of multiple constraints is empty, the **oldest locked constraint is released first**, continuing until a valid candidate set is found. Release order strictly follows the locking sequence (first in, first out).

---

## 4. Data Structures

### 4.1 Card Node

Each card is a node containing 8 distinct directional values drawn from {1…N} (no repeats):

```json
{
  "id": "photo_001",
  "src": "...",
  "attrs": {
    "right":      8,
    "left":       3,
    "up":         7,
    "down":       4,
    "rightUp":    6,
    "leftUp":     2,
    "rightDown":  5,
    "leftDown":   1
  }
}
```

### 4.2 Navigation State

The user's current navigation state, recording locked constraints and their order:

```json
{
  "current": "photo_001",
  "lockMap": { "right": 8, "up": 7 },
  "lockOrder": ["right", "up"],
  "history": ["photo_003", "photo_007", "photo_001"]
}
```

---

## 5. Comparison with Existing Approaches

| Approach | Similarity | Difference |
|----------|-----------|-----------|
| Faceted Search | Multi-criteria filtering | Criteria are preset, not behavior-driven |
| Graph Traversal | Node-to-node movement | No directional dimension semantics |
| Constraint Satisfaction | Accumulating constraints to find solutions | Not driven by spatial navigation |
| Latent Space Navigation | Semantic space exploration | Requires ML model, opaque internals |
| **DCL (this algorithm)** | — | Behavior = filter; movement = constraint definition; transparent and controllable |

---

## 6. Potential Applications

- **Fashion exploration app**: 8 directions map to silhouette, color tone, style, occasion, etc.
- **Music discovery**: rhythm, mood, instrument, era, etc.
- **Product curation**: material, price range, aesthetic, brand identity, etc.
- **Inspiration boards**: free-form drifting through visual style space
- **Any scenario requiring multidimensional exploration without complex filter UIs**

---

## 7. Extension Directions

### 7.1 Ordered Dimensions: Time Axis & Intensity Axis

In the base DCL design, all 8 directions are **symmetrical** — each is an exact-match discrete label. In practice, however, some dimensions are inherently **ordinal**:

- **Time axis**: Assign one direction (e.g., ↓) to represent time, where values map to time segments (1=oldest, 8=newest)
- **Intensity axis**: Assign one direction (e.g., →) to represent intensity, where values map to degree (1=weakest, 8=strongest)

**Conflict with the current design:**

Currently, locking `↓=3` means exact match "equals 3". But for time or intensity dimensions, the user's intuition is **directional** — "moving down = older", "moving right = stronger". This requires a new matching mode:

```
Exact match (current):     A(c, d) = v
Directional match (new):   A(c, d) >= v  or  A(c, d) <= v
```

This means certain directions can be marked as "ordered dimensions". Instead of locking an exact value, navigation locks a **lower or upper bound**. Continued movement in the same direction progressively tightens the bound (e.g., `>=3` → `>=4` → `>=5`), creating a gradual "going deeper" experience.

**Design considerations:**

- Ordered dimensions no longer satisfy the selection constraint (multiple cards can match the same value range)
- Pool size decays more slowly (`>=3` hits many cards, while `=3` hits only a fraction)
- Recommend at most 2 ordered dimensions; keep the rest as exact match to maintain filtering power

### 7.2 Same-Direction Progressive Refinement (Sub-step Refinement)

Current behavior: after locking `→=8`, moving right again just cycles through the same candidate pool — **there is no sense of "going deeper"**.

Proposed extension: each repeated move in an already-locked direction increments the constraint value by a sub-step:

```
1st move right: lock → = 8.0
2nd move right: tighten → = 8.1 (pool shrinks)
3rd move right: tighten → = 8.2 (pool shrinks further)
...
```

**Core effect:** Transform the "cycling through the loop pool" behavior into "progressively converging within a dimension". The user feels "more precise with each step" rather than "going in circles".

**Implementation impact:**

- Value domain expands from discrete integers {1…N} to continuous values or a finer discrete scale (e.g., {1.0, 1.1, ..., N.9})
- Selection constraint must be relaxed: no longer strictly distinct integers; each card holds a float per direction
- Matching logic changes to interval comparison: `|A(c, d) - v| <= tolerance`, with tolerance decreasing as sub-steps increase
- Sub-step increment and tolerance decay curve need careful tuning to balance "convergence speed" vs. "pool size"

**Relationship with ordered dimensions:**

Progressive refinement and ordered dimensions can be combined. Ordered dimensions control "direction" (stronger/newer), while progressive refinement controls "precision" (more exact). Together they create a coarse-to-fine exploration experience.

### 7.3 Plugin Architecture

The DCL engine supports an opt-in **plugin system**, allowing extensions to be mounted on demand without modifying the core algorithm.

**Design philosophy:**

- The core engine (`DCL.create()`) remains minimal and pure — no optional features baked in
- Extensions are registered globally and mounted per-engine via `DCL.use(engine, 'pluginName')`
- Plugins can wrap existing methods (e.g., `navigate`) or add new methods (e.g., `undo`)

**Built-in plugin — `memory`:**

The first built-in plugin provides navigation undo. Key behavior:

- On each `navigate()`, the current card is pushed onto an internal stack
- `undo()` pops the stack and reverts to the previous card
- **Lock state is preserved** — undo does not roll back constraints
- The candidate pool is recalculated based on the current (unchanged) lock state
- `reset()` clears the memory stack

This design reflects a deliberate choice: undo means "go back to the previous card within the current constraints", not "undo the entire navigation step". The user's accumulated constraint trajectory is always preserved.

**Future plugins** could include: anti-repeat (avoid revisiting recent cards), analytics (track navigation patterns), path recording (persist full navigation history), etc.

---

## 8. Open Design Questions

- [x] Release order when constraints are exhausted → Confirmed: **FIFO (first in, first out)**
- [ ] Who defines the dimension semantics for each direction? Fixed by product? Or dynamically generated per dataset?
- [ ] Values are discrete integers drawn from {1…N} — can fuzzy matching (e.g., ±1) be supported?
- [ ] For large card pools, how can AI auto-score each direction (CLIP embeddings)?
- [ ] How do ordered dimensions interact with FIFO unlock? Should directional unlock roll back to the previous bound rather than fully removing the constraint?
- [ ] How to design sub-step increment (0.1? dynamic?) and tolerance decay curve for progressive refinement?

---

## 9. Next Steps

1. **~~Prototype implementation~~** ✓ Complete (100 cards, FIFO unlock, cyclic navigation)
2. **Validate core experience**: Does the movement feel intuitive?
3. **Real content replacement**: Replace placeholder cards with fashion photos + manual scoring
4. **AI scoring integration**: Connect CLIP embeddings to auto-generate directional values
5. **Naming and positioning**: Is this algorithm worth packaging as a standalone product or open-source tool?
6. **Ordered dimension PoC**: Experiment with time axis or intensity axis in the prototype
7. **Progressive refinement PoC**: Implement sub-step convergence on repeated same-direction moves

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | 2026-03-25 | Initial draft: concept and basic rules |
| v0.2 | 2026-03-25 | Added formal definitions, confirmed FIFO unlock, permutation constraint, prototype complete |
| v0.3 | 2026-03-25 | Added extension directions: ordered dimensions (time/intensity axis), same-direction progressive refinement |
| v0.4 | 2026-03-26 | Added plugin architecture and built-in memory (undo) plugin |
| v0.5 | 2026-03-30 | Changed pool selection to random; randomized starting card (configurable via startIndex); seed default changed to Date.now() |
