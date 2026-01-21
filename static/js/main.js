function setScreenHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.body.style.height = (window.innerHeight) + "px";
}

window.addEventListener('resize', setScreenHeight);
setScreenHeight();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'play') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'draw') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(500, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'attack') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'alert') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(700, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'special') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

function playFanfare() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    [523, 659, 783, 1046].forEach((f, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.5);
        o.start(audioCtx.currentTime + i * 0.15);
        o.stop(audioCtx.currentTime + i * 0.15 + 0.5);
    });
}

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let deck = [], discardPile = [], players = [], currentPlayerIndex = 0, turnDirection = 1;
let isGameRunning = true, isProcessingTurn = false, drawStack = 0, currentEffectiveSuit = null;
let oneCardTimer = null;

const el = {
    discard: document.getElementById('discard-pile'),
    hand: document.getElementById('player-hand'),
    log: document.getElementById('game-log'),
    badge: document.getElementById('draw-penalty-badge'),
    suitInd: document.getElementById('current-suit-indicator'),
    suitModal: document.getElementById('suit-modal'),
    btnOneCard: document.getElementById('one-card-btn'),
    btnRestart: document.getElementById('restart-btn'),
    cpuVisuals: [null,
        document.querySelector('#cpu1 .cpu-hand-visual'),
        document.querySelector('#cpu2 .cpu-hand-visual'),
        document.querySelector('#cpu3 .cpu-hand-visual')]
};

function initGame() {
    players = [
        {id: 0, name: "YOU", isCpu: false, hand: []},
        {id: 1, name: "CPU1", isCpu: true, hand: []},
        {id: 2, name: "CPU2", isCpu: true, hand: []},
        {id: 3, name: "CPU3", isCpu: true, hand: []}
    ];
    createDeck();
    shuffleDeck();
    dealCards();
    updateUI();
    log("내 차례에 카드를 내거나 덱을 눌러 뽑으세요.");
    highlightCurrentPlayer();
}

function createDeck() {
    deck = [];
    suits.forEach(s => ranks.forEach(r => deck.push({suit: s, rank: r, isJoker: false})));
    deck.push({suit: 'Joker', rank: 'Black', isJoker: true});
    deck.push({suit: 'Joker', rank: 'Color', isJoker: true});
}

// 덱 셔플
function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

// 초반 카드 나누기
function dealCards() {
    for (let i = 0; i < 5; i++) players.forEach(p => {
        if (deck.length) p.hand.push(deck.pop());
    });
    const first = deck.pop();
    discardPile.push(first);
    currentEffectiveSuit = first.isJoker ? 'ANY' : first.suit;
}

// 카드 뽑기
function drawCard(player) {
    if (!deck.length) reshuffle();
    let count = drawStack > 0 ? drawStack : 1;
    for (let i = 0; i < count; i++) {
        if (deck.length) {
            player.hand.push(deck.pop());
            if (!deck.length) reshuffle();
        }

        playSound('draw');
    }

    if (drawStack > 0) {
        log(`${player.name}, ${drawStack}장 먹음!`);
        drawStack = 0;
    }
    updateUI();
}

// 덱 리필
function reshuffle() {
    if (discardPile.length <= 1) return;
    const top = discardPile.pop();
    deck = discardPile;
    discardPile = [top];
    shuffleDeck();
    log("덱 셔플");
}

function isAttack(c) {
    return c.isJoker || c.rank === '2' || c.rank === 'A';
}

function getAttackVal(c) {
    if (c.isJoker) return c.rank === 'Color' ? 7 : 5;
    if (c.rank === 'A') return 3;
    if (c.rank === '2') return 2;
    return 0;
}

// 낼 수 있는 여부
function isValid(c, top) {
    if (drawStack > 0) {
        // 조커는 언제나 방어 가능
        if (c.isJoker) return true;

        // 2 공격 방어: 2, 같은 무늬 A, 조커
        if (top.rank === '2') {
            return c.rank === '2' || (c.rank === 'A' && c.suit === currentEffectiveSuit);
        }

        // A 공격 방어: A, 조커
        if (top.rank === 'A') {
            return c.rank === 'A';
        }

        // 조커 공격 방어: 조커
        if (top.isJoker) {
            return false;
        }

        return false;
    }
    if (c.isJoker || top.isJoker || currentEffectiveSuit === 'ANY') return true;
    return c.rank === top.rank || c.suit === currentEffectiveSuit;
}

// 승리조건 체크
function checkWin(pid) {
    if (players[pid].hand.length === 0) {
        isGameRunning = false;
        el.btnRestart.style.display = 'block';
        if (pid === 0) {
            playFanfare();
            log(`🎉 축하합니다! 승리했습니다!`);
        } else {
            log(players[pid].name + " 승리... 다음 기회에");
        }
        return true;
    }
    return false;
}

// 다음 턴
function nextTurn() {
    if (!isGameRunning) return;
    if (checkWin(currentPlayerIndex)) return;
    currentPlayerIndex = (currentPlayerIndex + turnDirection + 4) % 4;
    updateUI();
    highlightCurrentPlayer();

    if (players[currentPlayerIndex].isCpu) {
        isProcessingTurn = true;
        setTimeout(cpuTurn, 800);
    } else {
        isProcessingTurn = false;
        log(drawStack > 0 ? `방어하거나 ${drawStack}장 드로우!` : "당신의 차례");
    }
}

function playerDraw() {
    if (currentPlayerIndex !== 0 || isProcessingTurn) return;
    drawCard(players[0]);
    updateUI();
    nextTurn();
};

function playerPlay(idx) {
    if (currentPlayerIndex !== 0 || isProcessingTurn) return;
    const card = players[0].hand[idx];
    const top = discardPile[discardPile.length - 1];

    if (isValid(card, top)) {
        isProcessingTurn = true;
        players[0].hand.splice(idx, 1);
        discardPile.push(card);

        if (card.isJoker) currentEffectiveSuit = 'ANY';
        else if (card.rank !== '7') currentEffectiveSuit = card.suit;

        if (!isAttack(card) && !['K', 'Q', 'J', '7'].includes(card.rank)) playSound('play');

        updateUI();
        if (checkWin(0)) return;

        checkOneCard(0, () => {
            const res = processEffect(card, 0);
            if (res !== 'WAIT_UI' && res !== 'REPEAT') nextTurn();
            else if (res === 'REPEAT') {
                isProcessingTurn = false;
                log("한 번 더!");
                updateUI();
            }
        });
    } else {
        log("낼 수 없습니다.");
    }
}

function cpuTurn() {
    if (!isGameRunning) return;
    const cpu = players[currentPlayerIndex];
    const top = discardPile[discardPile.length - 1];
    const idx = cpu.hand.findIndex(c => isValid(c, top));

    if (idx !== -1) {
        const card = cpu.hand.splice(idx, 1)[0];
        discardPile.push(card);

        if (card.isJoker) currentEffectiveSuit = 'ANY';
        else if (card.rank !== '7') currentEffectiveSuit = card.suit;

        if (!isAttack(card) && !['K', 'Q', 'J', '7'].includes(card.rank)) playSound('play');
        updateUI();

        if (checkWin(currentPlayerIndex)) return;

        checkOneCard(currentPlayerIndex, () => {
            const res = processEffect(card, currentPlayerIndex);
            if (res === 'REPEAT') setTimeout(cpuTurn, 800);
            else nextTurn();
        });
    } else {
        drawCard(cpu);
        nextTurn();
    }
}

// 턴, 특수 효과
function processEffect(c, pid) {
    if (isAttack(c)) {
        const dmg = getAttackVal(c);
        drawStack += dmg;
        log(`공격! +${dmg} (총 ${drawStack}장)`);
        playSound('attack');
    }
    if (c.rank === 'K') {
        playSound('special');
        return 'REPEAT';
    }
    if (c.rank === 'Q') {
        playSound('special');
        turnDirection *= -1;
    }
    if (c.rank === 'J') {
        playSound('special');
        currentPlayerIndex = (currentPlayerIndex + turnDirection + 4) % 4;
    }
    if (c.rank === '7') {
        playSound('special');
        if (players[pid].isCpu) {
            const cnt = {'♠': 0, '♥': 0, '♦': 0, '♣': 0};
            players[pid].hand.forEach(h => {
                if (!h.isJoker) cnt[h.suit]++
            });
            currentEffectiveSuit = Object.keys(cnt).reduce((a, b) => cnt[a] > cnt[b] ? a : b);
            log(`${players[pid].name}: ${currentEffectiveSuit}로 변경`);
            return 'NEXT';
        } else {
            el.suitModal.style.display = 'flex';
            return 'WAIT_UI';
        }
    }
    return 'NEXT';
}

function resolveSuitSelection(s) {
    el.suitModal.style.display = 'none';
    currentEffectiveSuit = s;
    log(`${s}로 변경됨`);
    updateUI();
    nextTurn();
};

function checkOneCard(pid, cb) {
    if (players[pid].hand.length === 1) {
        playSound('alert');
        el.btnOneCard.style.display = 'block';
        el.btnOneCard.style.left = Math.random() * (window.innerWidth - 100) + 'px';
        el.btnOneCard.style.top = Math.random() * (window.innerHeight - 100) + 'px';

        let clicked = false;
        el.btnOneCard.onclick = () => {
            clicked = true;
            el.btnOneCard.style.display = 'none';
            clearTimeout(oneCardTimer);
            if (pid === 0) log("방어 성공!");
            else {
                log("견제 성공! (+1장)");
                let temp = drawStack;
                drawStack = 0;
                drawCard(players[pid]);
                drawStack = temp;
            }
            cb();
        };
        oneCardTimer = setTimeout(() => {
            el.btnOneCard.onclick = null;
            if (!clicked) {
                el.btnOneCard.style.display = 'none';
                if (pid === 0) {
                    log("원카드 실패 (+1)");
                    let temp = drawStack;
                    drawStack = 0;
                    drawCard(players[0]);
                    drawStack = temp;
                }
                cb();
            }
        }, 800);
    } else cb();
}

// [수정] 카드 HTML 생성 로직
function createCardHTML(card) {
    if (card.isJoker) {
        // 조커: 좌측 상단에 세로로 JOKER 표시
        return `
                <div class="card-corner">
                    <div class="joker-corner-text">J</div>
                    <div class="joker-corner-text">O</div>
                    <div class="joker-corner-text">K</div>
                    <div class="joker-corner-text">E</div>
                    <div class="joker-corner-text">R</div>
                </div>
                <span class="diagonal-text">JOKER</span>
            `;
    }
    // 일반: 좌측 상단 문양 -> 숫자 순서
    return `
            <div class="card-corner">
                <div>${card.rank}</div>
                <div>${card.suit}</div>
            </div>
            <div class="card-center">
                ${card.suit}${card.rank}
            </div>
        `;
}

function updateUI() {
    const top = discardPile[discardPile.length - 1];
    let cls = `card ${['♥', '♦'].includes(top.suit) || top.rank === 'Color' ? 'red' : 'black'}`;
    if (top.isJoker) cls = top.rank === 'Color' ? 'card joker-color' : 'card joker-black';

    el.discard.className = cls;
    el.discard.innerHTML = createCardHTML(top);

    if (drawStack > 0) {
        el.badge.style.display = 'flex';
        el.badge.textContent = drawStack;
    } else el.badge.style.display = 'none';

    let sIcon = currentEffectiveSuit === 'ANY' ?
        `<span class="suit-icon any-suit">자유</span>` :
        `<span class="suit-icon ${['♥', '♦'].includes(currentEffectiveSuit) ? 'red-suit' : 'black-suit'}">${currentEffectiveSuit}</span>`;
    el.suitInd.innerHTML = `현재: ${sIcon}`;

    // 내 패
    renderPlayerHand();

    // CPU 패
    for (let i = 1; i <= 3; i++) {
        el.cpuVisuals[i].innerHTML = '';
        for (let k = 0; k < players[i].hand.length; k++) {
            const c = document.createElement('div');
            c.className = 'card card-back cpu-card';
            el.cpuVisuals[i].appendChild(c);
        }
    }
}

function renderPlayerHand() {
    el.hand.innerHTML = '';
    const hand = players[0].hand;
    const count = hand.length;

    const cardWidth = 60;
    const containerWidth = el.hand.clientWidth;

    let overlap = -5;
    const totalNeeded = count * cardWidth;

    if (count > 1 && totalNeeded > containerWidth) {
        overlap = (containerWidth - (count * cardWidth)) / (count - 1);
        overlap -= 2;
    }

    hand.forEach((card, i) => {
        const d = document.createElement('div');
        let cClass = `card ${['♥', '♦'].includes(card.suit) ? 'red' : 'black'}`;
        if (card.isJoker) cClass = card.rank === 'Color' ? 'card joker-color' : 'card joker-black';

        d.className = cClass;
        d.innerHTML = createCardHTML(card);
        d.onclick = () => playerPlay(i);

        if (i < count - 1) {
            d.style.marginRight = `${overlap}px`;
        }
        d.style.zIndex = i;

        el.hand.appendChild(d);
    });
}

function highlightCurrentPlayer() {
    document.querySelectorAll('.player-area').forEach(e => e.classList.remove('active-turn'));
    ['player', 'cpu1', 'cpu2', 'cpu3'].forEach((id, i) => {
        if (i === currentPlayerIndex) document.getElementById(id).classList.add('active-turn');
    });
}

function log(msg) {
    el.log.textContent = msg;
}

document.addEventListener('DOMContentLoaded', initGame);