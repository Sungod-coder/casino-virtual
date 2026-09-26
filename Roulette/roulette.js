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

        // 🛑 Sécurité : force l'arrêt après 500ms max
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
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            if (isSpinning || inStreak) return;
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            e.target.classList
