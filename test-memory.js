/**
 * Verification script for memory plugin undo/redo + core algorithm integrity.
 * Run with: node test-memory.js
 */
var DCL = require('./public/dcl.js');

var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✅ ' + msg); }
  else { failed++; console.log('  ❌ ' + msg); }
}

// ============================================================
// Test 1: Core algorithm unchanged (no memory plugin)
// ============================================================
console.log('\n=== Test 1: Core algorithm integrity (no plugin) ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  var s0 = e.getState();
  assert(s0.cur.id === 0, 'starts at card 0');
  assert(Object.keys(s0.lockMap).length === 0, 'no initial locks');

  // Navigate right → locks right dimension
  var r1 = e.navigate('right');
  assert(r1 !== null, 'navigate right succeeds');
  assert('right' in r1.lockMap, 'right is locked after navigate right');
  assert(r1.lockOrder.length === 1, 'one lock after first move');
  assert(r1.lockOrder[0] === 'right', 'lockOrder[0] is right');

  // Navigate up → may trigger FIFO if right+up has empty pool
  var r2 = e.navigate('up');
  assert(r2 !== null, 'navigate up succeeds');
  assert(r2.lockOrder.length >= 1, 'at least one lock after second move');
  assert('up' in r2.lockMap, 'up is locked');

  // Cycle: navigate right again in same state
  var r3 = e.navigate('right');
  assert(r3 !== null, 'navigate right again succeeds');
  assert(r3.lockOrder.length === 2, 'still two locks (right already locked)');

  // Reset
  e.reset();
  var sr = e.getState();
  assert(sr.cur.id === 0, 'reset returns to card 0');
  assert(Object.keys(sr.lockMap).length === 0, 'reset clears locks');
})();

// ============================================================
// Test 2: FIFO unlock still works
// ============================================================
console.log('\n=== Test 2: FIFO unlock integrity ===');
(function () {
  var e = DCL.create({ cardCount: 8, seed: 42 });
  // Lock many directions to force FIFO
  var dirs = ['right', 'up', 'left', 'down', 'rightUp', 'leftDown', 'leftUp', 'rightDown'];
  var lastResult;
  for (var i = 0; i < dirs.length; i++) {
    lastResult = e.navigate(dirs[i]);
  }
  // After locking all 8 directions on 8 cards, FIFO should have triggered
  assert(lastResult !== null, 'navigation completes even with many locks');
  assert(lastResult.lockOrder.length <= 8, 'lockOrder does not exceed 8');
})();

// ============================================================
// Test 3: Memory plugin — basic undo
// ============================================================
console.log('\n=== Test 3: Memory plugin basic undo ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  DCL.use(e, 'memory');

  var cardA = e.getState().cur;
  var r1 = e.navigate('right');
  var cardB = r1.card;
  assert(cardB.id !== cardA.id, 'moved to a different card');

  // Undo
  var u = e.undo();
  assert(u !== null, 'undo succeeds');
  assert(u.card.id === cardA.id, 'undo returns to card A');
  assert(u.undone === true, 'undone flag is true');

  // Lock state should be restored (no locks, since we undid the only move)
  var s = e.getState();
  assert(Object.keys(s.lockMap).length === 0, 'undo restores lock state (empty)');
  assert(s.lockOrder.length === 0, 'undo restores lockOrder (empty)');
})();

// ============================================================
// Test 4: Opposite direction → auto undo
// ============================================================
console.log('\n=== Test 4: Opposite direction auto-undo ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  DCL.use(e, 'memory');

  var cardA = e.getState().cur;
  e.navigate('right');    // A → B
  var cardB = e.getState().cur;

  // Navigate left (opposite of right) → should auto-undo back to A
  var r = e.navigate('left');
  assert(r !== null, 'opposite direction navigate succeeds');
  assert(r.undone === true, 'opposite direction triggers undo');
  assert(r.card.id === cardA.id, 'back to card A via opposite direction');

  // Locks should be restored
  var s = e.getState();
  assert(Object.keys(s.lockMap).length === 0, 'locks restored after auto-undo');
})();

// ============================================================
// Test 5: Redo mechanism
// ============================================================
console.log('\n=== Test 5: Redo mechanism ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  DCL.use(e, 'memory');

  var cardA = e.getState().cur;
  var r1 = e.navigate('right');   // A → B
  var cardB = r1.card;
  var lockAfterB = e.getState().lockMap;

  e.navigate('left');             // opposite → undo back to A
  assert(e.canRedo(), 'canRedo is true after undo');

  // Navigate right again → should redo back to B
  var r3 = e.navigate('right');
  assert(r3 !== null, 'redo navigate succeeds');
  assert(r3.redone === true, 'redone flag is true');
  assert(r3.card.id === cardB.id, 'redo returns to card B');

  // Lock state should match what it was at B
  var s = e.getState();
  assert(s.lockMap.right === lockAfterB.right, 'redo restores lock value');
})();

// ============================================================
// Test 6: New direction clears redo stack
// ============================================================
console.log('\n=== Test 6: New direction clears redo ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  DCL.use(e, 'memory');

  e.navigate('right');   // A → B
  e.navigate('left');    // undo → A
  assert(e.canRedo(), 'canRedo before new direction');

  e.navigate('up');      // new direction → clears redo
  assert(!e.canRedo(), 'canRedo is false after new direction');
})();

// ============================================================
// Test 7: peek() — undo/redo awareness
// ============================================================
console.log('\n=== Test 7: peek() undo/redo awareness ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  DCL.use(e, 'memory');

  var cardA = e.getState().cur;
  var r1 = e.navigate('right');
  var cardB = r1.card;

  // Peek left (opposite) should show undo to card A
  var peekLeft = e.peek('left');
  assert(peekLeft !== null, 'peek left returns result');
  assert(peekLeft.type === 'undo', 'peek left type is undo');
  assert(peekLeft.card.id === cardA.id, 'peek left shows card A');

  // Peek up should be a normal navigate
  var peekUp = e.peek('up');
  assert(peekUp !== null, 'peek up returns result');
  assert(peekUp.type === 'navigate', 'peek up type is navigate');

  // After undo, peek right should show redo to card B
  e.navigate('left');  // auto-undo to A
  var peekRight = e.peek('right');
  assert(peekRight !== null, 'peek right after undo returns result');
  assert(peekRight.type === 'redo', 'peek right type is redo');
  assert(peekRight.card.id === cardB.id, 'peek right shows card B');
})();

// ============================================================
// Test 8: peekAll()
// ============================================================
console.log('\n=== Test 8: peekAll() ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  DCL.use(e, 'memory');

  e.navigate('right');
  var all = e.peekAll();
  assert(typeof all === 'object', 'peekAll returns object');
  assert(DCL.DIRS.every(function (d) { return d in all; }), 'peekAll has all 8 directions');
  assert(all.left.type === 'undo', 'peekAll left is undo');
})();

// ============================================================
// Test 9: peek() does NOT mutate state
// ============================================================
console.log('\n=== Test 9: peek() is non-mutating ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  DCL.use(e, 'memory');

  e.navigate('right');
  var before = e.getState();
  e.peek('up');
  e.peek('down');
  e.peekAll();
  var after = e.getState();

  assert(before.cur.id === after.cur.id, 'cur unchanged after peek');
  assert(JSON.stringify(before.lockMap) === JSON.stringify(after.lockMap), 'lockMap unchanged after peek');
  assert(JSON.stringify(before.lockOrder) === JSON.stringify(after.lockOrder), 'lockOrder unchanged after peek');
})();

// ============================================================
// Test 10: Multi-step undo/redo chain
// ============================================================
console.log('\n=== Test 10: Multi-step undo/redo chain ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  DCL.use(e, 'memory');

  var cardA = e.getState().cur;
  var r1 = e.navigate('right');
  var cardB = r1.card;
  var r2 = e.navigate('up');
  var cardC = r2.card;

  // Undo twice
  e.undo();
  assert(e.getState().cur.id === cardB.id, 'first undo → card B');
  e.undo();
  assert(e.getState().cur.id === cardA.id, 'second undo → card A');

  // Redo twice
  e.redo();
  assert(e.getState().cur.id === cardB.id, 'first redo → card B');
  e.redo();
  assert(e.getState().cur.id === cardC.id, 'second redo → card C');
})();

// ============================================================
// Test 11: Card objects are frozen (immutable)
// ============================================================
console.log('\n=== Test 11: Card objects are frozen ===');
(function () {
  var e = DCL.create({ cardCount: 10, seed: 99 });
  var card = e.cards[0];
  assert(Object.isFrozen(card), 'card object is frozen');
  assert(Object.isFrozen(card.attrs), 'card.attrs is frozen');
  try { card.attrs.up = 999; } catch (err) { /* expected in strict mode */ }
  assert(card.attrs.up !== 999, 'mutation of attrs.up has no effect');
})();

// ============================================================
// Test 12: _setState not on public API
// ============================================================
console.log('\n=== Test 12: _setState not on public API ===');
(function () {
  var e = DCL.create({ cardCount: 10, seed: 99 });
  assert(typeof e._setState === 'undefined', '_setState is not exposed on engine');
  // Plugin should still work via internal channel
  DCL.use(e, 'memory');
  e.navigate('right');
  var u = e.undo();
  assert(u !== null, 'undo still works without public _setState');
  assert(u.card.id === 0, 'undo restores correctly via private channel');
})();

// ============================================================
// Test 13: cardCount < 2 throws error
// ============================================================
console.log('\n=== Test 13: cardCount < 2 throws error ===');
(function () {
  var threw = false;
  try { DCL.create({ cardCount: 1 }); } catch (err) { threw = true; }
  assert(threw, 'cardCount=1 throws error');
})();

// ============================================================
// Test 14: categories < 8 throws error
// ============================================================
console.log('\n=== Test 14: categories < 8 throws error ===');
(function () {
  var threw = false;
  try { DCL.create({ cardCount: 10, categories: 3 }); } catch (err) { threw = true; }
  assert(threw, 'categories=3 throws error');
})();

// ============================================================
// Test 15: dirStack stays in sync after maxSize overflow
// ============================================================
console.log('\n=== Test 15: dirStack/undoStack sync after overflow ===');
(function () {
  var e = DCL.create({ cardCount: 40, seed: 2025 });
  DCL.use(e, 'memory');

  // Navigate 60 times (exceeds UNDO_MAX=50)
  var dirs = ['right', 'up', 'right', 'up', 'right', 'up'];
  for (var i = 0; i < 60; i++) {
    e.navigate(dirs[i % dirs.length]);
  }

  // Should be able to undo 50 times without issue
  var undoCount = 0;
  while (e.canUndo()) {
    var r = e.undo();
    if (!r) break;
    undoCount++;
  }
  assert(undoCount === 50, 'can undo exactly 50 times (maxSize)');
  assert(!e.canUndo(), 'canUndo is false after full undo');

  // After full undo, redo should work
  if (e.canRedo()) {
    var redo = e.redo();
    assert(redo !== null, 'redo works after full undo from overflow');
    assert(redo.redone === true, 'redo flag is true');
  }
})();

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed! Core algorithm integrity verified.');
}
