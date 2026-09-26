const NUMBERS_LAYOUT = [
    { num: 0, color: 'green' },
    { num: 32, color: 'red' }, { num: 15, color: 'black' },
    { num: 19, color: 'red' }, { num: 4, color: 'black' },
    { num: 21, color: 'red' }, { num: 2, color: 'black' },
    { num: 25, color: 'red' }, { num: 17, color: 'black' },
    { num: 34, color: 'red' }, { num: 6, color: 'black' },
    { num: 27, color: 'red' }, { num: 13, color: 'black' },
    { num: 36, color: 'red' }, { num: 11, color: 'black' },
    { num: 30, color: 'red' }, { num: 8, color: 'black' },
    { num: 23, color: 'red' }, { num: 10, color: 'black' },
    { num: 5, color: 'red' },  { num: 24, color: 'black' },
    { num: 16, color: 'red' }, { num: 33, color: 'black' },
    { num: 1, color: 'red' },  { num: 20, color: 'black' },
    { num: 14, color: 'red' }, { num: 31, color: 'black' },
    { num: 9, color: 'red' },  { num: 22, color: 'black' },
    { num: 18, color: 'red' }, { num: 29, color: 'black' },
    { num: 7, color: 'red' },  { num: 28, color: 'black' },
    { num: 12, color: 'red' }, { num: 35, color: 'black' },
    { num: 3, color: 'red' },  { num: 26, color: 'black' }
];

const COLOR_CODES = { red: '#e74c3c', black: '#2c3e50', green: '#27ae60' };

let currentChipValue = 1;
let currentBet = { color: null, amount: 0 };
let isSpinning = false;
let history = [];
let inStreak = false;
let streakCount = 0;
let accumulatedGain = 0;
let streakColor = null;
let usingTicket = false;

let currentWheelAngle = 0;
let currentBallAngle = 0;
let currentBallRadius = 155;

const canvas = document.getElementById('wheel-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

const spinSound = new Audio('spinopel-spinning-roulette-wheel-429832.mp3');
spinSound.loop = true;
spinSound.volume = 0.6;

function playSpinSound() {
    try { spinSound.currentTime = 0; spinSound.volume = 0.6; spinSound.play().catch(e => {}); } catch (e) {}
}

function stopSpinSound() {
    try {
        if (!spinSound) return;
        const fade = setInterval(() => {
            if (spinSound.volume > 0.05) {
                spinSound.volume = Math.max(0, spinSound.volume - 0.1);
            } else {
                clearInterval(fade);
                spinSound.pause();
                spinSound.currentTime = 0;
                spinSound.volume = 0.6;
            }
        }, 30);

        setTimeout(() => {
            try {
                clearInterval(fade);
                spinSound.pause();
                spinSound.currentTime = 0;
                spinSound.volume = 0.6;
            } catch (e) {}
        }, 500);
    } catch (e) {}
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

window.onload = () => {
    if (canvas && ctx) draw(currentWheelAngle, currentBallAngle, currentBallRadius);
    setupEventListeners();
    updateUI();
};

function updateUI() {
    const currentBalance = getBalance();
    const balanceEl = document.getElementById('balance-val');
    if (balanceEl) balanceEl.innerHTML = `${currentBalance} <span class="coin">M</span>`;

    const totalBetEl = document.getElementById('total-bet');
    if (totalBetEl) totalBetEl.innerHTML = `${currentBet.amount} <span class="coin">M</span>`;

    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) spinBtn.disabled = isSpinning || currentBet.amount === 0 || inStreak || currentBet.amount > currentBalance || !currentBet.color;

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) {
        if (currentBalance === 0 && currentBet.amount === 0 && !inStreak && !isSpinning) {
            reloadBtn.style.display = 'inline-block';
            reloadBtn.innerHTML = '🔄 RECHARGER (10 <span class="coin small">M</span>)';
            reloadBtn.classList.remove('hidden');
        } else {
            reloadBtn.style.display = 'none';
            reloadBtn.classList.add('hidden');
        }
    }

    document.querySelectorAll('.bet-spot').forEach(spot => {
        const container = spot.querySelector('.chip-container');
        if (container) {
            container.innerHTML = '';
            if (currentBet.color === spot.dataset.color && currentBet.amount > 0) {
                const chipElem = document.createElement('div');
                chipElem.className = 'placed-chip';
                chipElem.innerText = currentBet.amount;
                container.appendChild(chipElem);
            }
        }
    });

    const streakPanel = document.getElementById('streak-panel');
    const bettingPanel = document.getElementById('betting-panel');
    if (inStreak) {
        if (streakPanel) streakPanel.classList.remove('hidden');
        if (bettingPanel) bettingPanel.classList.add('hidden');
        document.getElementById('streak-count').innerText = `${streakCount} Victoire${streakCount > 1 ? 's' : ''}`;
        document.getElementById('current-gain').innerHTML = `${accumulatedGain} <span class="coin">M</span>`;
        document.getElementById('next-gain').innerHTML = `${accumulatedGain * 2} <span class="coin">M</span>`;
        document.getElementById('cashout-amount').innerHTML = `${accumulatedGain} <span class="coin">M</span>`;
    } else {
        if (streakPanel) streakPanel.classList.add('hidden');
        if (bettingPanel) bettingPanel.classList.remove('hidden');
    }

    if (typeof bpUpdateTicketButtons === 'function') bpUpdateTicketButtons();
}

window.addEventListener('storage', updateUI);

function setupEventListeners() {
    // ----- CHIPS -----
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            if (isSpinning || inStreak) return;
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            currentChipValue = parseInt(e.target.dataset.value, 10);

            const customInput = document.getElementById('custom-bet-input');
            if (customInput) {
                customInput.value = '';
                customInput.classList.remove('active');
            }

            if (currentBet.color) {
                currentBet.amount = currentChipValue;
                updateUI();
            }
        });
    });

    // ----- CHAMP CUSTOM (le petit cercle vide à droite du 500) -----
    const customInput = document.getElementById('custom-bet-input');
    if (customInput) {
        customInput.addEventListener('focus', () => {
            if (isSpinning || inStreak) return;
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            customInput.classList.add('active');
        });

        customInput.addEventListener('input', () => {
            if (isSpinning || inStreak) return;
            const val = parseInt(customInput.value, 10);
            if (isNaN(val) || val < 1) return;
            currentChipValue = val;

            if (currentBet.color) {
                currentBet.amount = val;
                const labels = { red: 'ROUGE', black: 'NOIR', green: 'VERT' };
                showMessage(`💰 Mise sur ${labels[currentBet.color]} : ${val}`);
                updateUI();
            }
        });

        customInput.addEventListener('blur', () => {
            if (!customInput.value || parseInt(customInput.value, 10) < 1) {
                customInput.classList.remove('active');
                currentChipValue = 1;
                const chip1 = document.querySelector('.chip[data-value="1"]');
                if (chip1) chip1.classList.add('active');
            }
        });
    }

    // ----- BET SPOTS (couleurs) -----
    document.querySelectorAll('.bet-spot').forEach(spot => {
        spot.addEventListener('click', () => {
            if (isSpinning || inStreak) return;
            const color = spot.dataset.color;
            const labels = { red: 'ROUGE', black: 'NOIR', green: 'VERT' };

            if (currentBet.color === color) {
                currentBet.amount += currentChipValue;
            } else {
                currentBet.amount = currentChipValue;
            }
            currentBet.color = color;
            showMessage(`💰 Mise sur ${labels[color]} : ${currentBet.amount}`);
            updateUI();
        });
    });

    // ----- EFFACER -----
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', clearBet);

    // ----- LANCER -----
    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) spinBtn.addEventListener('click', () => { usingTicket = false; startNormalSpin(); });

    // ----- TICKET -----
    const ticketBtn = document.getElementById('ticket-btn');
    if (ticketBtn) ticketBtn.addEventListener('click', () => {
        if (isSpinning || inStreak) return;
        if (currentBet.amount === 0) { showMessage("❌ Sélectionnez d'abord une couleur et une mise !"); return; }
        if (typeof bpUseTicket !== 'function' || !bpUseTicket()) {
            showMessage("❌ Aucun ticket disponible !");
            return;
        }
        usingTicket = true;
        startNormalSpin();
    });

    // ----- CASHOUT + DOUBLE -----
    const cashoutBtn = document.getElementById('cashout-btn');
    if (cashoutBtn) cashoutBtn.addEventListener('click', cashout);

    const doubleBtn = document.getElementById('double-btn');
    if (doubleBtn) doubleBtn.addEventListener('click', startStreakSpin);

    // ----- RELOAD -----
    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', reloadBalance);
}

function reloadBalance() {
    if (isSpinning) return;
    setBalance(10);
    currentBet = { color: null, amount: 0 };
    inStreak = false;
    accumulatedGain = 0;
    streakCount = 0;
    streakColor = null;
    const customInput = document.getElementById('custom-bet-input');
    if (customInput) { customInput.value = ''; customInput.classList.remove('active'); }
    showMessage("Solde rechargé de 10 !");
    updateUI();
}

function clearBet() {
    if (isSpinning || inStreak) return;
    currentBet = { color: null, amount: 0 };
    const customInput = document.getElementById('custom-bet-input');
    if (customInput) {
        customInput.value = '';
        customInput.classList.remove('active');
    }
    showMessage("Mise effacée.");
    updateUI();
}

function showMessage(msg) { const b = document.getElementById('message-box'); if (b) b.innerText = msg; }

function draw(wAngle, bAngle, bRadius) {
    if (!ctx) return;
    const totalSlots = NUMBERS_LAYOUT.length;
    const arc = (2 * Math.PI) / totalSl
