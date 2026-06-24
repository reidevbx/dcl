# DCL Algorithm Specification

**Directional Constraint Locking**
Version 0.7 — 2026-06-24

---

## 1. Overview

Directional Constraint Locking (DCL) is a multidimensional filtering algorithm driven by spatial movement. Users navigate a 2D canvas in 8 directions; each direction maps to a data dimension. Moving in a direction locks that dimension's value, and locked constraints accumulate to progressively narrow a candidate pool.

The algorithm guarantees deadlock-free navigation through a FIFO unlock mechanism.

---

## 2. Formal Definition

### 2.1 Notation

| Symbol | Definition |
|--------|-----------|
| C | Set of all cards, \|C\| = n |
| D | {↖, ↑, ↗, ←, →, ↙, ↓, ↘}, the 8 directions |
| N | Value domain size, configurable (default N=8, must satisfy N ≥ 8) |
| A(c, d) | Attribute function: card c's value in direction d. A : C × D → {1…N} |
| L | Current lock set, L ⊆ D × {1…N} |
| Q | Lock-order queue (FIFO), recording the sequence in which directions were locked |
| c_t | Current card at time t |

### 2.2 Permutation Constraint

For every card c ∈ C, A(c, ·) selects **8 distinct values** from {1…N} (where N ≥ 8, default N=8).

- When **N=8**: A(c, ·) : D → {1…8} is a **bijection** (full permutation) — each card's 8 directional values are a rearrangement of {1, 2, 3, 4, 5, 6, 7, 8} with no repeats.
- When **N>8**: A(c, ·) is an **injection** — each card picks 8 distinct values from the larger pool {1…N}, yielding P(N, 8) = N!/(N−8)! possible arrangements per card. Values do not cover the full range.

**Implication**: In both cases, a single card cannot have the same value in two different directions. This ensures maximum discrimination when locking constraints.

### 2.3 Candidate Pool

```
P(L, c_t) = { c ∈ C | c ≠ c_t ∧ ∀(d, v) ∈ L : A(c, d) = v }
```

The candidate pool is the set of all cards (excluding the current card) that satisfy every locked constraint.

### 2.4 Navigation Function: nav(d)

Given a direction d, navigation proceeds as follows:

```
1. LOCK — If d is not already locked:
     L ← L ∪ {(d, A(c_t, d))}
     Q.enqueue(d)

2. QUERY — Compute the candidate pool:
     P ← P(L, c_t)

3. FIFO UNLOCK — If P = ∅, release the oldest lock until candidates exist:
     while P = ∅ and Q ≠ ∅:
       d' ← Q.dequeue()        // oldest locked direction
       L  ← L \ {(d', ·)}      // remove that constraint
       P  ← P(L, c_t)          // recompute

4. RANDOM SELECT — Pick a random card from the pool:
     c_t ← P[random(0, |P|-1)]
```

**Note on already-locked directions**: When d ∈ L (the direction is already locked), step 1 is skipped — no new constraint is added. The function proceeds directly to step 2 with the existing lock set, effectively picking randomly from the same pool again.

**Non-determinism**: Each navigation randomly selects from the candidate pool. The same sequence of operations is not guaranteed to produce the same result. This enhances the sense of exploration and surprise, at the cost of reproducibility. Undo/redo still restores exact state via snapshots.

---

## 3. Properties

### 3.1 Monotonic Accumulation

|L| is non-decreasing during navigation, except when FIFO unlock fires. Each `nav(d)` call either adds one constraint or leaves L unchanged.

### 3.2 Maximum Lock Count

|L| ≤ |D| = 8. There are at most 8 distinct directional dimensions to lock.

### 3.3 Deadlock Freedom

**Theorem**: For any card set C with |C| > 1 and any current card c_t, the navigation function `nav(d)` always produces a non-empty candidate pool.

**Proof sketch**:
- In the worst case, FIFO unlock removes all constraints, yielding L = ∅.
- When L = ∅, P(∅, c_t) = C \ {c_t}.
- Since |C| > 1, |P(∅, c_t)| ≥ 1.
- Therefore, the while loop in step 3 always terminates with P ≠ ∅. ∎

### 3.4 Random Navigation

Under a fixed lock set L, the candidate pool P(L, c_t) is finite. Each navigation randomly selects a card from the pool, without guaranteeing that every candidate will be visited. This non-deterministic design prioritizes exploration surprise over complete coverage.

### 3.5 Permutation Uniqueness

Because A(c, ·) selects 8 **distinct** values for each card (whether N=8 or N>8), a card can match at most one value per direction. This prevents ambiguous constraint matching and ensures the lock set L is well-defined (each direction appears at most once in L).

---

## 4. Complexity Analysis

### 4.1 Time Complexity

The implementation uses an **inverted index** `Index[d][v]` built at initialization. Pool computation uses set intersection over locked dimensions instead of linear scans.

| Operation | Complexity |
|-----------|-----------|
| Lock a direction | O(1) |
| Compute P(L, c_t) | O(min bucket size · \|L\|) via index intersection |
| FIFO unlock (worst case) | O(\|L\| · min bucket · \|L\|) |
| Single nav(d) call | O(min bucket · \|L\|²) worst case |

With N categories and n cards, the average bucket size is n/N. For N=20, n=10000: each nav step scans ~500 cards instead of 10000. Benchmarks show **0.13ms per navigate at 50K cards**.

Fallback: Without an index (e.g., using the public `getPool`/`getAllMatch` API), the complexity is O(n · |L|) per pool computation.

### 4.2 Space Complexity

| Component | Space |
|-----------|-------|
| Card storage | O(n · \|D\|) = O(8n) = O(n) |
| Inverted index | O(n · \|D\|) = O(8n) = O(n) |
| Lock state | O(\|D\|) = O(1) |
| Lock queue | O(\|D\|) = O(1) |
| (no extra state) | — |

### 4.3 Further Optimization Opportunities

- **Bitmap intersection**: Represent each `Index[d][v]` as a bitset. Pool = bitwise AND of all locked bitsets. O(n/64 · |L|). Useful beyond 100K cards.

---

## 5. Data Structures

### 5.1 Card Node

```json
{
  "id": "card_001",
  "attrs": {
    "right": 8,
    "left": 3,
    "up": 7,
    "down": 4,
    "rightUp": 6,
    "leftUp": 2,
    "rightDown": 5,
    "leftDown": 1
  }
}
```

The `attrs` object maps each of the 8 directions to a unique integer in {1…N} (N configurable, default 8). All 8 values within a single card must be distinct.

### 5.2 Navigation State

```json
{
  "current": "card_001",
  "lockMap": { "right": 8, "up": 7 },
  "lockOrder": ["right", "up"]
}
```

| Field | Purpose |
|-------|---------|
| `current` | Currently active card |
| `lockMap` | Locked direction→value pairs |
| `lockOrder` | FIFO queue of lock sequence |

---

## 6. Comparison with Existing Approaches

| Approach | Similarity | Difference |
|----------|-----------|-----------|
| Faceted Search | Multi-criteria filtering | Criteria are preset, not behavior-driven |
| Graph Traversal | Node-to-node movement | No directional dimension semantics |
| Constraint Satisfaction | Accumulating constraints to find solutions | Not driven by spatial navigation |
| Latent Space Navigation | Semantic space exploration | Requires ML model, opaque internals |
| **DCL** | — | Behavior = filter; movement = constraint definition; transparent and controllable |

---

## 7. Design Considerations

### 7.1 Pool Size vs. Constraint Count

With n cards and k locked constraints, the expected pool size decreases as constraints accumulate.

**Assumption**: Card attributes are drawn from uniformly random selections of 8 distinct values from {1…N}. Real-world data may be skewed — the analysis below provides a baseline; actual pool sizes should be validated empirically.

The probability model depends on whether N=8 or N>8:

**When N=8 (default)**: A(c, ·) is a full permutation, so the 8 directional values are **not independent** — knowing one value constrains the remaining possibilities. The correct model uses the falling factorial:

```
E[|P|] ≈ n / P(8, k)

where P(8, k) = 8 × 7 × ... × (8-k+1)  (falling factorial, permutation constraint)
```

**When N>8**: Each card independently picks 8 distinct values from {1…N}. Values across different directions are effectively independent (the per-direction probability of matching any specific value v is 8/N). The expected pool size per lock becomes:

```
E[|P|] ≈ n × (8/N)^k

where 8/N is the per-direction hit probability
```

**N=8 model** (permutation constraint applies):

| k (locks) | P(8, k) | E[\|P\|] for n=40 | E[\|P\|] for n=100 |
|-----------|---------|-------------------|---------------------|
| 1 | 8 | 5.0 | 12.5 |
| 2 | 56 | 0.71 | 1.79 |
| 3 | 336 | 0.12 | 0.30 |
| 4 | 1680 | 0.02 | 0.06 |

This shows that FIFO unlock triggers frequently with small card sets — even 2 locks on 40 cards yields an expected pool below 1. Practical recommendation for N=8: **n should be at least 56 (= P(8,2)) for a smooth experience with 2 simultaneous locks, and at least 336 for 3 locks**.

For N>8, increasing N spreads values across a larger domain, reducing per-direction hit probability (8/N) and shrinking pool sizes faster. Choose N to balance discrimination strength against pool depletion risk for the target card count.

### 7.2 Fuzzy Matching Extension

The strict equality constraint `A(c, d) = v` can be relaxed to a tolerance window:

```
P_fuzzy(L, c_t, ε) = { c ∈ C | c ≠ c_t ∧ ∀(d, v) ∈ L : |A(c, d) - v| ≤ ε }
```

With ε=1, each lock matches approximately 3/N of cards (for small N) instead of 1/N, significantly increasing pool sizes for small datasets. The distinctness constraint still holds for the underlying card attributes — fuzzy matching only relaxes the query, not the card values.

**Trade-off**: Fuzzy matching increases pool size at the cost of reduced discriminative power. With ε=1, constraints become less precise — the user may see cards that are "close but not exact", which may or may not match the intended exploration direction. The tolerance ε should be tuned per application.

### 7.3 Value Assignment Strategies

The distinctness constraint requires assigning 8 unique values from {1…N} to each card's 8 directions. Strategies include:

- **Random selection (N=8)**: Shuffle {1…8} and assign — a full permutation. Simple, uniform distribution. Used in the prototype.
- **Random selection (N>8)**: Draw 8 distinct values uniformly at random from {1…N} without replacement. Values are independent across directions.
- **Embedding-based**: Map card features (e.g., via CLIP) to N dimensions, then select the 8 most discriminative dimension ranks as the card's values.
- **Manual curation**: Domain experts assign values for small, high-quality datasets.

---

## 8. Plugin System

### 8.1 Architecture

The DCL engine supports an opt-in plugin mechanism. The core algorithm remains unchanged; plugins extend engine instances by wrapping or adding methods.

```
DCL.register(name, installer)   // register a plugin globally
DCL.use(engine, name)           // mount a plugin on a specific engine instance
```

The `installer` function receives the engine instance and may:
- Wrap existing methods (e.g., intercept `navigate` to add pre/post logic)
- Add new methods to the engine (e.g., `undo`)
- Maintain private state via closure

### 8.2 Built-in Plugin: `memory`

**Purpose**: Full-state undo/redo — step backward and forward along the navigation history, restoring the exact prior state (current card **and** locks) at each step.

**State**: Three internal stacks (undo depth capped at 50):

| Stack | Entry | Role |
|-------|-------|------|
| `undoStack` | `{ state, dir }` | Full state snapshots `{cur, lockMap, lockOrder}` of each prior step |
| `redoStack` | `{ state, dir }` | Snapshots popped by `undo()`, replayable by `redo()` |
| `dirStack` | `dir` | Path of directions taken, used to detect backtracking |

Because each entry stores a complete snapshot (not just a card), undo/redo restore the **entire** navigation state, including the lock set L and lock order Q. This is a deliberate change from the original card-only design.

**Modified methods**:

| Method | Behavior |
|--------|----------|
| `navigate(d)` | Computes a *direction hint* first (see below). If the hint is `undo`/`redo`, delegates to those methods. Otherwise pushes a full snapshot of the current state onto `undoStack`, clears `redoStack`, and navigates — reusing the `peek`-cached target id so a preceding `peek(d)`/`peekAll()` and the actual move land on the **same** card. |
| `reset()` | Clears all three stacks and the peek caches, then calls the original. |

**Direction hint** (`dirHint(d)`): translates a directional input into undo/redo so spatial backtracking feels natural.

- If `d` is the **opposite** of the last direction taken (`OPPOSITE[dirStack.top]`), the hint is `undo`.
- Otherwise, if `d` equals the direction of the most recently undone step (`redoStack.top.dir`), the hint is `redo`. This fires at **any** depth, not only when the path is fully unwound. (`redoStack` is cleared on every fresh `navigate`, so it is only non-empty right after one or more `undo`s; and the redo direction can never equal `OPPOSITE[dirStack.top]`, so it never collides with the undo case.)
- Otherwise `null` — a normal forward navigation.

**Added methods**:

| Method | Return | Description |
|--------|--------|-------------|
| `undo()` | `{card, candidates, allMatches, lockMap, lockOrder, undone:true}` or `null` | Pops `undoStack`, pushes the current state onto `redoStack`, and **restores the full snapshot** (`cur`, `lockMap`, `lockOrder`). Returns `null` if `undoStack` is empty. |
| `redo()` | `{... redone:true}` or `null` | Pops `redoStack`, pushes the current state onto `undoStack`, and restores that snapshot. Returns `null` if `redoStack` is empty. |
| `canUndo()` | `boolean` | Whether `undoStack` is non-empty |
| `canRedo()` | `boolean` | Whether `redoStack` is non-empty |
| `peek(d)` | `{card, type}` or `null` | Preview which card direction d would reach. `type` is `'navigate'`, `'undo'`, or `'redo'`. Idempotent: returns the same result on repeated calls within the same state, and the cached navigate target is reused by `navigate(d)`. |
| `peekAll()` | `{dir: {card, type}}` | Preview all 8 directions. Results are cached until the next state-changing call. |

**Formal semantics of undo**:

```
undo():
  if undoStack = ∅: return null
  redoStack.push({ state: snapshot(c_t, L, Q), dir })
  (c_t, L, Q) ← undoStack.pop().state    // full state restored
  return (c_t, P(L, c_t), L, Q, undone=true)
```

Key property: **undo/redo restore exact prior state**. Each step reinstates the snapshot's current card *and* its lock set L and lock order Q. Reproducibility across the non-deterministic random selection is achieved entirely through these snapshots.

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-03-25 | Initial draft: concept and basic rules |
| 0.2 | 2026-03-25 | Formal definitions, FIFO unlock confirmed, permutation constraint, prototype completed |
| 0.3 | 2026-03-25 | Fixed probability model (falling factorial), defined deterministic pool ordering, added fuzzy matching trade-off analysis |
| 0.4 | 2026-03-26 | Added plugin system architecture and built-in memory (undo) plugin specification |
| 0.5 | 2026-03-30 | Changed pool selection from deterministic cycle to random; randomized starting card (configurable via startIndex); seed default changed to Date.now() |
| 0.6 | 2026-03-30 | Added peek/peekAll idempotency guarantee (caching); documented redo, canRedo, peek, peekAll methods; UI shows only arrows for undo/redo directions |
| 0.7 | 2026-06-24 | Corrected §8.2 to match implementation: `memory` undo/redo restore **full state snapshots** (current card + locks), not card-only; documented the opposite-direction→undo and repeat-direction→redo hints (redo now fires at any depth); noted peek→navigate target consistency |
