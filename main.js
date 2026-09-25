// --- GESTION DU SOLDE ET DE LA SESSION UTILISATEUR ---

function getUsers() {
    return JSON.parse(localStorage.getItem('casino_users')) || {};
}

function saveUsers(users) {
    localStorage.setItem('casino_users', JSON.stringify(users));
}

function getCurrentEmail() {
    return localStorage.getItem('casino_logged_email');
}

function getUserBalance() {
    const email = getCurrentEmail();
    if (!email) return 0;
    const users = getUsers();
    if (users[email]) {
        if (users[email].balance === undefined || isNaN(users[email].balance)) {
            users[email].balance = 0;
            saveUsers(users);
        }
        return users[email].balance;
    }
    return 0;
}

function setUserBalance(newAmount) {
    const email = getCurrentEmail();
    if (!email) return;
    const users = getUsers();
    if (users[email]) {
        users[email].balance = newAmount;
        saveUsers(users);
        localStorage.setItem('casinoBalance', newAmount.toString());
        updateDisplayBalance();
    }
}

function reloadBalance() {
    const email = getCurrentEmail();
    if (!email) return;
    const users = getUsers();
    if (users[email] && users[email].balance === 0) {
        setUserBalance(10);
    }
}

function updateDisplayBalance() {
    const email = getCurrentEmail();
    const users = getUsers();
    const profileStatus = document.getElementById('profile-status');
    const balanceEl = document.getElementById('global-balance');
    const resetBtn = document.getElementById('reset-balance-btn');

    if (email && users[email]) {
        const pseudo = users[email].pseudo || email;
        if (profileStatus) profileStatus.textContent = pseudo;

        const currentBalance = getUserBalance();
        localStorage.setItem('casinoBalance', currentBalance.toString());

        if (balanceEl) balanceEl.innerHTML = `${currentBalance} <span class="coin">M</span>`;

        if (resetBtn) {
            if (currentBalance === 0) {
                resetBtn.style.display = 'inline-block';
                resetBtn.innerHTML = '🔄 RECHARGER (10 <span class="coin small">M</span>)';
            } else {
                resetBtn.style.display = 'none';
            }
        }
    } else {
        if (profileStatus) profileStatus.textContent = "Connexion";
        if (balanceEl) balanceEl.innerHTML = `0 <span class="coin">M</span>`;
        if (resetBtn) resetBtn.style.display = 'none';
        localStorage.setItem('casinoBalance', '0');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const resetBtn = document.getElementById('reset-balance-btn');
    if (resetBtn) resetBtn.addEventListener('click', reloadBalance);
    updateDisplayBalance();
});

window.addEventListener('storage', () => {
    updateDisplayBalance();
});