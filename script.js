(function () {
    'use strict';

    var SIZE = 4;

    var COMBOS = [
        { name: 'Старшая карта', value: 2,    short: 'Старшая' },
        { name: 'Пара',          value: 4,    short: 'Пара' },
        { name: 'Две пары',      value: 8,    short: 'Две пары' },
        { name: 'Сет',           value: 16,   short: 'Сет' },
        { name: 'Стрит',         value: 32,   short: 'Стрит' },
        { name: 'Флеш',          value: 64,   short: 'Флеш' },
        { name: 'Фулл-хаус',     value: 128,  short: 'Фулл-хаус' },
        { name: 'Каре',          value: 256,  short: 'Каре' },
        { name: 'Стрит-флеш',    value: 512,  short: 'Стрит-флеш' },
        { name: 'Роял-флеш',     value: 1024, short: 'Роял-флеш' }
    ];
    var MAX_LEVEL = COMBOS.length - 1;

    var boardEl = document.getElementById('board');
    var scoreEl = document.getElementById('score');
    var bestEl  = document.getElementById('best');

    var grid, score, best, over, won;
    var idCounter = 0;

    best = parseInt(localStorage.getItem('poker2048-best') || '0', 10) || 0;
    bestEl.textContent = best;

    function randInt(n) { return Math.floor(Math.random() * n); }

    function emptyGrid() {
        var g = [];
        for (var r = 0; r < SIZE; r++) {
            var row = [];
            for (var c = 0; c < SIZE; c++) row.push(null);
            g.push(row);
        }
        return g;
    }

    // ---------- РЕНДЕР ----------
    // mergedKeys = { 'r:c': true } — где нужен merge-пульс
    // newIds     = { id: true }    — какие карты анимировать как "новые"
    function render(mergedKeys, newIds) {
        mergedKeys = mergedKeys || {};
        newIds = newIds || {};

        boardEl.innerHTML = '';

        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                var cell = document.createElement('div');
                cell.className = 'cell';

                var card = grid[r][c];
                if (card) {
                    var el = document.createElement('div');
                    el.className = 'card lvl' + card.level;
                    el.setAttribute('data-id', card.id);
                    el.setAttribute('data-r', String(r));
                    el.setAttribute('data-c', String(c));

                    if (mergedKeys[r + ':' + c]) el.classList.add('merge');
                    if (newIds[card.id]) el.classList.add('card-new');

                    var combo = COMBOS[card.level];

                    var valEl = document.createElement('span');
                    valEl.className = 'value';
                    valEl.textContent = combo.value;
                    el.appendChild(valEl);

                    if (card.level === MAX_LEVEL) {
                        var emojiEl = document.createElement('div');
                        emojiEl.className = 'emoji';
                        emojiEl.textContent = '\uD83D\uDC51';
                        el.appendChild(emojiEl);
                    }

                    var nameEl = document.createElement('div');
                    nameEl.className = 'combo-name';
                    nameEl.textContent = card.level === MAX_LEVEL ? 'Роял-флеш' : combo.short;
                    el.appendChild(nameEl);

                    cell.appendChild(el);
                }
                boardEl.appendChild(cell);
            }
        }

        scoreEl.textContent = score;
        bestEl.textContent = best;
    }

    // ---------- ПРАВИЛА ----------
    function canMerge(a, b) {
        if (!a || !b) return false;
        return a.level === b.level && a.level < MAX_LEVEL;
    }

    // ---------- ХОД ----------
    function move(dir) {
        if (over || won) return;

        // === FLIP: снимаем позиции всех карт ДО хода ===
        var oldRects = {};
        var oldNodes = boardEl.querySelectorAll('.card');
        for (var i = 0; i < oldNodes.length; i++) {
            var node = oldNodes[i];
            var id = node.getAttribute('data-id');
            if


(id) oldRects[id] = node.getBoundingClientRect();
        }

        var before = serializeGrid();
        var mergedKeys = {};
        var newIds = {};

        // Идём по 4 линиям в направлении хода
        for (var li = 0; li < SIZE; li++) {
            var lineCoords = [];
            for (var j = 0; j < SIZE; j++) {
                var r, c;
                if (dir === 'l')      { r = li; c = j; }
                else if (dir === 'r') { r = li; c = SIZE - 1 - j; }
                else if (dir === 'u') { r = j; c = li; }
                else                  { r = SIZE - 1 - j; c = li; }
                lineCoords.push({ r: r, c: c });
            }

            // Собираем непустые карты
            var items = [];
            for (var k = 0; k < lineCoords.length; k++) {
                var p = lineCoords[k];
                if (grid[p.r][p.c]) items.push(grid[p.r][p.c]);
            }

            // Слияние
            var out = [];
            var outMerged = [];
            var idx = 0;
            while (idx < items.length) {
                if (idx + 1 < items.length && canMerge(items[idx], items[idx + 1])) {
                    var newCard = { level: items[idx].level + 1, id: 'c' + (++idCounter) };
                    newIds[newCard.id] = true;
                    out.push(newCard);
                    outMerged.push(true);
                    score += COMBOS[newCard.level].value;
                    idx += 2;
                } else {
                    out.push(items[idx]);
                    outMerged.push(false);
                    idx += 1;
                }
            }

            // Раскладываем обратно
            for (var j2 = 0; j2 < SIZE; j2++) {
                var pos = lineCoords[j2];
                if (j2 < out.length) {
                    grid[pos.r][pos.c] = out[j2];
                    if (outMerged[j2]) mergedKeys[pos.r + ':' + pos.c] = true;
                } else {
                    grid[pos.r][pos.c] = null;
                }
            }
        }

        // Ничего не сдвинулось — выходим
        if (serializeGrid() === before) return;

        // Добавляем новую карту (тоже "новая" для анимации появления)
        var spawned = addRandomCard();
        if (spawned) newIds[spawned.id] = true;

        if (score > best) {
            best = score;
            localStorage.setItem('poker2048-best', String(best));
        }

        // Перестраиваем DOM
        render(mergedKeys, newIds);

        // Запускаем "переплывание"
        animateFlip(oldRects);

        // Победа / проигрыш
        if (checkWin()) return;
        if (!canMove()) {
            over = true;
            setTimeout(function () { showGameOver('ИГРА ОКОНЧЕНА'); }, 500);
        }
    }

    // === FLIP-анимация ===
    function animateFlip(oldRects) {
        var newNodes = boardEl.querySelectorAll('.card');

        for (var i = 0; i < newNodes.length; i++) {
            var node = newNodes[i];
            var id = node.getAttribute('data-id');
            if (!id) continue;
            if (!oldRects[id]) continue; // новая карта — не трогаем

            var newRect = node.getBoundingClientRect();
            var oldRect = oldRects[id];
            var dx = oldRect.left - newRect.left;
            var dy = oldRect.top  - newRect.top;

            if (dx === 0 && dy === 0) continue;

            // 1. Мгновенно ставим в старую позицию (без transition, без animation)
            node.classList.add('teleport');
            node.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';

            // 2. Форсируем reflow, чтобы браузер "принял" новую позицию
            void node.offsetWidth;

            // 3. В следующем кадре — включаем transition и возвращаем transform
            (function (n) {
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        n.classList.remove('teleport');
                        n.style.transform = '';


});
                });
            })(node);
        }
    }

    function serializeGrid() {
        var s = '';
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                s += (grid[r][c] ? grid[r][c].level : '-') + '|';
            }
            s += '/';
        }
        return s;
    }

    // Возвращаем созданную карту (для newIds)
    function addRandomCard() {
        var empties = [];
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (!grid[r][c]) empties.push([r, c]);
            }
        }
        if (!empties.length) return null;
        var pos = empties[randInt(empties.length)];
        var lvl = Math.random() < 0.9 ? 0 : 1;
        var card = { level: lvl, id: 'c' + (++idCounter) };
        grid[pos[0]][pos[1]] = card;
        return card;
    }

    function canMove() {
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (!grid[r][c]) return true;
                if (c < SIZE - 1 && canMerge(grid[r][c], grid[r][c + 1])) return true;
                if (r < SIZE - 1 && canMerge(grid[r][c], grid[r + 1][c])) return true;
            }
        }
        return false;
    }

    function checkWin() {
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (grid[r][c] && grid[r][c].level === MAX_LEVEL) {
                    won = true;
                    showGameOver('\uD83D\uDC51 РОЯЛ-ФЛЕШ! \uD83D\uDC51');
                    return true;
                }
            }
        }
        return false;
    }

    function showGameOver(text) {
        var el = document.createElement('div');
        el.className = 'game-over';

        var t = document.createElement('div');
        t.style.fontSize = '28px';
        t.textContent = text;
        el.appendChild(t);

        var s = document.createElement('div');
        s.style.fontSize = '14px';
        s.style.opacity = '0.8';
        s.textContent = 'Счёт: ' + score;
        el.appendChild(s);

        var btn = document.createElement('button');
        btn.textContent = 'Играть заново';
        btn.addEventListener('click', init);
        el.appendChild(btn);

        boardEl.appendChild(el);
    }

    function init() {
        grid = emptyGrid();
        score = 0;
        won = false;
        over = false;
        addRandomCard();
        addRandomCard();
        render();
    }

    var keyMap = {
        ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd',
        a: 'l', d: 'r', w: 'u', s: 'd',
        A: 'l', D: 'r', W: 'u', S: 'd',
        'ф': 'l', 'в': 'r', 'ц': 'u', 'ы': 'd'
    };

    document.addEventListener('keydown', function (e) {
        var dir = keyMap[e.key];
        if (dir) { e.preventDefault(); move(dir); }
        if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') init();
    });

    var touchStart = null;

boardEl.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) return;    // игнорируем мультитач (зум двумя пальцами)
    var t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });

boardEl.addEventListener('touchmove', function (e) {
    if (touchStart) e.preventDefault();   // блокируем скролл, когда играем
}, { passive: false });

boardEl.addEventListener('touchend', function (e) {
    if (!touchStart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.x;
    var dy = t.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;  // слишком короткий свайп
    if (Math.abs(dx) > Math.abs(dy)) {
        move(dx > 0 ? 'r' : 'l');
    } else {
        move(dy > 0 ? 'd' : 'u');
    }
}, { passive: true });

boardEl.addEventListener('touchcancel', function () {
    touchStart = null;
});

    document.getElementById('newGame').addEventListener('click', init);

    init();
})();





