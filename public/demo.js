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

  var ARROWS = DCL.ARROWS;

  // --- i18n: read strings from <body data-i18n-*> ---
  var body = document.body;
  var i18n = {
    hint:        body.getAttribute('data-i18n-hint') || 'Click any direction to start',
    fifo:        body.getAttribute('data-i18n-fifo') || 'FIFO unlock:',
    poolEmpty:   body.getAttribute('data-i18n-pool-empty') || 'No constraints locked yet',
    trailEmpty:  body.getAttribute('data-i18n-trail-empty') || 'No trail yet'
  };

  // --- Initialize engine ---
  var engine = DCL.create({ cardCount: 40, seed: 2025 });

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
    var result = engine.navigate(dir);
    if (!result) return;

    if (result.released.length) {
      var msg = result.released.map(function (r) {
        return ARROWS[r.dir] + '=' + r.val;
      }).join(', ');
      showToast(msg);
      flashUnlocked(result.released.map(function (r) { return r.dir; }));
    }

    render();
  }

  // --- Render ---
  function render() {
    var s = engine.getState();
    var cur = s.cur;
    var lockMap = s.lockMap;
    var lockOrder = s.lockOrder;
    var history = s.history;
    var fullPool = s.fullPool;

    renderLockBar(lockOrder, lockMap);
    renderPoolCount(fullPool.length);
    renderNavigator(cur, lockMap, lockOrder, fullPool, s.counter);
    renderPoolDisplay(lockOrder, fullPool, cur);
    renderHistory(history, cur);
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
      tag.textContent = ARROWS[d] + ' = ' + lockMap[d];
      bar.appendChild(tag);
    });
  }

  function renderPoolCount(count) {
    document.getElementById('pool-count').textContent = count;
  }

  function renderNavigator(cur, lockMap, lockOrder, fullPool, counter) {
    var nav = document.getElementById('navigator');
    nav.innerHTML = '';

    GRID.forEach(function (key) {
      if (key === '__center__') {
        nav.appendChild(buildCenterCard(cur, lockMap, lockOrder, fullPool, counter));
      } else {
        nav.appendChild(buildDirButton(key, cur, lockMap));
      }
    });
  }

  function buildCenterCard(cur, lockMap, lockOrder, fullPool, counter) {
    var el = document.createElement('div');
    el.id = 'current-card';

    var maxDots = Math.min(fullPool.length, 8);
    var key = DCL.lockKey(lockMap, lockOrder);
    var pos = lockOrder.length
      ? ((counter[key] || 1) - 1 + fullPool.length) % fullPool.length
      : 0;

    var dotHtml = '';
    if (maxDots > 1) {
      var dots = [];
      for (var i = 0; i < maxDots; i++) {
        dots.push('<div class="cycle-dot' + (i === pos % maxDots ? ' active' : '') + '"></div>');
      }
      dotHtml = '<div class="cycle-indicator">' + dots.join('') + '</div>';
    }

    el.innerHTML =
      '<div class="card-id">' + cur.label + '</div>' +
      '<div class="card-sub">#' + (cur.id + 1) + '</div>' +
      dotHtml;

    return el;
  }

  function buildDirButton(dir, cur, lockMap) {
    var btn = document.createElement('button');
    btn.className = 'dir-btn' + (dir in lockMap ? ' locked' : '');
    btn.id = 'db-' + dir;
    btn.innerHTML =
      '<span class="dir-arrow">' + ARROWS[dir] + '</span>' +
      '<span class="dir-val">' + cur.attrs[dir] + '</span>';
    btn.onclick = function () { navigate(dir); };
    return btn;
  }

  function renderPoolDisplay(lockOrder, fullPool, cur) {
    var el = document.getElementById('pool-cards');
    if (!lockOrder.length) {
      el.innerHTML = '<span class="pool-empty">' + i18n.poolEmpty + '</span>';
      return;
    }
    var html = fullPool.slice(0, 24).map(function (c) {
      return '<span class="pool-card' + (c.id === cur.id ? ' current' : '') + '">' + c.label + '</span>';
    }).join('');
    if (fullPool.length > 24) {
      html += '<span class="pool-card">+' + (fullPool.length - 24) + '</span>';
    }
    el.innerHTML = html;
  }

  function renderHistory(history, cur) {
    var el = document.getElementById('history-inner');
    var trail = history.concat([cur.label]);
    if (trail.length <= 1) {
      el.innerHTML = '<span class="hist-empty">' + i18n.trailEmpty + '</span>';
      return;
    }
    el.innerHTML = trail.map(function (label, i) {
      return (i > 0 ? '<span class="hist-sep">\u203A</span>' : '') +
        '<span class="hist-item' + (i === trail.length - 1 ? ' current' : '') + '">' + label + '</span>';
    }).join('');
  }

  // --- Public controls ---
  window.resetDCL = function () {
    engine.reset();
    render();
  };

  window.clearHistory = function () {
    engine.clearHistory();
    render();
  };

  // --- Init ---
  render();
})();
