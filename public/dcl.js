/**
 * DCL — Directional Constraint Locking (core algorithm)
 *
 * Pure algorithm module with no DOM dependencies.
 * Can be used standalone or imported by a UI layer.
 *
 * Card shape: { id: Number, attrs: { leftUp, up, ..., rightDown } }
 * Cards are frozen (immutable) after generation.
 *
 * Usage:
 *   var engine = DCL.create({ cardCount: 100, seed: 2025 });
 *   var result = engine.navigate('right');
 *   // result = { card, candidates, allMatches, released, lockMap, lockOrder }
 */
var DCL = (function () {
  'use strict';

  // 8 canonical directions
  var DIRS = [
    'leftUp', 'up', 'rightUp',
    'left',          'right',
    'leftDown', 'down', 'rightDown'
  ];

  var OPPOSITE = {
    left: 'right', right: 'left',
    up: 'down', down: 'up',
    leftUp: 'rightDown', rightDown: 'leftUp',
    rightUp: 'leftDown', leftDown: 'rightUp'
  };

  // --- Named constants ---
  var LCG_MULT = 1664525;
  var LCG_INC  = 1013904223;
  var SEED_STEP = 31337;
  var UNDO_MAX = 50;
  // --- Seeded shuffle (LCG) ---
  function shuffle(arr, seed) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      seed = (seed * LCG_MULT + LCG_INC) & 0xffffffff;
      var j = Math.floor(((seed >>> 0) / 0x100000000) * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // --- Card generation ---
  function generateCards(count, baseSeed, categories) {
    var n = categories || 8;
    // Build the full value pool [1..n], then shuffle and take first 8
    var pool = [];
    for (var v = 1; v <= n; v++) pool.push(v);

    var cards = [];
    for (var i = 0; i < count; i++) {
      var shuffled = shuffle(pool, baseSeed + i * SEED_STEP);
      var attrs = {};
      for (var d = 0; d < DIRS.length; d++) attrs[DIRS[d]] = shuffled[d];
      var card = { id: i, attrs: attrs };
      Object.freeze(attrs);
      Object.freeze(card);
      cards.push(card);
    }
    return cards;
  }

  // --- Inverted index for O(1) constraint lookups ---

  function buildIndex(cards) {
    var idx = {};
    for (var d = 0; d < DIRS.length; d++) {
      idx[DIRS[d]] = {};
    }
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      for (var d = 0; d < DIRS.length; d++) {
        var dir = DIRS[d];
        var val = c.attrs[dir];
        if (!idx[dir][val]) idx[dir][val] = [];
        idx[dir][val].push(c);
      }
    }
    return idx;
  }

  // --- Query functions ---

  /** Match cards using inverted index intersection (fast path) or linear scan (fallback) */
  function matchCards(cards, lockMap, excludeId, index) {
    var keys = Object.keys(lockMap);
    if (!keys.length && excludeId === undefined) return cards;

    var result;
    if (index && keys.length > 0) {
      // Pick the smallest bucket as starting set
      var smallest = keys[0];
      for (var i = 1; i < keys.length; i++) {
        var bucket = index[keys[i]] && index[keys[i]][lockMap[keys[i]]];
        var sBucket = index[smallest] && index[smallest][lockMap[smallest]];
        if (bucket && sBucket && bucket.length < sBucket.length) smallest = keys[i];
      }
      var base = (index[smallest] && index[smallest][lockMap[smallest]]) || [];
      if (keys.length === 1) {
        result = base;
      } else {
        result = [];
        for (var i = 0; i < base.length; i++) {
          var c = base[i];
          var match = true;
          for (var k = 0; k < keys.length; k++) {
            if (keys[k] === smallest) continue;
            if (c.attrs[keys[k]] !== lockMap[keys[k]]) { match = false; break; }
          }
          if (match) result.push(c);
        }
      }
    } else {
      result = cards.filter(function (c) {
        for (var i = 0; i < keys.length; i++) {
          if (c.attrs[keys[i]] !== lockMap[keys[i]]) return false;
        }
        return true;
      });
    }

    if (excludeId !== undefined) {
      result = result.filter(function (c) { return c.id !== excludeId; });
    }
    return result;
  }

  // --- Shallow object copy ---
  function assign(target, src) {
    for (var k in src) {
      if (src.hasOwnProperty(k)) target[k] = src[k];
    }
    return target;
  }

  // --- Private internals registry (keyed by engine id) ---
  var internals = {};
  var nextId = 1;

  // --- Engine factory ---

  function create(opts) {
    opts = opts || {};
    var cardCount = opts.cardCount || 40;
    var baseSeed = opts.seed != null ? opts.seed : Date.now();
    var categories = opts.categories || 8;
    if (cardCount < 2) throw new Error('DCL: cardCount must be >= 2');
    if (categories < 8) throw new Error('DCL: categories must be >= 8');
    var cards = opts.cards || generateCards(cardCount, baseSeed, categories);
    var _index = buildIndex(cards);
    var startIdx = opts.startIndex;
    if (startIdx === undefined || startIdx === null) {
      startIdx = Math.floor(Math.random() * cards.length);
    } else if (startIdx < 0 || startIdx >= cards.length) {
      throw new Error('DCL: startIndex out of range (0..' + (cards.length - 1) + ')');
    }
    var state = createState(cards[startIdx]);

    function createState(startCard) {
      return {
        cur: startCard,
        lockMap: {},
        lockOrder: []
      };
    }

    /**
     * nav(d) — core navigation step
     *
     * Returns an object describing what happened:
     *   { card, candidates, allMatches, released, lockMap, lockOrder }
     */
    function navigate(dir, targetId) {
      var cur = state.cur;
      var nMap = assign({}, state.lockMap);
      var nOrd = state.lockOrder.slice();

      // Step 1: lock if not already locked
      if (!(dir in nMap)) {
        nMap[dir] = cur.attrs[dir];
        nOrd.push(dir);
      }

      // Step 2: compute candidates
      var candidates = matchCards(cards, nMap, cur.id, _index);

      // Step 3: FIFO unlock until non-empty
      var released = [];
      while (!candidates.length && nOrd.length > 0) {
        var oldest = nOrd.shift();
        released.push({ dir: oldest, val: nMap[oldest] });
        delete nMap[oldest];
        candidates = matchCards(cards, nMap, cur.id, _index);
      }

      if (!candidates.length) return null; // should not happen if |C| > 1

      // Update state
      state.lockMap = nMap;
      state.lockOrder = nOrd;
      // Step 4: select from candidate pool
      var picked = null;
      if (targetId !== undefined) {
        for (var i = 0; i < candidates.length; i++) {
          if (candidates[i].id === targetId) { picked = candidates[i]; break; }
        }
      }
      state.cur = picked || candidates[Math.floor(Math.random() * candidates.length)];

      var navResult = {
        card: state.cur,
        candidates: candidates,
        released: released,
        lockMap: assign({}, nMap),
        lockOrder: nOrd.slice()
      };
      var _navAllMatches;
      Object.defineProperty(navResult, 'allMatches', {
        enumerable: true,
        get: function () {
          if (!_navAllMatches) _navAllMatches = matchCards(cards, nMap, undefined, _index);
          return _navAllMatches;
        }
      });
      return navResult;
    }

    function reset() {
      var idx = Math.floor(Math.random() * cards.length);
      state = createState(cards[idx]);
    }

    function getState() {
      var s = {
        cur: state.cur,
        lockMap: assign({}, state.lockMap),
        lockOrder: state.lockOrder.slice(),
      };
      // Lazy getter — allMatches is only computed when accessed
      var _allMatches;
      Object.defineProperty(s, 'allMatches', {
        enumerable: true,
        get: function () {
          if (!_allMatches) _allMatches = matchCards(cards, state.lockMap, undefined, _index);
          return _allMatches;
        }
      });
      return s;
    }

    /** Restore full internal state (used by plugins via internals registry) */
    function _setState(s) {
      state.cur = s.cur;
      state.lockMap = s.lockMap;
      state.lockOrder = s.lockOrder;
    }

    var engineId = nextId++;
    var engine = {
      cards: cards,
      navigate: navigate,
      reset: reset,
      getState: getState,
      _id: engineId
    };
    internals[engineId] = { setState: _setState, index: _index };
    return engine;
  }

  // --- Plugin system ---

  var plugins = {};

  function register(name, installer) {
    plugins[name] = installer;
  }

  function use(engine, name) {
    if (!plugins[name]) throw new Error('DCL: unknown plugin "' + name + '"');
    plugins[name](engine, internals[engine._id] || {});
    return engine;
  }

  // --- Built-in plugin: memory (undo/redo with direction awareness) ---
  //
  // Stores full state snapshots so undo/redo restores locks correctly.
  // Detects opposite-direction navigation and converts it to undo/redo.

  register('memory', function (engine, priv) {
    var undoStack = [];   // each entry: { state, dir }
    var redoStack = [];   // each entry: { state, dir }
    var dirStack  = [];   // path of directions taken, enables full backtracking
    var maxSize = UNDO_MAX;

    var _navigate = engine.navigate;
    var _reset = engine.reset;
    var _getState = engine.getState;
    var peekCache = {};   // dir → cardId — ensures peek/navigate consistency
    var peekAllCache = null;  // cached peekAll result, invalidated on state change

    function snapshot() { return _getState.call(engine); }

    function restore(snap) {
      priv.setState({
        cur: snap.cur,
        lockMap: assign({}, snap.lockMap),
        lockOrder: snap.lockOrder.slice()
      });
    }

    function resultFromState(flags) {
      var s = _getState.call(engine);
      var r = assign({
        card: s.cur,
        candidates: matchCards(engine.cards, s.lockMap, s.cur.id, priv.index),
        released: [],
        lockMap: s.lockMap,
        lockOrder: s.lockOrder
      }, flags);
      var _allM;
      Object.defineProperty(r, 'allMatches', {
        enumerable: true,
        get: function () {
          if (!_allM) _allM = matchCards(engine.cards, s.lockMap, undefined, priv.index);
          return _allM;
        }
      });
      return r;
    }

    // Check if dir backtracks (opposite of the last direction in the path)
    function dirHint(dir) {
      if (dirStack.length && dir === OPPOSITE[dirStack[dirStack.length - 1]]) {
        return 'undo';
      }
      if (!dirStack.length && redoStack.length && redoStack[redoStack.length - 1].dir === dir) {
        return 'redo';
      }
      return null;
    }

    function invalidateCache() {
      peekCache = {};
      peekAllCache = null;
    }

    engine.navigate = function (dir) {
      var hint = dirHint(dir);
      if (hint === 'undo') { invalidateCache(); return engine.undo(); }
      if (hint === 'redo') { invalidateCache(); return engine.redo(); }

      var snap = snapshot();
      var targetId = peekCache[dir];
      invalidateCache();
      var result = _navigate.call(engine, dir, targetId);
      if (result) {
        undoStack.push({ state: snap, dir: dir });
        if (undoStack.length > maxSize) {
          undoStack.shift();
          dirStack.shift();
        }
        redoStack = [];
        dirStack.push(dir);
        result.undone = false;
        result.redone = false;
      }
      return result;
    };

    engine.reset = function () {
      undoStack = [];
      redoStack = [];
      dirStack  = [];
      invalidateCache();
      _reset.call(engine);
    };

    engine.undo = function () {
      if (!undoStack.length) return null;
      invalidateCache();
      var entry = undoStack.pop();
      redoStack.push({ state: snapshot(), dir: entry.dir });
      restore(entry.state);
      dirStack.pop();
      return resultFromState({ undone: true, redone: false });
    };

    engine.redo = function () {
      if (!redoStack.length) return null;
      invalidateCache();
      var entry = redoStack.pop();
      undoStack.push({ state: snapshot(), dir: entry.dir });
      restore(entry.state);
      dirStack.push(entry.dir);
      return resultFromState({ undone: false, redone: true });
    };

    engine.canUndo = function () { return undoStack.length > 0; };
    engine.canRedo = function () { return redoStack.length > 0; };

    engine.peek = function (dir) {
      if (peekAllCache) return peekAllCache[dir];
      return engine.peekAll()[dir];
    };

    engine.peekAll = function () {
      if (peekAllCache) return peekAllCache;

      var out = {};
      var snap = snapshot();
      for (var i = 0; i < DIRS.length; i++) {
        var dir = DIRS[i];
        var hint = dirHint(dir);
        if (hint === 'undo') {
          out[dir] = { card: undoStack[undoStack.length - 1].state.cur, type: 'undo' };
        } else if (hint === 'redo') {
          out[dir] = { card: redoStack[redoStack.length - 1].state.cur, type: 'redo' };
        } else {
          var result = _navigate.call(engine, dir);
          restore(snap);
          if (result) {
            peekCache[dir] = result.card.id;
            out[dir] = { card: result.card, type: 'navigate' };
          } else {
            out[dir] = null;
          }
        }
      }
      peekAllCache = out;
      return out;
    };
  });

  // Public API
  var api = {
    DIRS: DIRS,
    create: create,
    register: register,
    use: use,
    generateCards: generateCards,
    getPool: function (cards, lockMap, excludeId) { return matchCards(cards, lockMap, excludeId); },
    getAllMatch: function (cards, lockMap) { return matchCards(cards, lockMap); }
  };

  return api;
})();

// UMD export — works in browser (global), CommonJS (require), and ESM (import)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DCL;
}
