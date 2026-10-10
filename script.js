(function () {
    'use strict';

    // ============================================================
    // КОНСТАНТЫ
    // ============================================================
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

    // ============================================================
    // DOM
    // ============================================================
    var boardEl   = document.getElementById('board');
    var gridLayer = document.getElementById('gridLayer');
    var tilesLayer= document.getElementById('tilesLayer');
    var scoreEl   = document.getElementById('score');
    var bestEl    = document.getElementById('best');

    // ============================================================
    // СОСТОЯНИЕ
    // ============================================================
    var grid;                    // [r][c] = { id, level } | null
    var score = 0;
    var best = parseInt(localStorage.getItem('poker2048-best') || '0', 10) || 0;
    var over = false;
    var won = false;
    var idCounter = 0;

    // Реестр DOM-узлов плиток: id → HTMLElement
    var tiles = {};

    // Размеры клетки (пересчитываются при resize)
    var cellW = 88;
    var cellH = 104;
    var gap = 10;
    var pad = 12;

    bestEl.textContent = best;

    // ============================================================
    // РАЗМЕРЫ
    // ============================================================
    function recalcSizes() {
        // Читаем из CSS-переменных
        var style = getComputedStyle(document.documentElement);
        cellW = parseFloat(style.getPropertyValue('--cell-w')) || 88;
        cellH = parseFloat(style.getPropertyValue('--cell-h')) || 104;
        gap   = parseFloat(style.getPropertyValue('--gap'))   || 10;
        pad   = parseFloat(style.getPropertyValue('--pad'))   || 12;

        // Пересчитываем позиции всех плиток
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                var card = grid && grid[r][c];
                if (card && tiles[card.id]) {
                    applyPosition(tiles[card.id], r, c, true);
                }
            }
        }
    }

    function applyPosition(node, r, c, instant) {
        var x = c * (cellW + gap);
        var y = r * (cellH + gap);
        // Сохраняем для keyframes
        node.style.setProperty('--tx', x + 'px');
        node.style.setProperty('--ty', y + 'px');

        if (instant) {
            var oldTransition = node.style.transition;
            node.style.transition = 'none';
            node.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
            void node.offsetWidth;
            node.style.transition = oldTransition || '';
        } else {
            node.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
        }
    }

    // ============================================================
    // СЕТКА (GRID LAYER)
    // ============================================================
    function buildGridLayer() {
        gridLayer.innerHTML = '';
        for (var i = 0; i < SIZE * SIZE; i++) {
            var cell = document.createElement('div');
            cell.className = 'grid-cell';
            gridLayer.appendChild(cell);
        }
    }

    // ============================================================
    // ПЛИТКИ (TILE DOM)
    // ============================================================
    function createTileNode(id, level) {
        var node = document.createElement('div');
        node.className = 'tile';
        node.setAttribute('data-id', id);
        node.setAttribute('data-level', level);

        var art = document.createElement('div');
        art.className = 'tile-art';
        node.appendChild(art);

        var val = document.createElement('div');
        val.className = 'tile-value';
        node.appendChild(val);

        // Текст/эмодзи внутри арта
        var emoji = document.createElement('div');
        emoji.className = 'tile-emoji';
        emoji.style.display = 'none';
        art.appendChild(emoji);

        var label = document.createElement('div');
        label.className = 'tile-label';
        art.appendChild(label);

        return node;
    }

    function updateTileContent(node, level) {
        node.setAttribute('data-level', level);

        var emoji = node.querySelector('.tile-emoji');
        var label = node.querySelector('.tile-label');
        var value = node.querySelector('.tile-value');
        var combo = COMBOS[level];

        value.textContent = combo.value;

        if (level === MAX_LEVEL) {
            emoji.style.display = '';
            emoji.textContent = '\uD83D\uDC51';
            label.textContent = 'Роял-флеш';
        } else {
            emoji.style.display = 'none';
            emoji.textContent = '';
            label.textContent = combo.short;
        }
    }

    // ============================================================
    // ЛОГИКА
    // ============================================================
    function emptyGrid() {
        var g = [];
        for (var r = 0; r < SIZE; r++) {
            var row = [];
            for (var c = 0; c < SIZE; c++) row.push(null);
            g.push(row);
        }
        return g;
    }

    function randInt(n) { return Math.floor(Math.random() * n); }

    function canMerge(a, b) {
        if (!a || !b) return false;
        return a.level === b.level && a.level < MAX_LEVEL;
    }

    // ============================================================
    // НОВАЯ КАРТА
    // ============================================================
    function spawnRandomCard() {
        var empties = [];
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (!grid[r][c]) empties.push({ r: r, c: c });
            }
        }
        if (!empties.length) return null;

        var pos = empties[randInt(empties.length)];
        var lvl = Math.random() < 0.9 ? 0 : 1;

        var card = { id: 'c' + (++idCounter), level: lvl };
        grid[pos.r][pos.c] = card;

        // Создаём DOM
        var node = createTileNode(card.id, lvl);
        updateTileContent(node, lvl);
        tilesLayer.appendChild(node);
        tiles[card.id] = node;

        // Позиционируем БЕЗ анимации, потом — анимация появления
        applyPosition(node, pos.r, pos.c, true);
        node.classList.add('tile-new');

        // Снимаем класс после анимации
        setTimeout(function () {
            node.classList.remove('tile-new');
        }, 300);

        return card;
    }

    // ============================================================
    // ХОД
    // ============================================================
    function move(dir) {
        if (over || won) return;

        var before = serializeGrid();
        var mergedTiles = []; // { node, newLevel, r, c }
        var removedTiles = []; // id

        // Идём по линиям
        for (var li = 0; li < SIZE; li++) {
            var coords = [];
            for (var j = 0; j < SIZE; j++) {
                var r, c;
                if (dir === 'l')      { r = li; c = j; }
                else if (dir === 'r') { r = li; c = SIZE - 1 - j; }
                else if (dir === 'u') { r = j; c = li; }
                else                  { r = SIZE - 1 - j; c = li; }
                coords.push({ r: r, c: c });
            }

            // Собираем карты
            var items = [];
            for (var k = 0; k < coords.length; k++) {
                var p = coords[k];
                if (grid[p.r][p.c]) items.push(grid[p.r][p.c]);
            }

            // Обрабатываем
            var out = [];
            var mergedInfo = []; // параллельный массив: { sourceIds: [id1, id2] } или null
            var idx = 0;

            while (idx < items.length) {
                if (idx + 1 < items.length && canMerge(items[idx], items[idx + 1])) {
                    // Слияние
                    var a = items[idx];
                    var b = items[idx + 1];
                    // Новая карта — использует id от "a", уровень +1
                    var newCard = { id: a.id, level: a.level + 1 };
                    out.push(newCard);
                    mergedInfo.push({ source: b.id, newLevel: newCard.level });
                    score += COMBOS[newCard.level].value;
                    idx += 2;
                } else {
                    out.push(items[idx]);
                    mergedInfo.push(null);
                    idx += 1;
                }
            }

            // Раскладываем
            for (var j2 = 0; j2 < coords.length; j2++) {
                var pos = coords[j2];
                if (j2 < out.length) {
                    grid[pos.r][pos.c] = out[j2];
                    // Если было слияние — запоминаем
                    if (mergedInfo[j2]) {
                        mergedTiles.push({
                            id: out[j2].id,
                            absorbedId: mergedInfo[j2].source,
                            newLevel: mergedInfo[j2].newLevel,
                            r: pos.r,
                            c: pos.c
                        });
                    }
                } else {
                    grid[pos.r][pos.c] = null;
                }
            }
        }

        if (serializeGrid() === before) return;

        // === АНИМАЦИЯ ДВИЖЕНИЯ ===
        // Все существующие плитки двигаются к своим новым позициям
        for (var r2 = 0; r2 < SIZE; r2++) {
            for (var c2 = 0; c2 < SIZE; c2++) {
                var card2 = grid[r2][c2];
                if (!card2) continue;
                var node2 = tiles[card2.id];
                if (!node2) continue;
                // Позиция уже правильная, если карта не двигалась — transition не сработает
                applyPosition(node2, r2, c2, false);
            }
        }

        // Слияния: таймер на удаление поглощённой плитки + обновление уровня
        for (var mi = 0; mi < mergedTiles.length; mi++) {
            (function (info) {
                // Поглощённая плитка едет в ту же точку, потом удаляется
                var absorbedNode = tiles[info.absorbedId];
                if (absorbedNode) {
                    // Она уже едет через applyPosition выше, но её позиция
                    // в grid отсутствует — нужно задать явно
                    applyPosition(absorbedNode, info.r, info.c, false);
                }

                setTimeout(function () {
                    // Удаляем поглощённую
                    if (absorbedNode && absorbedNode.parentNode) {
                        absorbedNode.parentNode.removeChild(absorbedNode);
                    }
                    delete tiles[info.absorbedId];

                    // Обновляем выжившую
                    var winnerNode = tiles[info.id];
                    if (winnerNode) {
                        updateTileContent(winnerNode, info.newLevel);
                        winnerNode.classList.add('tile-merged');
                        setTimeout(function () {
                            winnerNode.classList.remove('tile-merged');
                        }, 320);
                    }
                }, 160);
            })(mergedTiles[mi]);
        }

        // Новая случайная карта
        setTimeout(function () {
            spawnRandomCard();
            checkEnd();
        }, 170);

        // Обновляем счёт и best
        if (score > best) {
            best = score;
            localStorage.setItem('poker2048-best', String(best));
        }
        scoreEl.textContent = score;
        bestEl.textContent = best;
    }

    function serializeGrid() {
        var s = '';
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                s += (grid[r][c] ? grid[r][c].id + ':' + grid[r][c].level : '-') + '|';
            }
            s += '/';
        }
        return s;
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

    function checkEnd() {
        // Проверка победы
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (grid[r][c] && grid[r][c].level === MAX_LEVEL) {
                    won = true;
                    showGameOver('\uD83D\uDC51 РОЯЛ-ФЛЕШ! \uD83D\uDC51');
                    return;
                }
            }
        }
        // Проверка проигрыша
        if (!canMove()) {
            over = true;
            showGameOver('ИГРА ОКОНЧЕНА');
        }
    }

    function showGameOver(text) {
        var el = document.createElement('div');
        el.className = 'game-over';

        var t = document.createElement('div');
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

    // ============================================================
    // INIT
    // ============================================================
    function init() {
        // Убираем overlay если есть
        var go = boardEl.querySelector('.game-over');
        if (go) go.remove();

        // Очищаем всё
        tilesLayer.innerHTML = '';
        tiles = {};
        grid = emptyGrid();
        score = 0;
        over = false;
        won = false;
        idCounter = 0;

        scoreEl.textContent = score;
        bestEl.textContent = best;

        spawnRandomCard();
        spawnRandomCard();
    }

    // ============================================================
    // УПРАВЛЕНИЕ
    // ============================================================
    var keyMap = {
        ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd',
        a: 'l', d: 'r', w: 'u', s: 'd',
        A: 'l', D: 'r', W: 'u', S: 'd',
        '\u0444': 'l', '\u0432': 'r', '\u0446': 'u', '\u044b': 'd'
    };

    document.addEventListener('keydown', function (e) {
        var dir = keyMap[e.key];
        if (dir) { e.preventDefault(); move(dir); }
        if (e.key === 'r' || e.key === 'R' || e.key === '\u043a' || e.key === '\u041a') init();
    });

    // ---- Свайпы ----
    var touchStart = null;

    boardEl.addEventListener('touchstart', function (e) {
        if (e.touches.length > 1) return;
        var t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    boardEl.addEventListener('touchmove', function (e) {
        if (touchStart) e.preventDefault();
    }, { passive: false });

    boardEl.addEventListener('touchend', function (e) {
        if (!touchStart) return;
        var t = e.changedTouches[0];
        var dx = t.clientX - touchStart.x;
        var dy = t.clientY - touchStart.y;
        touchStart = null;

        if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'r' : 'l');
        else move(dy > 0 ? 'd' : 'u');
    }, { passive: true });

    boardEl.addEventListener('touchcancel', function () {
        touchStart = null;
    });

    // ---- Кнопка ----
    document.getElementById('newGame').addEventListener('click', init);

    // ---- Resize ----
    var resizeTimeout = null;
    window.addEventListener('resize', function () {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(recalcSizes, 100);
    });

    // ============================================================
    // СТАРТ
    // ============================================================
    buildGridLayer();
    init();
})();
