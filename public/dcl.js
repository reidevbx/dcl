/**
 * DCL — Directional Constraint Locking (core algorithm)
 *
 * Pure algorithm module with no DOM dependencies.
 * Can be used standalone or imported by a UI layer.
 *
 * Usage:
 *   var engine = DCL.create({ cardCount: 40, seed: 2025 });
 *   var result = engine.navigate('right');
 *   // result = { card, pool, released, lockMap, lockOrder }
 */
var DCL = (function () {
  'use strict';

  // 8 canonical directions
  var DIRS = [
    'leftUp', 'up', 'rightUp',
    'left',          'right',
    'leftDown', 'down', 'rightDown'
  ];

  var ARROWS = {
    leftUp: '\u2196', up: '\u2191', rightUp: '\u2197',
    left: '\u2190',                  right: '\u2192',
    leftDown: '\u2199', down: '\u2193', rightDown: '\u2198'
  };

  // --- Seeded shuffle (LCG) ---
  function shuffle(arr, seed) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      var j = (seed >>> 0) % (i + 1);
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // --- Card generation ---
  function generateCards(count, baseSeed) {
    var cards = [];
    for (var i = 0; i < count; i++) {
      var vals = shuffle([1, 2, 3, 4, 5, 6, 7, 8], baseSeed + i * 31337);
      var attrs = {};
      for (var d = 0; d < DIRS.length; d++) attrs[DIRS[d]] = vals[d];
      cards.push({
        id: i,
        label: i < 26 ? String.fromCharCode(65 + i) : 'A' + (i - 25),
        attrs: attrs
      });
    }
    return cards;
  }

  // --- Query functions ---

  /** P(L, ct) — candidate pool excluding current card */
  function getPool(cards, lockMap, excludeId) {
    var keys = Object.keys(lockMap);
    return cards.filter(function (c) {
      if (c.id === excludeId) return false;
      for (var i = 0; i < keys.length; i++) {
        if (c.attrs[keys[i]] !== lockMap[keys[i]]) return false;
      }
      return true;
    });
  }

  /** All cards matching locks (including current) */
  function getAllMatch(cards, lockMap) {
    var keys = Object.keys(lockMap);
    if (!keys.length) return cards;
    return cards.filter(function (c) {
      for (var i = 0; i < keys.length; i++) {
        if (c.attrs[keys[i]] !== lockMap[keys[i]]) return false;
      }
      return true;
    });
  }

  /** Lock-state key for cycle counter */
  function lockKey(lockMap, lockOrder) {
    return lockOrder.map(function (d) { return d + '=' + lockMap[d]; }).join(';');
  }

  // --- Shallow object copy ---
  function assign(target, src) {
    for (var k in src) {
      if (src.hasOwnProperty(k)) target[k] = src[k];
    }
    return target;
  }

  // --- Engine factory ---

  function create(opts) {
    opts = opts || {};
    var cardCount = opts.cardCount || 40;
    var baseSeed = opts.seed || 2025;
    var cards = opts.cards || generateCards(cardCount, baseSeed);
    var state = createState(cards[0]);

    function createState(startCard) {
      return {
        cur: startCard,
        lockMap: {},
        lockOrder: [],
        counter: {},
        history: []
      };
    }

    /**
     * nav(d) — core navigation step
     *
     * Returns an object describing what happened:
     *   { card, pool, fullPool, released, lockMap, lockOrder }
     */
    function navigate(dir) {
      var cur = state.cur;
      var nMap = assign({}, state.lockMap);
      var nOrd = state.lockOrder.slice();

      // Step 1: lock if not already locked
      if (!(dir in nMap)) {
        nMap[dir] = cur.attrs[dir];
        nOrd.push(dir);
      }

      // Step 2: compute candidate pool
      var pool = getPool(cards, nMap, cur.id);

      // Step 3: FIFO unlock until non-empty
      var released = [];
      while (!pool.length && nOrd.length > 0) {
        var oldest = nOrd.shift();
        released.push({ dir: oldest, val: nMap[oldest] });
        delete nMap[oldest];
        pool = getPool(cards, nMap, cur.id);
      }

      if (!pool.length) return null; // should not happen if |C| > 1

      // Update state
      state.lockMap = nMap;
      state.lockOrder = nOrd;
      state.history.push(cur.label);
      if (state.history.length > 12) state.history.shift();

      // Step 4: cycle
      var key = lockKey(nMap, nOrd);
      if (!(key in state.counter)) state.counter[key] = 0;
      state.cur = pool[state.counter[key] % pool.length];
      state.counter[key] = (state.counter[key] + 1) % pool.length;

      return {
        card: state.cur,
        pool: pool,
        fullPool: getAllMatch(cards, nMap),
        released: released,
        lockMap: assign({}, nMap),
        lockOrder: nOrd.slice()
      };
    }

    function reset() {
      state = createState(cards[0]);
    }

    function clearHistory() {
      state.history = [];
    }

    function getState() {
      return {
        cur: state.cur,
        lockMap: assign({}, state.lockMap),
        lockOrder: state.lockOrder.slice(),
        history: state.history.slice(),
        fullPool: getAllMatch(cards, state.lockMap),
        counter: state.counter
      };
    }

    return {
      cards: cards,
      navigate: navigate,
      reset: reset,
      clearHistory: clearHistory,
      getState: getState
    };
  }

  // Public API
  return {
    DIRS: DIRS,
    ARROWS: ARROWS,
    create: create,
    generateCards: generateCards,
    getPool: getPool,
    getAllMatch: getAllMatch,
    lockKey: lockKey
  };
})();
