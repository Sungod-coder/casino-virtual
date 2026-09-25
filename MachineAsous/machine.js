const SYMBOLS = [
    { name: 'diamond', icon: '💎', multiplier: 50 },
    { name: 'seven',   icon: '7️⃣', multiplier: 20 },
    { name: 'bell',    icon: '🔔', multiplier: 10 },
    { name: 'watermelon', icon: '🍉', multiplier: 5 },
    { name: 'lemon',   icon: '🍋', multiplier: 3 },
    { name: 'cherry',  icon: '🍒', multiplier: 2 }
];

let currentBet = 1;
let isSpinning = false;
let history = [];
let inStreak = false;
let streakCount = 0;
let accumulatedGain = 0;
let usingTicket = false;

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
    setupEventListeners();
    updateUI();
};

function updateUI() {
    const currentBalance = getBalance();
    const balanceEl = document.getElementById('balance-val');
    if (balanceEl) balanceEl.innerHTML = `${currentBalance} <span class="coin">M</span>`;

    const currentBetEl = document.getElementById('current-bet-display');
    if (currentBetEl) currentBetEl.innerHTML = `${currentBet} <span class="coin">M</span>`;

    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) spinBtn.disabled = isSpinning || currentBalance < currentBet || inStreak;

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) {
        if (currentBalance === 0 && !inStreak && !isSpinning) {
            reloadBtn.style.display = 'inline-block';
            reloadBtn.innerHTML = '🔄 RECHARGER (10 <span class="coin small">M</span>)';
            reloadBtn.classList.remove('hidden');
        } else {
            reloadBtn.style.display = 'none';
            reloadBtn.classList.add('hidden');
        }
    }

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
            e.target.classList.add('active');
            currentBet = parseInt(e.target.dataset.value, 10);
            showMessage(`💰 Mise : ${currentBet}`);
            updateUI();
        });
    });

    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) spinBtn.addEventListener('click', () => { usingTicket = false; startNormalSpin(); });

    const ticketBtn = document.getElementById('ticket-btn');
    if (ticketBtn) ticketBtn.addEventListener('click', () => {
        if (isSpinning || inStreak) return;
        if (typeof bpUseTicket !== 'function' || !bpUseTicket()) {
            showMessage("❌ Aucun ticket disponible !");
            return;
        }
        usingTicket = true;
        startNormalSpin();
    });

    const doubleBtn = document.getElementById('double-btn');
    if (doubleBtn) doubleBtn.addEventListener('click', startStreakSpin);

    const cashoutBtn = document.getElementById('cashout-btn');
    if (cashoutBtn) cashoutBtn.addEventListener('click', cashout);

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', reloadBalance);
}

function reloadBalance() {
    if (isSpinning) return;
    setBalance(10);
    currentBet = 1;
    inStreak = false;
    accumulatedGain = 0;
    streakCount = 0;
    showMessage("Solde rechargé de 10 !");
}

function showMessage(msg) { const b = document.getElementById('message-box'); if (b) b.innerText = msg; }

// ✅ Mesure la hauteur RÉELLE d'un symbole selon la taille de l'écran
function getSymbolHeight() {
    const firstSymbol = document.querySelector('.reel .symbol');
    if (firstSymbol) {
        const h = firstSymbol.offsetHeight;
        if (h > 0) return h;
    }
    // Fallback selon la largeur de l'écran si aucun symbole n'est présent
    if (window.innerWidth <= 400) return 75;
    if (window.innerWidth <= 900) return 90;
    return 120;
}

function spinReels(finalSymbols, onComplete) {
    const reels = [
        document.getElementById('reel-1'),
        document.getElementById('reel-2'),
        document.getElementById('reel-3')
    ];
    let completed = 0;

    if (typeof playSlotSound === 'function') { try { playSlotSound(); } catch (e) {} }

    // ✅ Récupère la hauteur RÉELLE des symboles (responsive)
    const symbolHeight = getSymbolHeight();
    console.log('🎰 Hauteur symbole mesurée :', symbolHeight, 'px');

    reels.forEach((reel, index) => {
        const numExtra = 20 + index * 10;
        const strip = [];
        for (let i = 0; i < numExtra; i++) strip.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].icon);
        strip.push(finalSymbols[index].icon);

        reel.innerHTML = strip.map(icon => `<div class="symbol">${icon}</div>`).join('');
        reel.style.transition = 'none';
        reel.style.top = '0px';

        setTimeout(() => {
            // ✅ Utilise la hauteur mesurée au lieu du 120px codé en dur
            const targetTop = -(strip.length - 1) * symbolHeight;
            const duration = 2000 + index * 600;
            reel.style.transition = `top ${duration}ms cubic-bezier(0.1, 0.9, 0.2, 1.0)`;
            reel.style.top = `${targetTop}px`;
            setTimeout(() => {
                completed++;
                if (completed === 3) {
                    if (typeof stopSlotSound === 'function') { try { stopSlotSound(); } catch (e) {} }
                    onComplete();
                }
            }, duration);
        }, 50);
    });
}

function startNormalSpin() {
    if (isSpinning || inStreak) return;
    const balance = getBalance();

    if (!usingTicket) {
        if (balance < currentBet) { showMessage("❌ Solde insuffisant !"); return; }
        setBalance(balance - currentBet);
        if (typeof addBattlePassXP === 'function') addBattlePassXP(currentBet);
    } else {
        usingTicket = false;
        showMessage("🎫 Ticket utilisé ! Lancer gratuit...");
    }

    isSpinning = true;

    const potionMult = (typeof getPotionMultiplier === 'function') ? getPotionMultiplier() : 1;
    let result;
    if (potionMult > 1) {
        let bestResult = null;
        let bestScore = -1;
        for (let i = 0; i < potionMult; i++) {
            const attempt = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
            const winInfo = calculateWin(attempt, 1);
            const score = winInfo.multiplier;
            if (score > bestScore) {
                bestScore = score;
                bestResult = attempt;
            }
            if (score >= 1.5) break;
        }
        result = bestResult;
        showMessage(`🧪 Potion x${potionMult} active ! Chance augmentée...`);
    } else {
        result = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    }

    spinReels(result, () => { isSpinning = false; handleNormalResult(result); });
}

function startStreakSpin() {
    if (isSpinning || !inStreak) return;
    isSpinning = true;
    if (typeof addBattlePassXP === 'function') addBattlePassXP(currentBet);
    showMessage("Série Quitte ou Double !");
    const result = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    spinReels(result, () => { isSpinning = false; handleStreakResult(result); });
}

function getRandomSymbol() {
    const r = Math.random() * 100;
    if (r < 5) return SYMBOLS[0];
    if (r < 15) return SYMBOLS[1];
    if (r < 30) return SYMBOLS[2];
    if (r < 50) return SYMBOLS[3];
    if (r < 75) return SYMBOLS[4];
    return SYMBOLS[5];
}

function handleNormalResult(result) {
    addHistory(result.map(s => s.icon).join(' '));
    const winInfo = calculateWin(result, currentBet);
    if (winInfo.multiplier > 0) {
        accumulatedGain = winInfo.payout;
        streakCount = 1;
        inStreak = true;
        showMessage(`GAGNÉ ! ${winInfo.reason} - Gain : ${accumulatedGain}`);

        const isThreeDiamonds = result[0].name === 'diamond' && result[1].name === 'diamond' && result[2].name === 'diamond';
        if (isThreeDiamonds) {
            if (typeof playDiamondSound === 'function') {
                try { playDiamondSound(); } catch (e) {}
            }
        } else {
            if (typeof playSlotWinSound === 'function') {
                try { playSlotWinSound(); } catch (e) {}
            }
        }
    } else {
        showMessage("PERDU ! Pas d'alignement gagnant.");
    }
    updateUI();
}

function handleStreakResult(result) {
    addHistory(result.map(s => s.icon).join(' '));
    const winInfo = calculateWin(result, 1);
    if (winInfo.multiplier >= 1.5) {
        accumulatedGain *= 2;
        streakCount++;
        showMessage(`RÉUSSITE ! Gain doublé : ${accumulatedGain}`);

        const isThreeDiamonds = result[0].name === 'diamond' && result[1].name === 'diamond' && result[2].name === 'diamond';
        if (isThreeDiamonds) {
            if (typeof playDiamondSound === 'function') {
                try { playDiamondSound(); } catch (e) {}
            }
        } else {
            if (typeof playSlotWinSound === 'function') {
                try { playSlotWinSound(); } catch (e) {}
            }
        }
    } else {
        showMessage("PERDU ! Série terminée.");
        inStreak = false;
        accumulatedGain = 0;
        streakCount = 0;
    }
    updateUI();
}

function calculateWin(result, bet) {
    const [s1, s2, s3] = result;
    if (s1.name === s2.name && s2.name === s3.name) {
        return { multiplier: s1.multiplier, payout: bet * s1.multiplier, reason: `3x ${s1.icon}` };
    }
    if (s1.name === s2.name || s2.name === s3.name || s1.name === s3.name) {
        return { multiplier: 1.5, payout: Math.round(bet * 1.5), reason: "2 identiques" };
    }
    return { multiplier: 0, payout: 0, reason: "" };
}

function cashout() {
    if (!inStreak) return;
    const gain = accumulatedGain;
    setBalance(getBalance() + gain);
    showMessage(`ENCAISSÉ ! Vous retirez ${gain} !`);
    inStreak = false;
    accumulatedGain = 0;
    streakCount = 0;
    updateUI();
    if (typeof playCashRegister === 'function') {
        try { playCashRegister(); } catch (e) {}
    }
}

function addHistory(text) {
    history.unshift(text);
    if (history.length > 6) history.pop();
    const list = document.getElementById('history-list');
    if (!list) return;
    list.innerHTML = '';
    history.forEach(item => {
        const d = document.createElement('div');
        d.className = 'history-item';
        d.innerText = item;
        list.appendChild(d);
    });
}