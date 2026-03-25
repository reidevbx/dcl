# Directional Constraint Locking
## Concept Document

**Version:** v0.2
**Date:** 2026-03-25
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
| `A(c, d)` | Card c's attribute value in direction d, A : C × D → {1…8} |
| `L` | Current lock set, L ⊆ D × {1…8} |
| `Q` | Lock-order queue (FIFO), recording the sequence of locked directions |
| `cₜ` | Current card |

**Permutation Constraint (Core Rule):**
For each card c, `A(c, ·)` is a **bijection (permutation)** from D → {1…8}.
Each card's 8 directional values are all different — no repeats.

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

4. Cycle to next card:
   cₜ ← P[k mod |P|]
   k  ← k + 1
```

### 2.4 Algorithm Properties

- **Monotonic accumulation**: |L| only increases, unless FIFO unlock fires
- **Maximum lock count**: |L| ≤ 8 (limited by the number of directions)
- **Deadlock freedom**: As long as |C| > 1, P(∅, cₜ) ≠ ∅ always holds; FIFO unlock guarantees candidates
- **Cyclic navigation**: Under fixed L, continuous navigation loops back to the start (finite cyclic group)
- **Permutation constraint**: A(c, ·) is a bijection ⟹ a card cannot have the same value in two directions

---

## 3. Basic Rules (Intuitive Explanation)

### 3.1 Direction-to-Dimension Mapping

The canvas has 8 movement directions, each corresponding to a fixed data dimension:

```
        Up (U)
         ↑
  LU  ↖  │  ↗  RU
         │
  L  ←───●───→  R
         │
  LD  ↙  │  ↘  RD
         ↓
       Down (D)
```

Each card holds a value from 1 to 8 in each direction, with all 8 values being distinct (a permutation).

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

### 3.4 Infinite Cycling

Cards satisfying the current constraints form a **Loop Pool**.
Moving continuously in the same direction cycles through this pool endlessly — you never reach a dead end.

```
Cards where →=8: A → C → F → H → A → C → ... (infinite cycle)
```

### 3.5 FIFO Unlock

When the intersection of multiple constraints is empty, the **oldest locked constraint is released first**, continuing until a valid candidate set is found. Release order strictly follows the locking sequence (first in, first out).

---

## 4. Data Structures

### 4.1 Card Node

Each card is a node containing 8 directional values (a permutation, no repeats):

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
  "counter": { "right=8;up=7": 2 },
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

## 7. Open Design Questions

- [x] Release order when constraints are exhausted → Confirmed: **FIFO (first in, first out)**
- [ ] Who defines the dimension semantics for each direction? Fixed by product? Or dynamically generated per dataset?
- [ ] Values are discrete integers 1–8 — can fuzzy matching (e.g., ±1) be supported?
- [ ] For large card pools, how can AI auto-score each direction (CLIP embeddings)?

---

## 8. Next Steps

1. **~~Prototype implementation~~** ✓ Complete (40 cards, FIFO unlock, cyclic navigation)
2. **Validate core experience**: Does the movement feel intuitive?
3. **Real content replacement**: Replace placeholder cards with fashion photos + manual scoring
4. **AI scoring integration**: Connect CLIP embeddings to auto-generate directional values
5. **Naming and positioning**: Is this algorithm worth packaging as a standalone product or open-source tool?

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | 2026-03-25 | Initial draft: concept and basic rules |
| v0.2 | 2026-03-25 | Added formal definitions, confirmed FIFO unlock, permutation constraint, prototype complete |
