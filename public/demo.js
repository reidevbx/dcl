/**
 * DCL Demo — UI layer
 *
 * Renders the interactive demo using the DCL engine (dcl.js).
 * Reads UI strings from data-i18n-* attributes on <body> for localization.
 */
(function () {
  'use strict';

  // Grid layout (center = current card)
  var GRID = [
    'leftUp', 'up', 'rightUp',
    'left', '__center__', 'right',
    'leftDown', 'down', 'rightDown'
  ];

  var ARROWS = {
    leftUp: '\u2196', up: '\u2191', rightUp: '\u2197',
    left: '\u2190',                  right: '\u2192',
    leftDown: '\u2199', down: '\u2193', rightDown: '\u2198'
  };

  // --- Display helpers (presentation concern, not in core algorithm) ---
  function categoryLabel(val) {
    var i = val - 1;
    return i < 26 ? String.fromCharCode(65 + i) : 'A' + (i - 25);
  }

  function cardLabel(card) {
    return String(card.id + 1);
  }

  // --- i18n: read strings from <body data-i18n-*> ---
  var body = document.body;
  var i18n = {
    hint:        body.getAttribute('data-i18n-hint') || 'Click any direction to start',
    fifo:        body.getAttribute('data-i18n-fifo') || 'FIFO unlock:',
    poolEmpty:   body.getAttribute('data-i18n-pool-empty') || 'No constraints locked yet',
    trailEmpty:  body.getAttribute('data-i18n-trail-empty') || 'No trail yet'
  };

  // --- Trail tracking (display concern, managed by UI layer) ---
  var TRAIL_MAX = 12;
  var trail = [];
  var visited = {};  // card id → true, tracks all visited cards

  // --- Image preloading strategy ---
  // Cards may optionally have a .src property pointing to an image URL.
  // preloadImages: prefetch images for peek targets (next possible cards)
  // lazyImage: create an <img> with loading="lazy" for pool display

  var _preloaded = {};  // url → true, avoids duplicate preloads

  function preloadImage(url) {
    if (!url || _preloaded[url]) return;
    _preloaded[url] = true;
    var img = new Image();
    img.src = url;
  }

  function preloadPeekTargets() {
    if (!memoryEnabled || !engine.peekAll) return;
    var peeks = engine.peekAll();
    for (var d in peeks) {
      if (peeks[d] && peeks[d].card && peeks[d].card.src) {
        preloadImage(peeks[d].card.src);
      }
    }
  }

  function cardImageHtml(card, cls) {
    if (card.src) {
      return '<img class="' + (cls || '') + '" src="' + card.src + '" loading="lazy" alt="#' + cardLabel(card) + '">';
    }
    return '';
  }

  // --- Initialize engine ---
  var engine = DCL.create({ cardCount: 100, categories: 20 });

  // --- Toast ---
  var toastTimer = null;

  function showToast(msg) {
    var el = document.getElementById('fifo-toast');
    el.textContent = i18n.fifo + ' ' + msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function flashUnlocked(dirs) {
    dirs.forEach(function (d) {
      var btn = document.getElementById('db-' + d);
      if (!btn) return;
      btn.classList.add('unlocked-flash');
      setTimeout(function () { btn.classList.remove('unlocked-flash'); }, 500);
    });
  }

  // --- Navigate ---
  function navigate(dir) {
    var prev = engine.getState().cur;
    visited[prev.id] = true;
    var result = engine.navigate(dir);
    if (!result) return;

    visited[result.card.id] = true;

    // Track trail for display
    if (result.undone) {
      if (trail.length) trail.pop();
    } else if (!result.redone) {
      trail.push(cardLabel(prev));
      if (trail.length > TRAIL_MAX) trail.shift();
    }

    if (result.released && result.released.length) {
      var msg = result.released.map(function (r) {
        return ARROWS[r.dir] + '=' + categoryLabel(r.val);
      }).join(', ');
      showToast(msg);
      flashUnlocked(result.released.map(function (r) { return r.dir; }));
    }

    render();
    updateMemoryBtns();
    preloadPeekTargets();
  }

  // --- Render ---
  function render() {
    var s = engine.getState();
    var cur = s.cur;
    var lockMap = s.lockMap;
    var lockOrder = s.lockOrder;
    var allMatches = s.allMatches;

    renderLockBar(lockOrder, lockMap);
    renderPoolCount(allMatches.length);
    renderNavigator(cur, lockMap, lockOrder, allMatches);
    renderPoolDisplay(lockOrder, allMatches, cur);
    renderHistory(trail, cur);
  }

  function renderLockBar(lockOrder, lockMap) {
    var bar = document.getElementById('locks-bar');
    bar.innerHTML = '';
    if (!lockOrder.length) {
      bar.innerHTML = '<span class="status-hint">' + i18n.hint + '</span>';
      return;
    }
    lockOrder.forEach(function (d) {
      var tag = document.createElement('span');
      tag.className = 'lock-tag';
      tag.textContent = ARROWS[d] + ' = ' + categoryLabel(lockMap[d]);
      bar.appendChild(tag);
    });
  }

  function renderPoolCount(count) {
    document.getElementById('pool-count').textContent = count;
  }

  function renderNavigator(cur, lockMap, lockOrder, allMatches) {
    var nav = document.getElementById('navigator');
    nav.innerHTML = '';

    GRID.forEach(function (key) {
      if (key === '__center__') {
        nav.appendChild(buildCenterCard(cur, lockMap, lockOrder, allMatches));
      } else {
        nav.appendChild(buildDirButton(key, cur, lockMap));
      }
    });
  }

  function buildCenterCard(cur, lockMap, lockOrder, allMatches) {
    var el = document.createElement('div');
    el.id = 'current-card';

    var maxDots = Math.min(allMatches.length, 8);
    var pos = 0;
    if (lockOrder.length) {
      for (var p = 0; p < allMatches.length; p++) {
        if (allMatches[p].id === cur.id) { pos = p; break; }
      }
    }

    var dotHtml = '';
    if (maxDots > 1) {
      var dots = [];
      for (var i = 0; i < maxDots; i++) {
        dots.push('<div class="cycle-dot' + (i === pos % maxDots ? ' active' : '') + '"></div>');
      }
      dotHtml = '<div class="cycle-indicator">' + dots.join('') + '</div>';
    }

    el.innerHTML =
      cardImageHtml(cur, 'card-img') +
      '<div class="card-id">#' + cardLabel(cur) + '</div>' +
      dotHtml;

    return el;
  }

  function buildDirButton(dir, cur, lockMap) {
    var btn = document.createElement('button');
    var cls = 'dir-btn' + (dir in lockMap ? ' locked' : '');

    // Peek info (undo/redo hints) when memory plugin is active
    var peekHint = '';
    if (memoryEnabled && engine.peek) {
      var p = engine.peek(dir);
      if (p && p.type === 'undo') {
        cls += ' peek-undo';
        peekHint = '<span class="dir-peek">\u21A9 ' + cardLabel(p.card) + '</span>';
      } else if (p && p.type === 'redo') {
        cls += ' peek-redo';
        peekHint = '<span class="dir-peek">\u21AA ' + cardLabel(p.card) + '</span>';
      }
    }

    btn.className = cls;
    btn.id = 'db-' + dir;
    btn.innerHTML =
      '<span class="dir-arrow">' + ARROWS[dir] + '</span>' +
      '<span class="dir-val">' + categoryLabel(cur.attrs[dir]) + '</span>' +
      peekHint;
    btn.onclick = function () { navigate(dir); };
    return btn;
  }

  function renderPoolDisplay(lockOrder, allMatches, cur) {
    var el = document.getElementById('pool-cards');
    if (!lockOrder.length) {
      el.innerHTML = '<span class="pool-empty">' + i18n.poolEmpty + '</span>';
      return;
    }
    var html = allMatches.slice(0, 24).map(function (c) {
      var cls = 'pool-card';
      if (c.id === cur.id) cls += ' current';
      else if (visited[c.id]) cls += ' visited';
      return '<span class="' + cls + '">' + cardImageHtml(c, 'pool-img') + cardLabel(c) + '</span>';
    }).join('');
    if (allMatches.length > 24) {
      html += '<span class="pool-card">+' + (allMatches.length - 24) + '</span>';
    }
    el.innerHTML = html;
  }

  function renderHistory(trailLabels, cur) {
    var el = document.getElementById('history-inner');
    var display = trailLabels.concat([cardLabel(cur)]);
    if (display.length <= 1) {
      el.innerHTML = '<span class="hist-empty">' + i18n.trailEmpty + '</span>';
      return;
    }
    el.innerHTML = display.map(function (label, i) {
      return (i > 0 ? '<span class="hist-sep">\u203A</span>' : '') +
        '<span class="hist-item' + (i === display.length - 1 ? ' current' : '') + '">' + label + '</span>';
    }).join('');
  }

  // --- Memory plugin ---
  var memoryEnabled = false;

  function updateMemoryBtns() {
    var undoBtn = document.getElementById('undo-btn');
    var redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = !memoryEnabled || !engine.canUndo();
    if (redoBtn) redoBtn.disabled = !memoryEnabled || !engine.canRedo();
  }

  window.toggleMemory = function (on) {
    if (on && !memoryEnabled) {
      DCL.use(engine, 'memory');
      memoryEnabled = true;
      engine.reset();
      trail = [];
      visited = {};
    }
    var undoBtn = document.getElementById('undo-btn');
    var redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.style.display = on ? '' : 'none';
    if (redoBtn) redoBtn.style.display = on ? '' : 'none';
    updateMemoryBtns();
    render();
  };

  window.undoDCL = function () {
    if (!memoryEnabled || !engine.undo) return;
    var result = engine.undo();
    if (!result) return;
    if (trail.length) trail.pop();
    render();
    updateMemoryBtns();
  };

  window.redoDCL = function () {
    if (!memoryEnabled || !engine.redo) return;
    var prev = engine.getState().cur;
    var result = engine.redo();
    if (!result) return;
    trail.push(cardLabel(prev));
    if (trail.length > TRAIL_MAX) trail.shift();
    render();
    updateMemoryBtns();
  };

  // --- Public controls ---
  window.resetDCL = function () {
    engine.reset();
    trail = [];
    visited = {};
    render();
    updateMemoryBtns();
  };

  window.clearHistory = function () {
    trail = [];
    render();
  };

  // --- Init ---
  render();
})();
