// battle-pass.js
// Pass de Combat — Saisons dynamiques de 30 jours

const BP_MAX_LEVEL = 100;
const BP_SEASON_DURATION_DAYS = 30;
const BP_SEASON_EPOCH = new Date('2026-09-25T00:00:00Z').getTime();
const BP_SEASON_DURATION_MS = BP_SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000;

function bpGetCurrentSeasonNumber() {
    const elapsed = Date.now() - BP_SEASON_EPOCH;
    if (elapsed < 0) return 1;
    return Math.floor(elapsed / BP_SEASON_DURATION_MS) + 1;
}

function bpGetSeasonStartFor(seasonNum) {
    return BP_SEASON_EPOCH + (seasonNum - 1) * BP_SEASON_DURATION_MS;
}

function bpGetSeasonEndFor(seasonNum) {
    return BP_SEASON_EPOCH + seasonNum * BP_SEASON_DURATION_MS;
}

function bpGetDaysRemaining() {
    const seasonNum = bpGetCurrentSeasonNumber();
    const end = bpGetSeasonEndFor(seasonNum);
    return Math.ceil(Math.max(0, (end - Date.now()) / (1000 * 60 * 60 * 24)));
}

function bpGetSeasonLabel() {
    return `SAISON ${bpGetCurrentSeasonNumber()}`;
}

function getXPForLevel(level) {
    if (level >= 100) return 0;
    if (level < 10)   return 300;
    if (level < 20)   return 1500;
    if (level < 30)   return 3000;
    if (level < 40)   return 7500;
    if (level < 50)   return 15000;
    if (level < 60)   return 30000;
    if (level < 70)   return 60000;
    if (level < 80)   return 120000;
    if (level < 90)   return 225000;
    return 450000;
}

const BP_XP_THRESHOLDS = (function() {
    const arr = [0];
    for (let i = 1; i < BP_MAX_LEVEL; i++) {
        arr.push(arr[i - 1] + getXPForLevel(i));
    }
    return arr;
})();

const BP_REWARDS = (function() {
    const rewards = [];
    const FREE_TICKET_LEVELS    = [15, 30, 45, 60, 75];
    const PREMIUM_TICKET_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    const freeTemplates = [
        { type: 'tokens', amount: 25 }, { type: 'tokens', amount: 50 },
        { type: 'tokens', amount: 100 }, { type: 'potion-x2', amount: 1 },
        { type: 'tokens', amount: 200 }, { type: 'tokens', amount: 150 },
        { type: 'potion-x2', amount: 1 }, { type: 'tokens', amount: 300 },
        { type: 'tokens', amount: 250 }, { type: 'tokens', amount: 400 }
    ];

    const premiumTemplates = [
        { type: 'tokens', amount: 100 }, { type: 'potion-x2', amount: 2 },
        { type: 'tokens', amount: 250 }, { type: 'tokens', amount: 500 },
        { type: 'potion-x2', amount: 3 }, { type: 'tokens', amount: 1000 },
        { type: 'tokens', amount: 750 }, { type: 'tokens', amount: 500 },
        { type: 'potion-x2', amount: 3 }, { type: 'tokens', amount: 1500 }
    ];

    for (let level = 1; level <= BP_MAX_LEVEL; level++) {
        let free, premium;

        if (FREE_TICKET_LEVELS.includes(level)) {
            free = { type: 'ticket', amount: 1 };
        } else if (level === BP_MAX_LEVEL) {
            free = { type: 'tokens', amount: 10000 };
        } else if (level % 25 === 0) {
            free = { type: 'potion-x2', amount: 5 };
        } else if (level % 10 === 0) {
            free = { type: 'tokens', amount: 1000 };
        } else if (level % 5 === 0) {
            free = { type: 'potion-x2', amount: 2 };
        } else {
            free = freeTemplates[(level - 1) % freeTemplates.length];
        }

        if (PREMIUM_TICKET_LEVELS.includes(level)) {
            premium = { type: 'ticket', amount: 1 };
        } else if (level === BP_MAX_LEVEL) {
            premium = { type: 'tokens', amount: 100000 };
        } else if (level % 25 === 0) {
            premium = { type: 'potion-x2', amount: 15 };
        } else if (level % 10 === 0) {
            premium = { type: 'tokens', amount: 5000 };
        } else if (level % 5 === 0) {
            premium = { type: 'potion-x2', amount: 4 };
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

function bpCheckAndApplySeasonReset(u) {
    if (!u.bp) {
        u.bp = { xp: 0, claimedFree: [], claimedPremium: [], season: bpGetCurrentSeasonNumber() };
        return true;
    }
    if (typeof u.bp.season !== 'number') {
        u.bp.season = bpGetCurrentSeasonNumber();
    }
    const currentSeason = bpGetCurrentSeasonNumber();
    if (u.bp.season < currentSeason) {
        u.bp = { xp: 0, claimedFree: [], claimedPremium: [], season: currentSeason };
        return true;
    }
    return false;
}

function bpGetData() {
    const email = bpGetEmail();
    if (!email) return null;
    const users = bpGetUsers();
    if (!users[email]) return null;

    const u = users[email];
    if (!u.inventory) u.inventory = {};
    if (typeof u.tickets !== 'number') u.tickets = 0;

    bpCheckAndApplySeasonReset(u);
    bpSaveUsers(users);

    return {
        bp: u.bp,
        tickets: u.tickets,
        inventory: u.inventory,
        hasPremium: !!u.inventory['battle-pass'],
        daysRemaining: bpGetDaysRemaining(),
        seasonNumber: bpGetCurrentSeasonNumber()
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

function bpForceNewSeason() {
    if (!confirm('⚠️ Forcer le reset de la saison en cours pour TOUS les joueurs ?')) return;
    const users = bpGetUsers();
    const currentSeason = bpGetCurrentSeasonNumber();
    for (const email in users) {
        if (users[email].bp) {
            users[email].bp = { xp: 0, claimedFree: [], claimedPremium: [], season: currentSeason };
        }
    }
    bpSaveUsers(users);
    if (typeof renderBattlePass === 'function') renderBattlePass();
}

function addBattlePassXP(amount) {
    if (amount <= 0) return;
    const email = bpGetEmail();
    if (!email) return;
    const users = bpGetUsers();
    if (!users[email]) return;

    const u = users[email];
    bpCheckAndApplySeasonReset(u);

    const oldLevel = bpGetLevel(u.bp.xp);
    u.bp.xp += amount;
    const newLevel = bpGetLevel(u.bp.xp);

    if (typeof u.rankXP !== 'number') u.rankXP = 0;
    const oldRankXP = u.rankXP;
    u.rankXP += amount;

    bpSaveUsers(users);
    showXPGainPopup(amount);
    if (newLevel > oldLevel) showLevelUpPopup(newLevel);

    if (typeof updateRankButton === 'function') updateRankButton();

    if (typeof RANKS !== 'undefined' && typeof getCurrentRankIndex === 'function') {
        const oldRankIdx = getCurrentRankIndex(oldRankXP);
        const newRankIdx = getCurrentRankIndex(u.rankXP);
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

    const u = users[email];
    bpCheckAndApplySeasonReset(u);

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
    const fu = freshUsers[email];
    bpCheckAndApplySeasonReset(fu);

    if (reward.type === 'tokens') {
        fu.balance = (fu.balance || 0) + reward.amount;
        localStorage.setItem('casinoBalance', fu.balance.toString());
    } else if (reward.type === 'ticket') {
        fu.tickets = (fu.tickets || 0) + reward.amount;
    } else if (reward.type === 'potion-x2' || reward.type === 'potion-x5') {
        if (!fu.inventory) fu.inventory = {};
        fu.inventory[reward.type] = (fu.inventory[reward.type] || 0) + reward.amount;
    }

    if (type === 'free') fu.bp.claimedFree.push(level);
    else fu.bp.claimedPremium.push(level);

    bpSaveUsers(freshUsers);
    refreshBPTicketsUI();
    if (typeof updateDisplayBalance === 'function') updateDisplayBalance();

    return { ok: true, msg: 'Récompense reçue !' };
}

function bpGetAvailableRewards() {
    const data = bpGetData();
    if (!data) return { free: [], premium: [] };

    const currentLevel = bpGetLevel(data.bp.xp);
    const free = [];
    const premium = [];

    for (let level = 1; level <= currentLevel; level++) {
        if (!data.bp.claimedFree.includes(level)) free.push(level);
        if (data.hasPremium && !data.bp.claimedPremium.includes(level)) premium.push(level);
    }

    return { free, premium };
}

function bpUpdateClaimAllButton() {
    const btn = document.getElementById('bp-claim-all-btn');
    const countEl = document.getElementById('bp-claim-all-count');
    if (!btn) return;

    const data = bpGetData();
    if (!data) {
        btn.disabled = true;
        if (countEl) countEl.textContent = '';
        return;
    }

    const available = bpGetAvailableRewards();
    const total = available.free.length + available.premium.length;

    if (total === 0) {
        btn.disabled = true;
        btn.textContent = '✅ TOUT RÉCLAMÉ';
        if (countEl) countEl.textContent = '';
    } else {
        btn.disabled = false;
        btn.textContent = '🎁 TOUT RÉCLAMER';
        if (countEl) {
            countEl.innerHTML = `<strong>${total}</strong> récompense${total > 1 ? 's' : ''} disponible${total > 1 ? 's' : ''}`;
        }
    }
}

function bpClaimAllRewards() {
    const data = bpGetData();
    if (!data) {
        if (typeof showBPMessage === 'function') showBPMessage('❌ Non connecté', 'error');
        return;
    }

    const available = bpGetAvailableRewards();
    const total = available.free.length + available.premium.length;

    if (total === 0) {
        if (typeof showBPMessage === 'function') showBPMessage('ℹ️ Aucune récompense à réclamer', 'error');
        return;
    }

    const email = bpGetEmail();
    const users = bpGetUsers();
    if (!users[email]) return;

    const u = users[email];
    bpCheckAndApplySeasonReset(u);

    let tokensGained = 0;
    let ticketsGained = 0;
    let potionsX2 = 0;

    for (const level of available.free) {
        const rewards = BP_REWARDS.find(r => r.level === level);
        if (!rewards) continue;
        const r = rewards.free;

        if (r.type === 'tokens') {
            u.balance = (u.balance || 0) + r.amount;
            tokensGained += r.amount;
        } else if (r.type === 'ticket') {
            u.tickets = (u.tickets || 0) + r.amount;
            ticketsGained += r.amount;
        } else if (r.type === 'potion-x2' || r.type === 'potion-x5') {
            if (!u.inventory) u.inventory = {};
            u.inventory[r.type] = (u.inventory[r.type] || 0) + r.amount;
            if (r.type === 'potion-x2') potionsX2 += r.amount;
        }

        u.bp.claimedFree.push(level);
    }

    for (const level of available.premium) {
        const rewards = BP_REWARDS.find(r => r.level === level);
        if (!rewards) continue;
        const r = rewards.premium;

        if (r.type === 'tokens') {
            u.balance = (u.balance || 0) + r.amount;
            tokensGained += r.amount;
        } else if (r.type === 'ticket') {
            u.tickets = (u.tickets || 0) + r.amount;
            ticketsGained += r.amount;
        } else if (r.type === 'potion-x2' || r.type === 'potion-x5') {
            if (!u.inventory) u.inventory = {};
            u.inventory[r.type] = (u.inventory[r.type] || 0) + r.amount;
            if (r.type === 'potion-x2') potionsX2 += r.amount;
        }

        u.bp.claimedPremium.push(level);
    }

    localStorage.setItem('casinoBalance', (u.balance || 0).toString());
    bpSaveUsers(users);

    if (typeof updateDisplayBalance === 'function') updateDisplayBalance();
    if (typeof refreshBPTicketsUI === 'function') refreshBPTicketsUI();
    if (typeof potionUpdateUI === 'function') potionUpdateUI();
    if (typeof renderBattlePass === 'function') renderBattlePass();

    const parts = [];
    if (tokensGained > 0) parts.push(`${tokensGained.toLocaleString()} jetons`);
    if (ticketsGained > 0) parts.push(`${ticketsGained} ticket(s)`);
    if (potionsX2 > 0) parts.push(`${potionsX2} potion(s) x2`);

    if (typeof showBPMessage === 'function') {
        showBPMessage(`🎉 ${total} récompense(s) réclamée(s) : ${parts.join(', ')}`, 'success');
    }
}

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

function bpGetTicketsCount() { return bpGetTickets(); }

// ✅ FIX : respecte le data-game-disabled posé par les jeux
function bpUpdateTicketButtons() {
    const tickets = bpGetTicketsCount();
    document.querySelectorAll('.ticket-btn').forEach(btn => {
        const gameDisabled = btn.getAttribute('data-game-disabled') === 'true';
        btn.disabled = (tickets < 1) || gameDisabled;
        const countSpan = btn.querySelector('.ticket-count');
        if (countSpan) countSpan.textContent = tickets;
    });
}

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
