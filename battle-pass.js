// battle-pass.js
// Système de Pass de Combat + gestion des tickets + XP de rang

const BP_MAX_LEVEL = 50;
const BP_SEASON_DURATION_DAYS = 21;

const BP_XP_THRESHOLDS = (function() {
    const arr = [0];
    for (let i = 1; i < BP_MAX_LEVEL; i++) {
        let xpNeeded;
        if (i < 10) xpNeeded = 50;
        else if (i < 20) xpNeeded = 120;
        else if (i < 30) xpNeeded = 250;
        else xpNeeded = 500;
        arr.push(arr[i - 1] + xpNeeded);
    }
    return arr;
})();

const BP_REWARDS = (function() {
    const rewards = [];
    const freeTemplates = [
        { type: 'tokens', amount: 10 },
        { type: 'tokens', amount: 5 },
        { type: 'tokens', amount: 25 },
        { type: 'tokens', amount: 15 },
        { type: 'potion-x2', amount: 1 },
        { type: 'tokens', amount: 50 },
        { type: 'tokens', amount: 10 },
        { type: 'tokens', amount: 20 },
        { type: 'tokens', amount: 30 },
        { type: 'potion-x2', amount: 1 }
    ];
    const premiumTemplates = [
        { type: 'tokens', amount: 50 },
        { type: 'potion-x2', amount: 1 },
        { type: 'tokens', amount: 100 },
        { type: 'tokens', amount: 75 },
        { type: 'potion-x5', amount: 1 },
        { type: 'tokens', amount: 150 },
        { type: 'tokens', amount: 75 },
        { type: 'tokens', amount: 100 },
        { type: 'potion-x5', amount: 1 },
        { type: 'tokens', amount: 200 }
    ];

    for (let level = 1; level <= BP_MAX_LEVEL; level++) {
        let free, premium;

        if (level === BP_MAX_LEVEL) {
            free = { type: 'tokens', amount: 200 };
            premium = { type: 'tokens', amount: 2000 };
        } else if (level % 15 === 0) {
            free = { type: 'ticket', amount: 1 };
            premium = { type: 'ticket', amount: 3 };
        } else if (level % 10 === 0) {
            free = { type: 'tokens', amount: 100 };
            premium = { type: 'tokens', amount: 500 };
        } else if (level % 5 === 0) {
            free = { type: 'potion-x2', amount: 1 };
            premium = { type: 'potion-x5', amount: 1 };
        } else {
            free = freeTemplates[(level - 1) % freeTemplates.length];
            premium = premiumTemplates[(level - 1) % premiumTemplates.length];
        }

        rewards.push({ level, free: { ...free }, premium: { ...premium } });
    }
    return rewards;
})();

function bpGetUsers() { return JSON.parse(localStorage.getItem('casino_users')) || {}; }
function bpSaveUsers(users) { localStorage.setItem('casino_users', JSON.stringify(users)); }
function bpGetEmail() { return localStorage.getItem('casino_logged_email'); }

function bpGetSeasonStart() {
    const stored = localStorage.getItem('bp_season_start');
    if (stored) {
        const start = parseInt(stored, 10);
        if (isNaN(start)) {
            localStorage.removeItem('bp_season_start');
            return bpGetSeasonStart();
        }
        const now = Date.now();
        const daysPassed = (now - start) / (1000 * 60 * 60 * 24);
        if (daysPassed >= BP_SEASON_DURATION_DAYS) {
            bpResetAllPlayers();
            const newStart = Date.now();
            localStorage.setItem('bp_season_start', newStart.toString());
            return newStart;
        }
        return start;
    }
    const start = Date.now();
    localStorage.setItem('bp_season_start', start.toString());
    return start;
}

function bpForceNewSeason() {
    localStorage.removeItem('bp_season_start');
    bpResetAllPlayers();
    bpGetSeasonStart();
    if (typeof renderBattlePass === 'function') renderBattlePass();
}

function bpGetDaysRemaining() {
    const start = bpGetSeasonStart();
    const elapsed = (Date.now() - start) / (1000 * 60 * 60 * 24);
    return Math.ceil(Math.max(0, BP_SEASON_DURATION_DAYS - elapsed));
}

function bpResetAllPlayers() {
    const users = bpGetUsers();
    for (const email in users) {
        if (users[email].bp) {
            users[email].bp = { xp: 0, claimedFree: [], claimedPremium: [] };
        }
    }
    bpSaveUsers(users);
}

function bpGetData() {
    const email = bpGetEmail();
    if (!email) return null;
    const users = bpGetUsers();
    if (!users[email]) return null;

    if (!users[email].bp) users[email].bp = { xp: 0, claimedFree: [], claimedPremium: [] };
    if (typeof users[email].tickets !== 'number') users[email].tickets = 0;
    if (!users[email].inventory) users[email].inventory = {};

    bpSaveUsers(users);
    return {
        bp: users[email].bp,
        tickets: users[email].tickets,
        inventory: users[email].inventory,
        hasPremium: !!users[email].inventory['battle-pass'],
        daysRemaining: bpGetDaysRemaining()
    };
}

function bpGetLevel(xp) {
    let level = 1;
    for (let i = 0; i < BP_XP_THRESHOLDS.length; i++) {
        if (xp >= BP_XP_THRESHOLDS[i]) level = i + 1;
        else break;
    }
    return level;
}

function bpGetTickets() {
    const email = bpGetEmail();
    if (!email) return 0;
    const users = bpGetUsers();
    if (!users[email]) return 0;
    return users[email].tickets || 0;
}

// ✅ Ajoute XP au Pass ET au Rang
function addBattlePassXP(amount) {
    if (amount <= 0) return;
    const email = bpGetEmail();
    if (!email) return;
    const users = bpGetUsers();
    if (!users[email]) return;

    bpGetSeasonStart();
    if (!users[email].bp) users[email].bp = { xp: 0, claimedFree: [], claimedPremium: [] };

    const oldLevel = bpGetLevel(users[email].bp.xp);
    users[email].bp.xp += amount;
    const newLevel = bpGetLevel(users[email].bp.xp);

    // ✅ Ajoute aussi l'XP de RANG
    if (typeof users[email].rankXP !== 'number') users[email].rankXP = 0;
    const oldRankXP = users[email].rankXP;
    users[email].rankXP += amount;

    bpSaveUsers(users);
    showXPGainPopup(amount);
    if (newLevel > oldLevel) showLevelUpPopup(newLevel);

    // ✅ Notifie le système de rang (si présent sur la page)
    if (typeof updateRankButton === 'function') updateRankButton();

    // ✅ Détecte un rank up et affiche la popup
    if (typeof RANKS !== 'undefined' && typeof getCurrentRankIndex === 'function') {
        const oldRankIdx = getCurrentRankIndex(oldRankXP);
        const newRankIdx = getCurrentRankIndex(users[email].rankXP);
        if (newRankIdx > oldRankIdx) {
            if (typeof showRankUpPopup === 'function') {
                showRankUpPopup(RANKS[newRankIdx]);
            }
        }
    }
}

function showXPGainPopup(amount) {
    const popup = document.createElement('div');
    popup.className = 'xp-popup';
    popup.textContent = `+${amount} XP`;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 2000);
}

function showLevelUpPopup(level) {
    const popup = document.createElement('div');
    popup.className = 'levelup-popup';
    popup.innerHTML = `
        <div class="levelup-title">🎉 NIVEAU ${level} !</div>
        <div class="levelup-sub">Récompense disponible dans le Pass</div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 500);
    }, 3000);
}

function bpClaimReward(level, type) {
    const email = bpGetEmail();
    if (!email) return { ok: false, msg: 'Non connecté' };

    const users = bpGetUsers();
    if (!users[email]) return { ok: false, msg: 'Utilisateur inconnu' };
    if (!users[email].bp) users[email].bp = { xp: 0, claimedFree: [], claimedPremium: [] };

    const data = bpGetData();
    if (!data) return { ok: false, msg: 'Erreur données' };

    const currentLevel = bpGetLevel(data.bp.xp);
    if (level > currentLevel) return { ok: false, msg: 'Niveau non atteint' };

    const rewards = BP_REWARDS.find(r => r.level === level);
    if (!rewards) return { ok: false, msg: 'Récompense inconnue' };

    const reward = type === 'free' ? rewards.free : rewards.premium;
    if (type === 'premium' && !data.hasPremium) return { ok: false, msg: 'Pass Premium non acheté' };

    const claimedList = type === 'free' ? data.bp.claimedFree : data.bp.claimedPremium;
    if (claimedList.includes(level)) return { ok: false, msg: 'Déjà réclamé' };

    const freshUsers = bpGetUsers();
    const u = freshUsers[email];

    if (reward.type === 'tokens') {
        u.balance = (u.balance || 0) + reward.amount;
        localStorage.setItem('casinoBalance', u.balance.toString());
    } else if (reward.type === 'ticket') {
        u.tickets = (u.tickets || 0) + reward.amount;
    } else if (reward.type === 'potion-x2' || reward.type === 'potion-x5') {
        if (!u.inventory) u.inventory = {};
        u.inventory[reward.type] = (u.inventory[reward.type] || 0) + reward.amount;
    }

    if (!u.bp) u.bp = { xp: 0, claimedFree: [], claimedPremium: [] };
    if (type === 'free') u.bp.claimedFree.push(level);
    else u.bp.claimedPremium.push(level);

    bpSaveUsers(freshUsers);
    refreshBPTicketsUI();
    if (typeof updateDisplayBalance === 'function') updateDisplayBalance();

    return { ok: true, msg: 'Récompense reçue !' };
}

// --- UTILISATION D'UN TICKET ---
function bpUseTicket() {
    const email = bpGetEmail();
    if (!email) return false;
    const users = bpGetUsers();
    if (!users[email]) return false;

    if (!users[email].tickets || users[email].tickets < 1) return false;

    users[email].tickets -= 1;
    bpSaveUsers(users);
    refreshBPTicketsUI();
    return true;
}

function bpGetTicketsCount() {
    return bpGetTickets();
}

function bpUpdateTicketButtons() {
    const tickets = bpGetTicketsCount();
    document.querySelectorAll('.ticket-btn').forEach(btn => {
        btn.disabled = tickets < 1;
        const countSpan = btn.querySelector('.ticket-count');
        if (countSpan) countSpan.textContent = tickets;
    });
}

// --- UI TICKETS ---
function refreshBPTicketsUI() {
    const tickets = bpGetTickets();
    document.querySelectorAll('.tickets-value').forEach(el => {
        el.textContent = tickets;
    });
    bpUpdateTicketButtons();
}

function injectTicketsDisplay() {
    const email = bpGetEmail();
    if (!email) return;

    const containers = document.querySelectorAll('.global-balance-box, .balance-container');
    containers.forEach(container => {
        if (container.querySelector('.tickets-box')) return;
        const box = document.createElement('div');
        box.className = 'tickets-box';
        box.innerHTML = `
            <span class="tickets-icon">🎫</span>
            <span class="tickets-value">${bpGetTickets()}</span>
        `;
        container.appendChild(box);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    bpGetSeasonStart();
    injectTicketsDisplay();
    bpUpdateTicketButtons();
    setInterval(() => {
        refreshBPTicketsUI();
    }, 500);
});

window.addEventListener('storage', () => {
    injectTicketsDisplay();
    refreshBPTicketsUI();
});