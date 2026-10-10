(function () {
    'use strict';

    // ============================================================
    // КОНСТАНТЫ
    // ============================================================
    var SIZE = 4;

       var COMBOS = [
        { name: 'Старшая карта', value: 2,    short: 'Старшая',    img: 'img/2.png' },
        { name: 'Пара',          value: 4,    short: 'Пара',       img: 'img/4.png' },
        { name: 'Две пары',      value: 8,    short: 'Две пары',   img: 'img/8.png' },
        { name: 'Сет',           value: 16,   short: 'Сет',        img: 'img/16.png' },
        { name: 'Стрит',         value: 32,   short: 'Стрит',      img: 'img/32.png' },
        { name: 'Флеш',          value: 64,   short: 'Флеш',       img: 'img/64.png' },
        { name: 'Фулл-хаус',     value: 128,  short: 'Фулл-хаус',  img: 'img/128.png' },
        { name: 'Каре',          value: 256,  short: 'Каре',       img: 'img/256.png' },
        { name: 'Стрит-флеш',    value: 512,  short: 'Стрит-флеш', img: 'img/512.png' },
        { name: 'Роял-флеш',     value: 1024, short: 'Роял-флеш',  img: 'img/1024.png' }
    ];
    var MAX_LEVEL = COMBOS.length - 1;

    // ============================================================
    // DOM
    // ============================================================
    var boardEl    = document.getElementById('board');
    var gridLayer  = document.getElementById('gridLayer');
    var tilesLayer = document.getElementById('tilesLayer');
    var scoreEl    = document.getElementById('score');
    var bestEl     = document.getElementById('best');

    // ============================================================
    // СОСТОЯНИЕ
    // ============================================================
    var grid;
    var score = 0;
    var best = parseInt(localStorage.getItem('poker2048-best') || '0', 10) || 0;
    var over = false;
    var won = false;
    var idCounter = 0;
    var tiles = {};

    // Размеры — вычисляются в recalcSizes()
    var cellW = 88;
    var cellH = 104;
    var gap = 8;
    var pad = 10;
    var frame = 8;   // толщина рамки .board (должна совпадать с CSS)

    bestEl.textContent = best;

    // ============================================================
    // РАЗМЕРЫ
    // ============================================================
       function recalcSizes() {
        // 1. Доступная ширина
        var maxBoardWidth;
        if (window.innerWidth < 520) {
            maxBoardWidth = window.innerWidth - 24;
        } else {
            maxBoardWidth = Math.min(window.innerWidth - 32, 460);
        }

        // 2. Внутренние отступы
        var padSize = maxBoardWidth < 380 ? 6 : 10;
        var gapSize = maxBoardWidth < 380 ? 6 : 8;

        // 3. Размер клетки
        // boardInner = 4*cellW + 3*gap + 2*pad  (без рамки)
        var availableW = maxBoardWidth - 2 * frame - 2 * padSize - 3 * gapSize;
        var cw = Math.floor(availableW / 4);
        var ch = Math.floor(cw * 1.18);

        cellW = cw;
        cellH = ch;
        gap   = gapSize;
        pad   = padSize;

        // 4. Размеры board
        var innerW = 4 * cw + 3 * gapSize + 2 * padSize;
        var innerH = 4 * ch + 3 * gapSize + 2 * padSize;

        boardEl.style.width  = innerW + 'px';
        boardEl.style.height = innerH + 'px';

        // 5. Слои — задаём И размер, И позицию
        var gridW = 4 * cw + 3 * gapSize;
        var gridH = 4 * ch + 3 * gapSize;

        gridLayer.style.top    = padSize + 'px';
        gridLayer.style.left   = padSize + 'px';
        gridLayer.style.width  = gridW + 'px';
        gridLayer.style.height = gridH + 'px';
        gridLayer.style.gridTemplateColumns = 'repeat(4, ' + cw + 'px)';
        gridLayer.style.gridTemplateRows    = 'repeat(4, ' + ch + 'px)';
        gridLayer.style.gap = gapSize + 'px';

        tilesLayer.style.top    = padSize + 'px';
        tilesLayer.style.left   = padSize + 'px';
        tilesLayer.style.width  = gridW + 'px';
        tilesLayer.style.height = gridH + 'px';

        // 6. Пересчитываем позиции плиток
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                var card = grid && grid[r][c];
                if (card && tiles[card.id]) {
                    applyPosition(tiles[card.id], r, c, true);
                }
            }
        }

        // 7. Диагностика (убери потом)
        console.log('SIZES',
            '| cw:', cw, 'ch:', ch,
            '| gap:', gapSize, 'pad:', padSize,
            '| board:', innerW + '×' + innerH,
            '| grid:', gridW + '×' + gridH
        );
    }

    function applyPosition(node, r, c, instant) {
        var x = c * (cellW + gap);
        var y = r * (cellH + gap);
        node.style.setProperty('--tx', x + 'px');
        node.style.setProperty('--ty', y + 'px');
        node.style.width  = cellW + 'px';
        node.style.height = cellH + 'px';

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
    // СПРАВОЧНИК КОМБИНАЦИЙ
    // ============================================================
    var COMBO_DESCRIPTIONS = [
        'Одна любая карта. Основа всего — собирайте пары.',
        'Две карты одного ранга. Сливаются в «Две пары».',
        'Две пары разных рангов. Сливаются в «Сет».',
        'Три карты одного ранга. Сливаются в «Стрит».',
        'Пять карт подряд по рангу. Сливаются в «Флеш».',
        'Пять карт одной масти. Сливаются в «Фулл-хаус».',
        'Тройка + пара. Сливаются в «Каре».',
        'Четыре карты одного ранга. Сливаются в «Стрит-флеш».',
        'Пять карт подряд одной масти. Сливаются в «Роял-флеш».',
        'Высшая комбинация: 10 J Q K A одной масти. 🏆 Победа!'
    ];

    function buildCombosList() {
        var listEl = document.getElementById('combosList');
        if (!listEl) return;

        listEl.innerHTML = '';

        for (var i = 0; i < COMBOS.length; i++) {
            var combo = COMBOS[i];

            var row = document.createElement('div');
            row.className = 'combo-row';
            row.setAttribute('data-level', String(i));

            // Картинка
            var img = document.createElement('img');
            img.className = 'row-img';
            img.src = combo.img || '';
            img.alt = combo.name;
            row.appendChild(img);

            // Информация
            var info = document.createElement('div');
            info.className = 'row-info';

            var name = document.createElement('div');
            name.className = 'row-name';
            name.textContent = combo.name;
            info.appendChild(name);

            var desc = document.createElement('div');
            desc.className = 'row-desc';
            desc.textContent = COMBO_DESCRIPTIONS[i] || '';
            info.appendChild(desc);

            row.appendChild(info);

            // Значение
            var value = document.createElement('div');
            value.className = 'row-value';
            value.textContent = combo.value;
            row.appendChild(value);

            listEl.appendChild(row);
        }
    }

    // ---- Управление модальным окном ----
    function openCombosModal() {
        var modal = document.getElementById('combosModal');
        if (!modal) return;
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeCombosModal() {
        var modal = document.getElementById('combosModal');
        if (!modal) return;
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    // ---- Слушатели ----
    var combosBtn = document.getElementById('combosBtn');
    var combosClose = document.getElementById('combosClose');
    var combosBackdrop = document.getElementById('combosBackdrop');

    if (combosBtn) {
        combosBtn.addEventListener('click', openCombosModal);
    }
    if (combosClose) {
        combosClose.addEventListener('click', closeCombosModal);
    }
    if (combosBackdrop) {
        combosBackdrop.addEventListener('click', closeCombosModal);
    }

    // Закрытие по Esc
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeCombosModal();
    });

    // Собираем список при старте
    buildCombosList();
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

        // Картинка-арт комбинации
        var img = document.createElement('img');
        img.className = 'tile-img';
        img.alt = '';
        img.draggable = false;
        art.appendChild(img);

        node.appendChild(art);

        var val = document.createElement('div');
        val.className = 'tile-value';
        node.appendChild(val);

        // Эмодзи (для fallback, если картинки нет)
        var emoji = document.createElement('div');
        emoji.className = 'tile-emoji';
        emoji.style.display = 'none';
        art.appendChild(emoji);

        // Текстовая метка (для fallback, если картинки нет)
        var label = document.createElement('div');
        label.className = 'tile-label';
        art.appendChild(label);

        return node;
    }

       function updateTileContent(node, level) {
        node.setAttribute('data-level', level);

        var img   = node.querySelector('.tile-img');
        var emoji = node.querySelector('.tile-emoji');
        var label = node.querySelector('.tile-label');
        var value = node.querySelector('.tile-value');
        var combo = COMBOS[level];

        value.textContent = combo.value;
        label.textContent = combo.short;

        // Если у комбинации есть картинка — показываем её
        if (combo.img) {
            img.src = combo.img;
            img.style.display = '';
            img.onerror = function () {
                // Если картинка не загрузилась — fallback на текст
                img.style.display = 'none';
                label.style.display = '';
                if (level === MAX_LEVEL) {
                    emoji.style.display = '';
                    emoji.textContent = '\uD83D\uDC51';
                }
            };
            // Скрываем текстовую метку — картинка сама всё скажет
            label.style.display = 'none';
            emoji.style.display = 'none';
        } else {
            // Нет картинки — показываем текст
            img.style.display = 'none';
            label.style.display = '';
            if (level === MAX_LEVEL) {
                emoji.style.display = '';
                emoji.textContent = '\uD83D\uDC51';
            } else {
                emoji.style.display = 'none';
            }
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

        var node = createTileNode(card.id, lvl);
        updateTileContent(node, lvl);
        tilesLayer.appendChild(node);
        tiles[card.id] = node;

        applyPosition(node, pos.r, pos.c, true);
        node.classList.add('tile-new');

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
        var mergedTiles = [];

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

            var items = [];
            for (var k = 0; k < coords.length; k++) {
                var p = coords[k];
                if (grid[p.r][p.c]) items.push(grid[p.r][p.c]);
            }

            var out = [];
            var mergedInfo = [];
            var idx = 0;

            while (idx < items.length) {
                if (idx + 1 < items.length && canMerge(items[idx], items[idx + 1])) {
                    var a = items[idx];
                    var b = items[idx + 1];
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

            for (var j2 = 0; j2 < coords.length; j2++) {
                var pos = coords[j2];
                if (j2 < out.length) {
                    grid[pos.r][pos.c] = out[j2];
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

        // Движение всех плиток
        for (var r2 = 0; r2 < SIZE; r2++) {
            for (var c2 = 0; c2 < SIZE; c2++) {
                var card2 = grid[r2][c2];
                if (!card2) continue;
                var node2 = tiles[card2.id];
                if (!node2) continue;
                applyPosition(node2, r2, c2, false);
            }
        }

        // Слияния
        for (var mi = 0; mi < mergedTiles.length; mi++) {
            (function (info) {
                var absorbedNode = tiles[info.absorbedId];
                if (absorbedNode) {
                    applyPosition(absorbedNode, info.r, info.c, false);
                }

                setTimeout(function () {
                    if (absorbedNode && absorbedNode.parentNode) {
                        absorbedNode.parentNode.removeChild(absorbedNode);
                    }
                    delete tiles[info.absorbedId];

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

        setTimeout(function () {
            spawnRandomCard();
            checkEnd();
        }, 170);

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
        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (grid[r][c] && grid[r][c].level === MAX_LEVEL) {
                    won = true;
                    showGameOver('\uD83D\uDC51 РОЯЛ-ФЛЕШ! \uD83D\uDC51');
                    return;
                }
            }
        }
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
        var go = boardEl.querySelector('.game-over');
        if (go) go.remove();

        tilesLayer.innerHTML = '';
        tiles = {};
        grid = emptyGrid();
        score = 0;
        over = false;
        won = false;
        idCounter = 0;

        scoreEl.textContent = score;
        bestEl.textContent = best;

        recalcSizes();
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

    document.getElementById('newGame').addEventListener('click', init);

    var resizeTimeout = null;
    window.addEventListener('resize', function () {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(recalcSizes, 100);
    });

    // ============================================================
    // СТАРТ
    // ============================================================
    buildGridLayer();
    recalcSizes();
    init();
})();
