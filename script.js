(function () {
    'use strict';

    var SIZE = 4;

    // ============================================================
    // КОМБИНАЦИИ
    // ============================================================
    var BASE_COMBOS = [
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
    var MAX_LEVEL = 20;

    function getCombo(level) {
        if (level < BASE_COMBOS.length) return BASE_COMBOS[level];
        var baseValue = 1024 * Math.pow(2, level - 9);
        var suffixes = ['', '🔥', '💎', '⚡', '👑', '🌟', '💫', '🏆'];
        var suffix = suffixes[(level - 9) % suffixes.length];
        return {
            name: 'Роял-флеш ' + suffix,
            value: baseValue,
            short: 'Роял-флеш ' + suffix,
            img: 'img/1024.png'
        };
    }

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

    // ============================================================
    // DOM
    // ============================================================
    var boardEl    = document.getElementById('board');
    var gridLayer  = document.getElementById('gridLayer');
    var tilesLayer = document.getElementById('tilesLayer');
    var scoreEl    = document.getElementById('score');
    var bestEl     = document.getElementById('best');
    var undoBtn    = document.getElementById('undoBtn');

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
    
    // Undo
    var previousState = null;

    var cellW = 88;
    var cellH = 104;
    var gap = 8;
    var pad = 10;
    var frame = 8;

    bestEl.textContent = best;

    // ============================================================
    // РАЗМЕРЫ
    // ============================================================
    function recalcSizes() {
        var maxBoardWidth;
        if (window.innerWidth < 520) {
            maxBoardWidth = window.innerWidth - 24;
        } else {
            maxBoardWidth = Math.min(window.innerWidth - 32, 460);
        }
        var padSize = maxBoardWidth < 380 ? 6 : 10;
        var gapSize = maxBoardWidth < 380 ? 6 : 8;

        var availableW = maxBoardWidth - 2 * frame - 2 * padSize - 3 * gapSize;
        var cw = Math.floor(availableW / 4);
        var ch = Math.floor(cw * 1.18);

        cellW = cw; cellH = ch; gap = gapSize; pad = padSize;

        var innerW = 4 * cw + 3 * gapSize + 2 * padSize;
        var innerH = 4 * ch + 3 * gapSize + 2 * padSize;

        boardEl.style.width  = innerW + 'px';
        boardEl.style.height = innerH + 'px';

        var gridW = 4 * cw + 3 * gapSize;
        var gridH = 4 * ch + 3 * gapSize;

        gridLayer.style.top = padSize + 'px';
        gridLayer.style.left = padSize + 'px';
        gridLayer.style.width = gridW + 'px';
        gridLayer.style.height = gridH + 'px';
        gridLayer.style.gridTemplateColumns = 'repeat(4, ' + cw + 'px)';
        gridLayer.style.gridTemplateRows = 'repeat(4, ' + ch + 'px)';
        gridLayer.style.gap = gapSize + 'px';

        tilesLayer.style.top = padSize + 'px';
        tilesLayer.style.left = padSize + 'px';
        tilesLayer.style.width = gridW + 'px';
        tilesLayer.style.height = gridH + 'px';

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
        node.style.setProperty('--tx', x + 'px');
        node.style.setProperty('--ty', y + 'px');
        node.style.width = cellW + 'px';
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
    // СПРАВОЧНИК И УПРАВЛЕНИЕ МОДАЛКОЙ
    // ============================================================
    function buildCombosList() {
        var listEl = document.getElementById('combosList');
        if (!listEl) return;
        listEl.innerHTML = '';
        for (var i = 0; i < BASE_COMBOS.length; i++) {
            var combo = BASE_COMBOS[i];
            var row = document.createElement('div');
            row.className = 'combo-row';
            row.setAttribute('data-level', String(i));
            
            var img = document.createElement('img');
            img.className = 'row-img';
            img.src = combo.img;
            img.alt = combo.name;
            row.appendChild(img);

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

            var value = document.createElement('div');
            value.className = 'row-value';
            value.textContent = combo.value;
            row.appendChild(value);

            listEl.appendChild(row);
        }
    }

    function openCombosModal() {
        var modal = document.getElementById('combosModal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeCombosModal() {
        var modal = document.getElementById('combosModal');
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    // ============================================================
    // СЕТКА И ПЛИТКИ
    // ============================================================
    function buildGridLayer() {
        gridLayer.innerHTML = '';
        for (var i = 0; i < SIZE * SIZE; i++) {
            var cell = document.createElement('div');
            cell.className = 'grid-cell';
            gridLayer.appendChild(cell);
        }
    }

    function createTileNode(id, level) {
        var node = document.createElement('div');
        node.className = 'tile';
        node.setAttribute('data-id', id);
        node.setAttribute('data-level', level);

        var art = document.createElement('div');
        art.className = 'tile-art';
        var img = document.createElement('img');
        img.className = 'tile-img';
        img.draggable = false;
        art.appendChild(img);
        node.appendChild(art);

        var val = document.createElement('div');
        val.className = 'tile-value';
        node.appendChild(val);

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
        var img = node.querySelector('.tile-img');
        var emoji = node.querySelector('.tile-emoji');
        var label = node.querySelector('.tile-label');
        var value = node.querySelector('.tile-value');
        var combo = getCombo(level);

        value.textContent = combo.value;
        label.textContent = combo.short;

        if (combo.img) {
            img.src = combo.img;
            img.style.display = '';
            label.style.display = 'none';
            emoji.style.display = 'none';
        } else {
            img.style.display = 'none';
            label.style.display = '';
            if (level >= 9) {
                emoji.style.display = '';
                emoji.textContent = '👑';
            } else {
                emoji.style.display = 'none';
            }
        }
    }

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
        setTimeout(function () { node.classList.remove('tile-new'); }, 300);

        return card;
    }

    // ============================================================
    // UNDO (ОТМЕНА ХОДА)
    // ============================================================
    function saveState() {
        var gridCopy = [];
        for (var r = 0; r < SIZE; r++) {
            var row = [];
            for (var c = 0; c < SIZE; c++) {
                var card = grid[r][c];
                row.push(card ? { id: card.id, level: card.level } : null);
            }
            gridCopy.push(row);
        }
        previousState = { grid: gridCopy, score: score, idCounter: idCounter };
        if (undoBtn) undoBtn.disabled = false;
    }

    function undoMove() {
        if (!previousState || over) return;

        // Очищаем DOM
        tilesLayer.innerHTML = '';
        tiles = {};

        // Восстанавливаем состояние
        grid = emptyGrid();
        score = previousState.score;
        idCounter = previousState.idCounter;
        won = false; // сбрасываем победу, если откатились

        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                var savedCard = previousState.grid[r][c];
                if (savedCard) {
                    grid[r][c] = { id: savedCard.id, level: savedCard.level };
                    
                    var node = createTileNode(savedCard.id, savedCard.level);
                    updateTileContent(node, savedCard.level);
                    tilesLayer.appendChild(node);
                    tiles[node.dataset.id] = node; // тут небольшой хак
                    tiles[savedCard.id] = node;
                    
                    applyPosition(node, r, c, true);
                }
            }
        }

        scoreEl.textContent = score;
        previousState = null; // Откат только на 1 шаг
        if (undoBtn) undoBtn.disabled = true;
    }

    // ============================================================
    // ЧИТ-КОД
    // ============================================================
    var cheatInput = '';
    var CHEAT_CODE = 'poker';

    function handleCheatInput(key) {
        cheatInput += key.toLowerCase();
        if (cheatInput.length > CHEAT_CODE.length) {
            cheatInput = cheatInput.slice(-CHEAT_CODE.length);
        }
        if (cheatInput === CHEAT_CODE) {
            cheatInput = '';
            activateCheat();
        }
    }

    function activateCheat() {
        if (over) return;
        saveState(); // можно отменить чит

        // Ищем свободное место (или заменяем самое слабое)
        var emptySpots = [];
        var lowestLevel = 999;
        var lowestR = -1, lowestC = -1;

        for (var r = 0; r < SIZE; r++) {
            for (var c = 0; c < SIZE; c++) {
                if (!grid[r][c]) {
                    emptySpots.push({ r: r, c: c });
                } else if (grid[r][c].level < lowestLevel) {
                    lowestLevel = grid[r][c].level;
                    lowestR = r;
                    lowestC = c;
                }
            }
        }

        var target;
        if (emptySpots.length > 0) {
            target = emptySpots[randInt(emptySpots.length)];
        } else {
            target = { r: lowestR, c: lowestC };
            // Удаляем старую плитку
            var oldCard = grid[target.r][target.c];
            if (oldCard && tiles[oldCard.id]) {
                tiles[oldCard.id].parentNode.removeChild(tiles[oldCard.id]);
                delete tiles[oldCard.id];
            }
        }

        // Создаём Роял-флеш (уровень 9)
        var cheatCard = { id: 'cheat_' + Date.now(), level: 9 };
        grid[target.r][target.c] = cheatCard;

        var node = createTileNode(cheatCard.id, 9);
        updateTileContent(node, 9);
        tilesLayer.appendChild(node);
        tiles[cheatCard.id] = node;

        applyPosition(node, target.r, target.c, true);
        node.classList.add('tile-new');

        // Празднование и обновление счёта (дадим очки за чит)
        score += 1024;
        if (score > best) {
            best = score;
            localStorage.setItem('poker2048-best', String(best));
        }
        scoreEl.textContent = score;
        bestEl.textContent = best;

        showCelebration();
    }

    // ============================================================
    // ХОД
    // ============================================================
    function move(dir) {
        if (over) return;

        var before = serializeGrid();

        // === СОХРАНЯЕМ СОСТОЯНИЕ ДО ЛЮБЫХ ИЗМЕНЕНИЙ ===
        var gridSnapshot = [];
        for (var sr = 0; sr < SIZE; sr++) {
            var rowSnap = [];
            for (var sc = 0; sc < SIZE; sc++) {
                var cardSnap = grid[sr][sc];
                rowSnap.push(cardSnap ? { id: cardSnap.id, level: cardSnap.level } : null);
            }
            gridSnapshot.push(rowSnap);
        }
        previousState = {
            grid: gridSnapshot,
            score: score,
            idCounter: idCounter,
            won: won
        };
        // ================================================

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
                    score += getCombo(newCard.level).value;
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

        // Если ничего не сдвинулось — отменяем сохранение (чтобы не портить previousState)
        if (serializeGrid() === before) {
            previousState = null;
            if (undoBtn) undoBtn.disabled = true;
            return;
        }

        // Активируем кнопку Undo
        if (undoBtn) undoBtn.disabled = false;

        // Движение
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
        if (!won) {
            for (var r = 0; r < SIZE; r++) {
                for (var c = 0; c < SIZE; c++) {
                    if (grid[r][c] && grid[r][c].level >= 9) {
                        won = true;
                        showCelebration();
                        return;
                    }
                }
            }
        }
        if (!canMove()) {
            over = true;
            showGameOver('ИГРА ОКОНЧЕНА');
        }
    }

    function showCelebration() {
        var el = document.createElement('div');
        el.className = 'celebration';
        el.innerHTML = '👑 РОЯЛ-ФЛЕШ! 👑<br><span style="font-size:16px;opacity:.8;">Соберите ещё!</span>';
        boardEl.appendChild(el);
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 2500);
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

    function init() {
        var go = boardEl.querySelector('.game-over');
        if (go) go.remove();
        var cel = boardEl.querySelector('.celebration');
        if (cel) cel.remove();

        tilesLayer.innerHTML = '';
        tiles = {};
        grid = emptyGrid();
        score = 0;
        over = false;
        won = false;
        idCounter = 0;
        previousState = null;

        if (undoBtn) undoBtn.disabled = true;

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
        'ф': 'l', 'в': 'r', 'ц': 'u', 'ы': 'd'
    };

    document.addEventListener('keydown', function (e) {
        var dir = keyMap[e.key];
        if (dir) { e.preventDefault(); move(dir); }
        
        if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') init();
        
        // Undo по клавише Z
        if (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я') undoMove();

        // Чит-код
        if (/^[a-zA-Zа-яА-Я]$/.test(e.key)) {
            handleCheatInput(e.key);
        }
    });

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
    
    if (undoBtn) undoBtn.addEventListener('click', undoMove);
    
    var combosBtn = document.getElementById('combosBtn');
    var combosClose = document.getElementById('combosClose');
    var combosBackdrop = document.getElementById('combosBackdrop');

    if (combosBtn) combosBtn.addEventListener('click', openCombosModal);
    if (combosClose) combosClose.addEventListener('click', closeCombosModal);
    if (combosBackdrop) combosBackdrop.addEventListener('click', closeCombosModal);

    var resizeTimeout = null;
    window.addEventListener('resize', function () {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(recalcSizes, 100);
    });

    buildCombosList();
    buildGridLayer();
    recalcSizes();
    init();
})();
