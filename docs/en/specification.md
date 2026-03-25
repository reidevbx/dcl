# DCL Algorithm Specification

**Directional Constraint Locking**
Version 0.2 — 2026-03-25

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
| A(c, d) | Attribute function: card c's value in direction d. A : C × D → {1…8} |
| L | Current lock set, L ⊆ D × {1…8} |
| Q | Lock-order queue (FIFO), recording the sequence in which directions were locked |
| c_t | Current card at time t |

### 2.2 Permutation Constraint

For every card c ∈ C, the function A(c, ·) : D → {1…8} is a **bijection** (permutation).

This means each card's 8 directional values are a rearrangement of {1, 2, 3, 4, 5, 6, 7, 8} with no repeats.

**Implication**: A single card cannot have the same value in two different directions. This ensures maximum discrimination when locking constraints.

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

4. CYCLE — Select the next card from the pool:
     c_t ← P[k mod |P|]
     k   ← k + 1
```

**Note on already-locked directions**: When d ∈ L (the direction is already locked), step 1 is skipped — no new constraint is added. The function proceeds directly to step 2 with the existing lock set, effectively cycling through the same pool.

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

### 3.4 Cyclic Navigation

Under a fixed lock set L, the candidate pool P(L, c_t) is finite. Repeated navigation in the same direction cycles through P in order, eventually returning to the first candidate.

The cycle length equals |P(L, c_t)|.

### 3.5 Permutation Uniqueness

Because A(c, ·) is a bijection for each card, a card can match at most one value per direction. This prevents ambiguous constraint matching and ensures the lock set L is well-defined (each direction appears at most once in L).

---

## 4. Complexity Analysis

### 4.1 Time Complexity

| Operation | Complexity |
|-----------|-----------|
| Lock a direction | O(1) |
| Compute P(L, c_t) | O(n · \|L\|) where n = \|C\| |
| FIFO unlock (worst case) | O(\|L\| · n · \|L\|) = O(n · \|L\|²) |
| Single nav(d) call | O(n · \|L\|²) worst case, O(n · \|L\|) typical |

Since |L| ≤ 8, the effective complexity per navigation step is **O(n)** — linear in the number of cards.

### 4.2 Space Complexity

| Component | Space |
|-----------|-------|
| Card storage | O(n · \|D\|) = O(8n) = O(n) |
| Lock state | O(\|D\|) = O(1) |
| Lock queue | O(\|D\|) = O(1) |
| Cycle counters | O(number of distinct lock states visited) |

### 4.3 Optimization Opportunities

For large card sets, the O(n) pool computation can be improved:

- **Index by direction-value pairs**: Precompute `Index[d][v] = {cards with A(c,d) = v}`. Pool computation becomes set intersection over locked dimensions: O(min bucket size · |L|).
- **Bitmap intersection**: Represent each `Index[d][v]` as a bitset. Pool = bitwise AND of all locked bitsets. O(n/64 · |L|).

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

The `attrs` object maps each of the 8 directions to a unique integer in {1…8}.

### 5.2 Navigation State

```json
{
  "current": "card_001",
  "lockMap": { "right": 8, "up": 7 },
  "lockOrder": ["right", "up"],
  "counter": { "right=8;up=7": 2 },
  "history": ["card_003", "card_007", "card_001"]
}
```

| Field | Purpose |
|-------|---------|
| `current` | Currently active card |
| `lockMap` | Locked direction→value pairs |
| `lockOrder` | FIFO queue of lock sequence |
| `counter` | Cycle position per unique lock-state key |
| `history` | Recent navigation trail |

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

With n cards and k locked constraints, the expected pool size decreases exponentially. Each direction-value pair matches approximately n/8 cards (assuming uniform distribution). With k independent locks:

```
E[|P|] ≈ n / 8^k
```

For n=40, k=3: E[|P|] ≈ 40/512 ≈ 0.08. This means FIFO unlock is expected to trigger frequently with small card sets and many locks. Practical recommendation: **n should be at least 8^2 = 64 for a smooth experience with 2 simultaneous locks**.

### 7.2 Fuzzy Matching Extension

The strict equality constraint `A(c, d) = v` can be relaxed to a tolerance window:

```
P_fuzzy(L, c_t, ε) = { c ∈ C | c ≠ c_t ∧ ∀(d, v) ∈ L : |A(c, d) - v| ≤ ε }
```

With ε=1, each lock matches approximately 3/8 of cards instead of 1/8, significantly increasing pool sizes for small datasets. The permutation constraint still holds — fuzzy matching only affects the filtering, not the card data.

### 7.3 Value Assignment Strategies

The permutation constraint requires assigning values {1…8} to each card's 8 directions. Strategies include:

- **Random permutation**: Simple, uniform distribution. Used in the prototype.
- **Embedding-based**: Map card features (e.g., via CLIP) to 8 dimensions, then rank-order within each dimension to produce discrete values.
- **Manual curation**: Domain experts assign values for small, high-quality datasets.

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-03-25 | Initial draft: concept and basic rules |
| 0.2 | 2026-03-25 | Formal definitions, FIFO unlock confirmed, permutation constraint, prototype completed |
