let currentChipValue = 5;
let currentBet = 0;
let playerHand = [];
let dealerHand = [];
let deck = [];
let gameInProgress = false;
let usingTicket = false;

const SUITS = [
    { symbol: '♠', color: 'black' }, { symbol: '♥', color: 'red' },
    { symbol: '♦', color: 'red' }, { symbol: '♣', color: 'black' }
];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

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
    let score = 0, aces = 0;
    for (const card of hand) {
        if (card.value === 'A') { aces++; score += 11; }
        else if (['J', 'Q', 'K'].includes(card.value)) score += 10;
        else score += parseInt(card.value, 10);
    }
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
}

function renderCard(card, hidden = false) {
    const div = document.createElement('div');
    div.className = 'card';
    if (hidden) { div.classList.add('back'); return div; }
    div.classList.add(card.color);
    div.innerHTML = `
        <div class="corner"><span>${card.value}</span><span>${card.suit}</span></div>
        <div class="center-suit">${card.suit}</div>
        <div class="corner bottom"><span>${card.value}</span><span>${card.suit}</span></div>
    `;
    return div;
}

function renderHands(revealDealer = false) {
    const playerHandEl = document.getElementById('player-hand');
    const dealerHandEl = document.getElementById('dealer-hand');
    playerHandEl.innerHTML = '';
    playerHand.forEach(card => playerHandEl.appendChild(renderCard(card)));
    document.getElementById('player-score').innerText = calculateScore(playerHand);

    dealerHandEl.innerHTML = '';
    dealerHand.forEach((card, index) => {
        if (index === 1 && !revealDealer) dealerHandEl.appendChild(renderCard(card, true));
        else dealerHandEl.appendChild(renderCard(card));
    });

    if (revealDealer) document.getElementById('dealer-score').innerText = calculateScore(dealerHand);
    else {
        const first = dealerHand[0];
        document.getElementById('dealer-score').innerText = first ? calculateScore([first]) : 0;
    }
}

function updateUI() {
    const currentBalance = getBalance();
    const balanceEl = document.getElementById('balance-val');
    if (balanceEl) balanceEl.innerHTML = `${currentBalance} <span class="coin">M</span>`;

    const betDisplay = document.getElementById('current-bet-display');
    if (betDisplay) betDisplay.innerHTML = `${currentBet} <span class="coin">M</span>`;

    const dealBtn = document.getElementById('deal-btn');
    if (dealBtn) dealBtn.disabled = gameInProgress || currentBet === 0 || currentBet > currentBalance;

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

    const bettingPanel = document.getElementById('betting-panel');
    const actionPanel = document.getElementById('action-panel');
    if (gameInProgress) {
        if (bettingPanel) bettingPanel.classList.add('hidden');
        if (actionPanel) actionPanel.classList.remove('hidden');
    } else {
        if (bettingPanel) bettingPanel.classList.remove('hidden');
        if (actionPanel) actionPanel.classList.add('hidden');
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
            currentBet = currentChipValue;
            showMessage(`💰 Mise : ${currentBet}`);
            updateUI();
        });
    });

    const dealBtn = document.getElementById('deal-btn');
    if (dealBtn) dealBtn.addEventListener('click', () => { usingTicket = false; startGame(); });

    const ticketBtn = document.getElementById('ticket-btn');
    if (ticketBtn) ticketBtn.addEventListener('click', () => {
        if (gameInProgress || currentBet === 0) return;
        if (typeof bpUseTicket !== 'function' || !bpUseTicket()) {
            showMessage("❌ Aucun ticket disponible !");
            return;
        }
        usingTicket = true;
        startGame();
    });

    const hitBtn = document.getElementById('hit-btn');
    if (hitBtn) hitBtn.addEventListener('click', playerHit);

    const standBtn = document.getElementById('stand-btn');
    if (standBtn) standBtn.addEventListener('click', playerStand);

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', reloadBalance);
}

function reloadBalance() {
    if (gameInProgress) return;
    setBalance(10);
    currentBet = 0;
    showMessage("Solde rechargé de 10 !");
}

function startGame() {
    if (gameInProgress || currentBet === 0) return;
    const currentBalance = getBalance();

    if (!usingTicket) {
        if (currentBet > currentBalance) { showMessage("❌ Solde insuffisant !"); return; }
        setBalance(currentBalance - currentBet);
        if (typeof addBattlePassXP === 'function') addBattlePassXP(currentBet);
    } else {
        usingTicket = false;
        showMessage("🎫 Ticket utilisé ! Partie gratuite...");
    }

    deck = createDeck();
    playerHand = [];
    dealerHand = [];
    gameInProgress = true;

    playerHand.push(drawCard());
    dealerHand.push(drawCard());
    playerHand.push(drawCard());
    dealerHand.push(drawCard());

    renderHands(false);
    updateUI();
    updateStatus(`Mise : ${currentBet} — À vous !`);
    showMessage("🎴 Cartes distribuées !");

    // 🎵 Son de carte pour les 4 cartes distribuées (décalées)
    for (let i = 0; i < 4; i++) {
        setTimeout(() => {
            if (typeof playCardSound === 'function') playCardSound();
        }, i * 180);
    }

    const playerScore = calculateScore(playerHand);
    if (playerScore === 21) {
        setTimeout(() => { showMessage("🎉 BLACKJACK !"); endGame(true); }, 900);
    }
}

function playerHit() {
    if (!gameInProgress) return;
    playerHand.push(drawCard());
    renderHands(false);
    // 🎵 Son de carte
    if (typeof playCardSound === 'function') playCardSound();

    const score = calculateScore(playerHand);
    document.getElementById('player-score').innerText = score;
    if (score > 21) {
        showMessage(`💥 BUST ! (${score})`);
        updateStatus("Dépassé 21 !");
        endGame(false);
    } else if (score === 21) {
        showMessage("🎉 21 !");
        setTimeout(playerStand, 800);
    } else {
        showMessage(`Vous avez ${score}.`);
    }
}

function playerStand() {
    if (!gameInProgress) return;
    renderHands(true);
    updateStatus("Au tour du croupier...");
    showMessage("✋ Le croupier joue...");

    // 🎵 Son de carte quand le croupier retourne sa carte cachée
    if (typeof playCardSound === 'function') playCardSound();

    const dealerPlay = setInterval(() => {
        const s = calculateScore(dealerHand);
        if (s < 17) {
            dealerHand.push(drawCard());
            renderHands(true);
            // 🎵 Son de carte
            if (typeof playCardSound === 'function') playCardSound();
        } else {
            clearInterval(dealerPlay);
            resolveGame();
        }
    }, 800);
}

function resolveGame() {
    const p = calculateScore(playerHand);
    const d = calculateScore(dealerHand);
    let win = false, tie = false;
    if (d > 21) win = true;
    else if (p > d) win = true;
    else if (p === d) tie = true;
    endGame(win, tie);
}

function endGame(playerWins, tie = false) {
    setTimeout(() => {
        const currentBalance = getBalance();
        if (tie) {
            setBalance(currentBalance + currentBet);
            showMessage(`🤝 ÉGALITÉ ! Vous récupérez ${currentBet}.`);
        } else if (playerWins) {
            const score = calculateScore(playerHand);
            const isBJ = score === 21 && playerHand.length === 2;
            const payout = isBJ ? Math.round(currentBet * 2.5) : currentBet * 2;
            setBalance(currentBalance + payout);
            showMessage(`🏆 GAGNÉ ! Vous remportez ${payout} !`);
        } else {
            showMessage(`❌ PERDU ! Vous perdez ${currentBet}.`);
        }
        gameInProgress = false;
        currentBet = 0;
        updateUI();
        updateStatus("Placez votre mise pour rejouer");
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        const def = document.querySelector('.chip[data-value="5"]');
        if (def) def.classList.add('active');
        currentChipValue = 5;
    }, 800);
}