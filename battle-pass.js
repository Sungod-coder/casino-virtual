// battle-pass.js
// Système de Pass de Combat + gestion des tickets + XP de rang

const BP_MAX_LEVEL = 100;
const BP_SEASON_DURATION_DAYS = 60;

// Progression par palier (XP nécessaire pour passer au niveau suivant)
function getXPForLevel(level) {
    if (level >= 100) return 0;
    if (level < 10)   return 100;      // 1 → 10
    if (level < 20)   return 500;      // 10 → 20
    if (level < 30)   return 1000;     // 20 → 30
    if (level < 40)   return 2500;     // 30 → 40
    if (level < 50)   return 5000;     // 40 → 50
    if (level < 60)   return 10000;    // 50 → 60
    if (level < 70)   return 20000;    // 60 → 70
    if (level < 80)   return 40000;    // 70 → 80
    if (level < 90)   return 75000;    // 80 → 90
    return 150000;                     // 90 → 100
}

// Construit la table des seuils cumulés (XP total pour atteindre chaque niveau)
const BP_XP_THRESHOLDS = (function() {
    const arr = [0]; // niveau 1 = 0 XP
    for (let i = 1; i < BP_MAX_LEVEL; i++) {
        arr.push(arr[i - 1] + getXPForLevel(i));
    }
    return arr;
})();

// Récompenses : générées dynamiquement pour 100 niveaux
// 🎫 Répartition : GRATUIT = 5 tickets total | PREMIUM = 10 tickets total
const BP_REWARDS = (function() {
    const rewards = [];

    // 🎯 Paliers où on donne des tickets
    const FREE_TICKET_LEVELS    = [15, 30, 45, 60, 75];                     // 5 tickets au total
    const PREMIUM_TICKET_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // 10 tickets au total

    // Templates de récompenses (cyclent pour les niveaux sans ticket)
    const freeTemplates = [
        { type: 'tokens', amount: 25 },
        { type: 'tokens', amount: 50 },
        { type: 'tokens', amount: 100 },
        { type: 'potion-x2', amount: 1 },
        { type: 'tokens', amount: 200 },
        { type: 'tokens', amount: 150 },
        { type: 'potion-x2', amount: 1 },
        { type: 'tokens', amount: 300 },
        { type: 'tokens', amount: 250 },
        { type: 'tokens', amount: 400 }
    ];

    const premiumTemplates = [
        { type: 'tokens', amount: 100 },
        { type: 'potion-x2', amount: 2 },
        { type: 'tokens', amount: 250 },
        { type: 'tokens', amount: 500 },
        { type: 'potion-x5', amount: 1 },
        { type: 'tokens', amount: 1000 },
        { type: 'tokens', amount: 750 },
        { type: 'tokens', amount: 500 },
        { type: 'potion-x5', amount: 1 },
        { type: 'tokens', amount: 1500 }
    ];

    for (let level = 1; level <= BP_MAX_LEVEL; level++) {
        let free, premium;

        // ========== GRATUIT ==========
        if (FREE_TICKET_LEVELS.includes(level)) {
            free = { type: 'ticket', amount: 1 };
        } else if (level === BP_MAX_LEVEL) {
            free = { type: 'tokens', amount: 10000 };
        } else if (level % 25 === 0) {
            free = { type: 'potion-x5', amount: 3 };
        } else if (level % 10 === 0) {
            free = { type: 'tokens', amount: 1000 };
        } else if (level % 5 === 0) {
            free = { type: 'potion-x2', amount: 2 };
        } else {
            free = freeTemplates[(level - 1) % freeTemplates.length];
        }

        // ========== PREMIUM ==========
        if (PREMIUM_TICKET_LEVELS.includes(level)) {
            premium = { type: 'ticket', amount: 1 };
        } else if (level === BP_MAX_LEVEL) {
            premium = { type: 'tokens', amount: 100000 };
        } else if (level % 25 === 0) {
            premium = { type: 'potion-x5', amount: 10 };
        } else if (level % 10 === 0) {
            premium = { type: 'tokens', amount: 5000 };
        } else if (level % 5 === 0) {
            premium = { type: 'potion-x5', amount: 2 };
        } else {
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

    if (typeof updateRankButton === 'function') updateRankButton();

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
