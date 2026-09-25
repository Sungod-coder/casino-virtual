let currentChipValue = 5;
let currentBet = 0;
let point = null;
let isRolling = false;
let usingTicket = false;

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

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

    const betDisplay = document.getElementById('current-bet-display');
    if (betDisplay) betDisplay.innerHTML = `${currentBet} <span class="coin">M</span>`;

    const phaseEl = document.getElementById('game-phase');
    const pointEl = document.getElementById('point-display');
    if (point === null) {
        if (phaseEl) phaseEl.innerText = "Lancer de Sortie (Come Out)";
        if (pointEl) pointEl.innerText = "Aucun";
    } else {
        if (phaseEl) phaseEl.innerText = "Phase de Point";
        if (pointEl) pointEl.innerText = point;
    }

    const rollBtn = document.getElementById('roll-btn');
    if (rollBtn) rollBtn.disabled = isRolling || currentBet === 0 || currentBet > currentBalance;

    const cancelBetBtn = document.getElementById('cancel-bet-btn');
    if (cancelBetBtn) cancelBetBtn.disabled = isRolling || currentBet === 0;

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) {
        if (currentBalance === 0 && currentBet === 0 && !isRolling) {
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

window.addEventListener('storage', updateUI);

function setupEventListeners() {
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            if (isRolling || point !== null) return;
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            currentChipValue = parseInt(e.target.dataset.value, 10);
            currentBet = currentChipValue;
            showMessage(`💰 Mise sélectionnée : ${currentBet}`);
            updateUI();
        });
    });

    const cancelBetBtn = document.getElementById('cancel-bet-btn');
    if (cancelBetBtn) cancelBetBtn.addEventListener('click', cancelBet);

    const rollBtn = document.getElementById('roll-btn');
    if (rollBtn) rollBtn.addEventListener('click', () => { usingTicket = false; rollDice(); });

    const ticketBtn = document.getElementById('ticket-btn');
    if (ticketBtn) ticketBtn.addEventListener('click', () => {
        if (isRolling || currentBet === 0) return;
        if (typeof bpUseTicket !== 'function' || !bpUseTicket()) {
            showMessage("❌ Aucun ticket disponible !");
            return;
        }
        usingTicket = true;
        rollDice();
    });

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', reloadBalance);
}

function cancelBet() {
    if (isRolling || currentBet === 0) return;
    currentBet = 0;
    showMessage("Mise annulée.");
    updateUI();
}

function reloadBalance() {
    if (isRolling) return;
    setBalance(10);
    currentBet = 0;
    point = null;
    showMessage("Solde rechargé de 10 !");
}

function showMessage(msg) { const b = document.getElementById('message-box'); if (b) b.innerText = msg; }

function rollDice() {
    if (isRolling || currentBet === 0) return;
    const currentBalance = getBalance();

    if (!usingTicket) {
        if (currentBet > currentBalance) { showMessage("❌ Solde insuffisant !"); return; }
        setBalance(currentBalance - currentBet);
        if (typeof addBattlePassXP === 'function') addBattlePassXP(currentBet);
    } else {
        usingTicket = false;
        showMessage("🎫 Ticket utilisé ! Lancer gratuit...");
    }

    isRolling = true;
    updateUI();

    if (typeof playDiceSound === 'function') { try { playDiceSound(); } catch (e) {} }

    const die1Elem = document.getElementById('dice-1');
    const die2Elem = document.getElementById('dice-2');
    const sumElem = document.getElementById('dice-sum');

    die1Elem.classList.add('rolling');
    die2Elem.classList.add('rolling');

    const facesInterval = setInterval(() => {
        die1Elem.innerText = DIE_FACES[Math.floor(Math.random() * 6)];
        die2Elem.innerText = DIE_FACES[Math.floor(Math.random() * 6)];
        if (sumElem) sumElem.innerText = "Somme : ...";
    }, 70);

    setTimeout(() => {
        clearInterval(facesInterval);
        die1Elem.classList.remove('rolling');
        die2Elem.classList.remove('rolling');
        if (typeof stopDiceSound === 'function') { try { stopDiceSound(); } catch (e) {} }

        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const sum = d1 + d2;

        die1Elem.innerText = DIE_FACES[d1 - 1];
        die2Elem.innerText = DIE_FACES[d2 - 1];
        if (sumElem) sumElem.innerText = `Somme : ${sum}`;

        die1Elem.classList.add('landed');
        die2Elem.classList.add('landed');
        setTimeout(() => {
            die1Elem.classList.remove('landed');
            die2Elem.classList.remove('landed');
        }, 300);

        isRolling = false;
        handleCrapsResult(sum);
    }, 5000);
}

function handleCrapsResult(sum) {
    let currentBalance = getBalance();

    if (point === null) {
        if (sum === 7 || sum === 11) {
            const winnings = currentBet * 2;
            setBalance(currentBalance + winnings);
            showMessage(`🎉 NATUREL ! Somme ${sum}. Vous gagnez ${winnings} !`);
            currentBet = 0;
        } else if (sum === 2 || sum === 3 || sum === 12) {
            showMessage(`💥 CRAPS ! Somme ${sum}. Vous perdez.`);
            currentBet = 0;
        } else {
            point = sum;
            showMessage(`📌 Le Point est établi à ${point}. Relancez !`);
        }
    } else {
        if (sum === point) {
            const winnings = currentBet * 2;
            setBalance(currentBalance + winnings);
            showMessage(`🏆 POINT ATTEINT ! Somme ${sum}. Vous remportez ${winnings} !`);
            currentBet = 0;
            point = null;
        } else if (sum === 7) {
            showMessage(`❌ SEVEN OUT ! Un 7 est sorti. Vous perdez.`);
            currentBet = 0;
            point = null;
        } else {
            showMessage(`🎲 Somme ${sum}. On relance (Point : ${point}) !`);
        }
    }
    updateUI();
}