let currentChipValue = 5;
let currentBet = 0;
let hand = [];
let held = [false, false, false, false, false];
let deck = [];
let gameState = 'betting';
let usingTicket = false;

const SUITS = [
    { symbol: '♠', color: 'black' }, { symbol: '♥', color: 'red' },
    { symbol: '♦', color: 'red' }, { symbol: '♣', color: 'black' }
];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function getUsers() { return JSON.parse(localStorage.getItem('casino_users')) || {}; }
function saveUsers(users) { localStorage.setItem('casino_users', JSON.stringify(users)); }
function getCurrentEmail() { return localStorage.getItem('casino_logged_email'); }

function getBalance() {
    const email = getCurrentEmail();
    if (!email) return 0;
    const users = getUsers();
    if (users[email] && typeof users[email].balance === 'number' && !isNaN(users[email].balance)) {
        localStorage.setItem('casinoBalance', users[email].balance.toString());
        return users[email].balance;
    }
    return 0;
}

function setBalance(newAmount) {
    const email = getCurrentEmail();
    if (!email) return;
    const users = getUsers();
    if (users[email]) {
        users[email].balance = newAmount;
        saveUsers(users);
        localStorage.setItem('casinoBalance', newAmount.toString());
        updateUI();
    }
}

function createDeck() {
    const d = [];
    for (const s of SUITS) for (const v of VALUES) d.push({ value: v, suit: s.symbol, color: s.color });
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

function drawCard() {
    if (deck.length === 0) deck = createDeck();
    return deck.pop();
}

function cardNumericValue(card) {
    if (card.value === 'A') return 14;
    if (card.value === 'K') return 13;
    if (card.value === 'Q') return 12;
    if (card.value === 'J') return 11;
    return parseInt(card.value, 10);
}

function evaluateHand(cards) {
    const values = cards.map(c => cardNumericValue(c)).sort((a, b) => a - b);
    const suits = cards.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);

    let isStraight = false;
    if (values[4] - values[0] === 4 && new Set(values).size === 5) isStraight = true;
    if (!isStraight && values[0] === 2 && values[1] === 3 && values[2] === 4 && values[3] === 5 && values[4] === 14) isStraight = true;

    const isRoyal = isFlush && values.join(',') === '10,11,12,13,14';

    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const cv = Object.values(counts).sort((a, b) => b - a);

    if (isRoyal) return { name: "Quinte Flush Royale", multiplier: 250 };
    if (isFlush && isStraight) return { name: "Quinte Flush", multiplier: 50 };
    if (cv[0] === 4) return { name: "Carré", multiplier: 25 };
    if (cv[0] === 3 && cv[1] === 2) return { name: "Full House", multiplier: 9 };
    if (isFlush) return { name: "Couleur", multiplier: 6 };
    if (isStraight) return { name: "Quinte", multiplier: 4 };
    if (cv[0] === 3) return { name: "Brelan", multiplier: 3 };
    if (cv[0] === 2 && cv[1] === 2) return { name: "Deux Paires", multiplier: 2 };
    if (cv[0] === 2) {
        const pv = parseInt(Object.keys(counts).find(k => counts[k] === 2), 10);
        if (pv >= 11) return { name: "Paire de J/Q/K/A", multiplier: 1 };
    }
    return { name: "Aucune combinaison", multiplier: 0 };
}

function renderCard(card) {
    const div = document.createElement('div');
    div.className = 'card ' + card.color;
    div.innerHTML = `
        <div class="corner"><span>${card.value}</span><span>${card.suit}</span></div>
        <div class="center-suit">${card.suit}</div>
        <div class="corner bottom"><span>${card.value}</span><span>${card.suit}</span></div>
    `;
    return div;
}

function renderHand() {
    const slots = document.querySelectorAll('.card-slot');
    slots.forEach((slot, i) => {
        slot.innerHTML = '';
        slot.classList.remove('empty', 'held');
        if (hand[i]) {
            slot.appendChild(renderCard(hand[i]));
            if (held[i]) slot.classList.add('held');
        } else slot.classList.add('empty');
    });
}

function updateUI() {
    const currentBalance = getBalance();
    const balanceEl = document.getElementById('balance-val');
    if (balanceEl) balanceEl.innerHTML = `${currentBalance} <span class="coin">M</span>`;

    const betDisplay = document.getElementById('current-bet-display');
    if (betDisplay) betDisplay.innerHTML = `${currentBet} <span class="coin">M</span>`;

    const dealBtn = document.getElementById('deal-btn');
    if (dealBtn) dealBtn.disabled = gameState !== 'betting' || currentBet === 0 || currentBet > currentBalance;

    const bettingPanel = document.getElementById('betting-panel');
    const actionPanel = document.getElementById('action-panel');
    if (gameState === 'holding') {
        if (bettingPanel) bettingPanel.classList.add('hidden');
        if (actionPanel) actionPanel.classList.remove('hidden');
    } else {
        if (bettingPanel) bettingPanel.classList.remove('hidden');
        if (actionPanel) actionPanel.classList.add('hidden');
    }

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) {
        if (currentBalance === 0 && gameState === 'betting') {
            reloadBtn.style.display = 'inline-block';
            reloadBtn.innerHTML = '🔄 RECHARGER (10 <span class="coin small">M</span>)';
            reloadBtn.classList.remove('hidden');
        } else {
            reloadBtn.style.display = 'none';
            reloadBtn.classList.add('hidden');
        }
    }

    if (typeof bpUpdateTicketButtons === 'function') bpUpdateTicketButtons();
}

function showMessage(msg) { const b = document.getElementById('message-box'); if (b) b.innerText = msg; }
function updateStatus(msg) { const s = document.getElementById('game-status'); if (s) s.innerText = msg; }

window.addEventListener('storage', updateUI);

window.onload = () => {
    setupEventListeners();
    updateUI();
    updateStatus("Placez votre mise pour commencer");
};

function setupEventListeners() {
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            if (gameState !== 'betting') return;
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            currentChipValue = parseInt(e.target.dataset.value, 10);
            currentBet = currentChipValue;
            showMessage(`💰 Mise : ${currentBet}`);
            updateUI();
        });
    });

    document.querySelectorAll('.card-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            if (gameState !== 'holding') return;
            const i = parseInt(slot.dataset.index, 10);
            if (!hand[i]) return;
            held[i] = !held[i];
            renderHand();
        });
    });

    const dealBtn = document.getElementById('deal-btn');
    if (dealBtn) dealBtn.addEventListener('click', () => { usingTicket = false; dealCards(); });

    const ticketBtn = document.getElementById('ticket-btn');
    if (ticketBtn) ticketBtn.addEventListener('click', () => {
        if (gameState !== 'betting' || currentBet === 0) return;
        if (typeof bpUseTicket !== 'function' || !bpUseTicket()) {
            showMessage("❌ Aucun ticket disponible !");
            return;
        }
        usingTicket = true;
        dealCards();
    });

    const drawBtn = document.getElementById('draw-btn');
    if (drawBtn) drawBtn.addEventListener('click', drawNewCards);

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', reloadBalance);
}

function reloadBalance() {
    if (gameState !== 'betting') return;
    setBalance(10);
    currentBet = 0;
    showMessage("Solde rechargé de 10 !");
}

function dealCards() {
    if (gameState !== 'betting' || currentBet === 0) return;
    const balance = getBalance();

    if (!usingTicket) {
        if (currentBet > balance) { showMessage("❌ Solde insuffisant !"); return; }
        setBalance(balance - currentBet);
        if (typeof addBattlePassXP === 'function') addBattlePassXP(currentBet);
    } else {
        usingTicket = false;
        showMessage("🎫 Ticket utilisé ! Distribution gratuite...");
    }

    deck = createDeck();
    hand = [];
    held = [false, false, false, false, false];
    for (let i = 0; i < 5; i++) hand.push(drawCard());

    renderHand();
    gameState = 'holding';
    updateUI();
    updateStatus("Cliquez sur les cartes à GARDER, puis ÉCHANGER.");
    showMessage("🎴 Cliquez sur les cartes à GARDER.");

    // 🎵 Son de carte pour les 5 cartes distribuées (décalées)
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            if (typeof window.playCardSound === 'function') window.playCardSound();
        }, i * 150);
    }
}

function drawNewCards() {
    if (gameState !== 'holding') return;

    let replacedCount = 0;
    for (let i = 0; i < 5; i++) {
        if (!held[i]) {
            hand[i] = drawCard();
            replacedCount++;
        }
    }

    renderHand();

    // 🎵 Son de carte pour chaque carte remplacée (décalées)
    for (let i = 0; i < replacedCount; i++) {
        setTimeout(() => {
            if (typeof window.playCardSound === 'function') window.playCardSound();
        }, i * 150);
    }

    const result = evaluateHand(hand);
    const currentBalance = getBalance();

    if (result.multiplier > 0) {
        const payout = currentBet * result.multiplier;
        setBalance(currentBalance + payout);
        showMessage(`🏆 ${result.name} ! Vous remportez ${payout} (x${result.multiplier}) !`);
        updateStatus(`Gagné : ${result.name}`);
    } else {
        showMessage(`❌ ${result.name}. Vous perdez ${currentBet}.`);
        updateStatus(`Perdu : ${result.name}`);
    }

    gameState = 'finished';

    setTimeout(() => {
        gameState = 'betting';
        currentBet = 0;
        hand = [];
        held = [false, false, false, false, false];
        renderHand();
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        const def = document.querySelector('.chip[data-value="5"]');
        if (def) def.classList.add('active');
        currentChipValue = 5;
        updateUI();
        updateStatus("Placez votre mise pour rejouer");
        showMessage("Choisissez une mise et cliquez sur DISTRIBUER !");
    }, 2500);
}