let currentChipValue = 5;
let currentBet = { type: null, amount: 0 };
let playerHand = [];
let bankerHand = [];
let deck = [];
let gameInProgress = false;
let usingTicket = false;

const SUITS = [
    { symbol: '♠', color: 'black' }, { symbol: '♥', color: 'red' },
    { symbol: '♦', color: 'red' }, { symbol: '♣', color: 'black' }
];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function cardValue(card) {
    if (card.value === 'A') return 1;
    if (['10', 'J', 'Q', 'K'].includes(card.value)) return 0;
    return parseInt(card.value, 10);
}

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
    for (const suit of SUITS) for (const value of VALUES) d.push({ value, suit: suit.symbol, color: suit.color });
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

function calculateScore(hand) {
    let t = 0;
    for (const c of hand) t += cardValue(c);
    return t % 10;
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

function renderHands() {
    const playerEl = document.getElementById('player-hand');
    const bankerEl = document.getElementById('banker-hand');
    playerEl.innerHTML = '';
    playerHand.forEach(c => playerEl.appendChild(renderCard(c)));
    document.getElementById('player-score').innerText = calculateScore(playerHand);

    bankerEl.innerHTML = '';
    bankerHand.forEach(c => bankerEl.appendChild(renderCard(c)));
    document.getElementById('banker-score').innerText = calculateScore(bankerHand);
}

function updateUI() {
    const currentBalance = getBalance();
    const balanceEl = document.getElementById('balance-val');
    if (balanceEl) balanceEl.innerHTML = `${currentBalance} <span class="coin">M</span>`;

    const totalBetEl = document.getElementById('total-bet');
    if (totalBetEl) totalBetEl.innerHTML = `${currentBet.amount} <span class="coin">M</span>`;

    const dealBtn = document.getElementById('deal-btn');
    if (dealBtn) dealBtn.disabled = gameInProgress || currentBet.amount === 0 || currentBet.amount > currentBalance;

    document.querySelectorAll('.bet-spot').forEach(spot => {
        const container = spot.querySelector('.chip-container');
        if (container) {
            container.innerHTML = '';
            if (currentBet.type === spot.dataset.bet && currentBet.amount > 0) {
                const chipElem = document.createElement('div');
                chipElem.className = 'placed-chip';
                chipElem.innerText = currentBet.amount;
                container.appendChild(chipElem);
            }
        }
    });

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) {
        if (currentBalance === 0 && !gameInProgress) {
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
            if (gameInProgress) return;
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            currentChipValue = parseInt(e.target.dataset.value, 10);
        });
    });

    document.querySelectorAll('.bet-spot').forEach(spot => {
        spot.addEventListener('click', () => {
            if (gameInProgress) return;
            const betType = spot.dataset.bet;
            if (currentBet.type && currentBet.type !== betType) currentBet.amount = 0;
            currentBet.type = betType;
            currentBet.amount += currentChipValue;
            const labels = { player: 'JOUEUR', banker: 'BANQUIER', tie: 'ÉGALITÉ' };
            showMessage(`💰 Mise sur ${labels[betType]} : ${currentBet.amount}`);
            updateUI();
        });
    });

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        if (gameInProgress) return;
        currentBet = { type: null, amount: 0 };
        updateUI();
    });

    const dealBtn = document.getElementById('deal-btn');
    if (dealBtn) dealBtn.addEventListener('click', () => { usingTicket = false; startGame(); });

    const ticketBtn = document.getElementById('ticket-btn');
    if (ticketBtn) ticketBtn.addEventListener('click', () => {
        if (gameInProgress || currentBet.amount === 0) return;
        if (typeof bpUseTicket !== 'function' || !bpUseTicket()) {
            showMessage("❌ Aucun ticket disponible !");
            return;
        }
        usingTicket = true;
        startGame();
    });

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', reloadBalance);
}

function reloadBalance() {
    if (gameInProgress) return;
    setBalance(10);
    currentBet = { type: null, amount: 0 };
    showMessage("Solde rechargé de 10 !");
}

function startGame() {
    if (gameInProgress || currentBet.amount === 0) return;

    if (!usingTicket) {
        const balance = getBalance();
        if (currentBet.amount > balance) { showMessage("❌ Solde insuffisant !"); return; }
        setBalance(balance - currentBet.amount);
        if (typeof addBattlePassXP === 'function') addBattlePassXP(currentBet.amount);
    } else {
        usingTicket = false;
        showMessage("🎫 Ticket utilisé ! Distribution gratuite...");
    }

    deck = createDeck();
    playerHand = [];
    bankerHand = [];
    gameInProgress = true;
    updateUI();
    updateStatus("Distribution des cartes...");

    // 🎵 Son de carte pour chaque carte distribuée (fonction globale de sounds.js)
    setTimeout(() => { playerHand.push(drawCard()); renderHands(); if (typeof playCardSound === 'function') playCardSound(); }, 200);
    setTimeout(() => { bankerHand.push(drawCard()); renderHands(); if (typeof playCardSound === 'function') playCardSound(); }, 600);
    setTimeout(() => { playerHand.push(drawCard()); renderHands(); if (typeof playCardSound === 'function') playCardSound(); }, 1000);
    setTimeout(() => { bankerHand.push(drawCard()); renderHands(); if (typeof playCardSound === 'function') playCardSound(); }, 1400);
    setTimeout(() => resolveGame(), 2200);
}

function resolveGame() {
    let p = calculateScore(playerHand);
    let b = calculateScore(bankerHand);
    updateStatus(`Joueur : ${p} — Banquier : ${b}`);

    let pDraw = p <= 5;
    let bDraw = false;

    if (pDraw) {
        const pt = playerHand.length === 3 ? cardValue(playerHand[2]) : null;
        if (b <= 2) bDraw = true;
        else if (b === 3 && pt !== 8) bDraw = true;
        else if (b === 4 && [2, 3, 4, 5, 6, 7].includes(pt)) bDraw = true;
        else if (b === 5 && [4, 5, 6, 7].includes(pt)) bDraw = true;
        else if (b === 6 && [6, 7].includes(pt)) bDraw = true;
    } else {
        if (b <= 5) bDraw = true;
    }

    if (pDraw) {
        setTimeout(() => {
            playerHand.push(drawCard());
            renderHands();
            // 🎵 Son de carte pour la 3ème carte du joueur
            if (typeof playCardSound === 'function') playCardSound();
            p = calculateScore(playerHand);
            updateStatus(`Joueur : ${p} — Banquier : ${b}`);
        }, 400);
    }

    setTimeout(() => {
        if (bDraw) {
            bankerHand.push(drawCard());
            renderHands();
            // 🎵 Son de carte pour la 3ème carte du banquier
            if (typeof playCardSound === 'function') playCardSound();
            b = calculateScore(bankerHand);
            updateStatus(`Joueur : ${p} — Banquier : ${b}`);
        }
        setTimeout(() => endGame(calculateScore(playerHand), calculateScore(bankerHand)), 600);
    }, 1000);
}

function endGame(p, b) {
    let winner = 'tie';
    if (p > b) winner = 'player';
    else if (b > p) winner = 'banker';

    const labels = { player: 'JOUEUR', banker: 'BANQUIER', tie: 'ÉGALITÉ' };
    updateStatus(`🎯 Joueur ${p} — Banquier ${b}`);

    if (currentBet.type === winner) {
        let payout = 0;
        if (winner === 'player') payout = currentBet.amount * 2;
        else if (winner === 'banker') payout = Math.round(currentBet.amount * 1.95);
        else payout = currentBet.amount * 8;
        setBalance(getBalance() + payout);
        showMessage(`🏆 GAGNÉ ! ${labels[winner]} l'emporte. Vous remportez ${payout} !`);
    } else {
        showMessage(`❌ PERDU ! ${labels[winner]} l'emporte.`);
    }

    gameInProgress = false;
    currentBet = { type: null, amount: 0 };
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    const def = document.querySelector('.chip[data-value="5"]');
    if (def) def.classList.add('active');
    currentChipValue = 5;
    updateUI();
    setTimeout(() => updateStatus("Placez votre mise pour rejouer"), 1500);
}