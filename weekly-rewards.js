// weekly-rewards.js
// Système de récompenses hebdomadaires avec STREAK STRICT
// - Il faut réclamer la récompense suivante dans les 24h après le dernier claim
// - Si tu laisses passer +48h sans réclamer → la série se reset à 0
// - Les jours ne s'accumulent jamais

const WEEKLY_REWARDS = [
    { day: 1, type: 'tokens',     amount: 25,   icon: '🪙', label: '25' },
    { day: 2, type: 'tokens',     amount: 50,   icon: '🪙', label: '50' },
    { day: 3, type: 'tokens',     amount: 100,  icon: '🪙', label: '100' },
    { day: 4, type: 'potion-x2',  amount: 1,    icon: '🧪', label: 'Potion x2' },
    { day: 5, type: 'ticket',     amount: 2,    icon: '🎫', label: '2 Tickets' },
    { day: 6, type: 'tokens',     amount: 1000, icon: '🪙', label: '1000' },
    { day: 7, type: 'chest',                    icon: '🎁', label: 'Coffre' }
];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

// ⏱️ Fenêtre de tolérance : tu as 24h pour réclamer le jour suivant
// Si tu dépasses 48h depuis ton dernier claim → reset
const CLAIM_WINDOW_MS = DAY_MS;      // 24h de fenêtre après débloquage
const STREAK_BREAK_MS = 2 * DAY_MS;  // 48h sans claim → reset

function getWeeklyUsers() { return JSON.parse(localStorage.getItem('casino_users')) || {}; }
function saveWeeklyUsers(users) { localStorage.setItem('casino_users', JSON.stringify(users)); }
function getWeeklyEmail() { return localStorage.getItem('casino_logged_email'); }

// Formatte un temps restant en "23h 45m" ou "12m 30s"
function formatTimeRemaining(ms) {
    if (ms <= 0) return '';
    const hours = Math.floor(ms / HOUR_MS);
    const minutes = Math.floor((ms % HOUR_MS) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

// ✅ Reset complet de la semaine
function resetWeeklyForUser(email) {
    const users = getWeeklyUsers();
    if (!users[email]) return;
    users[email].weekly = {
        weekStartDate: Date.now(),
        lastClaimTime: null,
        claimed: []
    };
    saveWeeklyUsers(users);
}

// ✅ Charge les données hebdo avec les règles de reset
function getWeeklyData() {
    const email = getWeeklyEmail();
    if (!email) return null;
    const users = getWeeklyUsers();
    if (!users[email]) return null;

    // Initialisation
    if (!users[email].weekly) {
        users[email].weekly = {
            weekStartDate: Date.now(),
            lastClaimTime: null,
            claimed: []
        };
        saveWeeklyUsers(users);
    }

    const w = users[email].weekly;

    // 🔄 Reset si la semaine est terminée (7 jours depuis le début)
    if (Date.now() - w.weekStartDate >= WEEK_MS) {
        users[email].weekly = {
            weekStartDate: Date.now(),
            lastClaimTime: null,
            claimed: []
        };
        saveWeeklyUsers(users);
        return users[email].weekly;
    }

    // 🔄 Reset si la série est cassée (48h+ depuis le dernier claim, mais pas tous réclamés)
    if (w.claimed.length > 0 && w.claimed.length < 7 && w.lastClaimTime) {
        if (Date.now() - w.lastClaimTime >= STREAK_BREAK_MS) {
            users[email].weekly = {
                weekStartDate: Date.now(),
                lastClaimTime: null,
                claimed: []
            };
            saveWeeklyUsers(users);
        }
    }

    return users[email].weekly;
}

// ✅ Retourne l'index du prochain jour à réclamer (1-7) ou 8 si tout est réclamé
function getNextDayToClaim(w) {
    return w.claimed.length + 1;
}

// ✅ Vérifie si un jour donné est disponible
function isDayAvailable(w, day) {
    // Doit être exactement le prochain jour de la série
    if (day !== getNextDayToClaim(w)) return false;

    // Jour 1 : dispo immédiatement après reset
    if (w.claimed.length === 0) return true;

    // Autres jours : 24h doivent s'être écoulées depuis le dernier claim
    if (!w.lastClaimTime) return false;
    return (Date.now() - w.lastClaimTime) >= DAY_MS;
}

// ✅ Vérifie si le jour est complètement verrouillé (pas encore atteint)
function isDayLocked(w, day) {
    if (w.claimed.includes(day)) return false;
    if (day === getNextDayToClaim(w)) {
        return !isDayAvailable(w, day);
    }
    return true;
}

// ✅ Temps avant déblocage du prochain jour
function getTimeUntilUnlock(w) {
    if (w.claimed.length === 0) return 0;
    if (!w.lastClaimTime) return 0;
    const unlockTime = w.lastClaimTime + DAY_MS;
    return Math.max(0, unlockTime - Date.now());
}

// ✅ Temps restant avant reset de la série (48h depuis le dernier claim)
function getTimeBeforeStreakBreak(w) {
    if (w.claimed.length === 0 || w.claimed.length >= 7) return Infinity;
    if (!w.lastClaimTime) return Infinity;
    const breakTime = w.lastClaimTime + STREAK_BREAK_MS;
    return Math.max(0, breakTime - Date.now());
}

function claimWeeklyReward(day) {
    const email = getWeeklyEmail();
    if (!email) return { ok: false, msg: 'Non connecté' };

    const users = getWeeklyUsers();
    if (!users[email]) return { ok: false, msg: 'Utilisateur inconnu' };

    const w = getWeeklyData();
    if (!w) return { ok: false, msg: 'Erreur' };

    // Vérifier que c'est bien le prochain jour
    if (day !== getNextDayToClaim(w)) {
        return { ok: false, msg: '⚠️ Tu dois réclamer les jours dans l\'ordre' };
    }

    // Vérifier que le jour est disponible
    if (!isDayAvailable(w, day)) {
        const remaining = getTimeUntilUnlock(w);
        return { ok: false, msg: `⏳ Disponible dans ${formatTimeRemaining(remaining)}` };
    }

    const reward = WEEKLY_REWARDS.find(r => r.day === day);
    if (!reward) return { ok: false, msg: 'Récompense inconnue' };

    // Applique la récompense
    if (reward.type === 'tokens') {
        users[email].balance = (users[email].balance || 0) + reward.amount;
        localStorage.setItem('casinoBalance', users[email].balance.toString());
    } else if (reward.type === 'ticket') {
        users[email].tickets = (users[email].tickets || 0) + reward.amount;
    } else if (reward.type === 'potion-x2') {
        if (!users[email].inventory) users[email].inventory = {};
        users[email].inventory['potion-x2'] = (users[email].inventory['potion-x2'] || 0) + reward.amount;
    } else if (reward.type === 'chest') {
        users[email].weekly.claimed.push(day);
        users[email].weekly.lastClaimTime = Date.now();
        saveWeeklyUsers(users);
        renderWeeklyRewards();
        if (typeof updateDisplayBalance === 'function') updateDisplayBalance();
        if (typeof refreshBPTicketsUI === 'function') refreshBPTicketsUI();
        if (typeof potionUpdateUI === 'function') potionUpdateUI();

        closeWeeklyModal();
        setTimeout(() => {
            if (typeof openChest === 'function') openChest();
        }, 400);

        return { ok: true, reward };
    }

    // Enregistre le claim
    users[email].weekly.claimed.push(day);
    users[email].weekly.lastClaimTime = Date.now();
    saveWeeklyUsers(users);

    if (typeof updateDisplayBalance === 'function') updateDisplayBalance();
    if (typeof refreshBPTicketsUI === 'function') refreshBPTicketsUI();
    if (typeof potionUpdateUI === 'function') potionUpdateUI();

    return { ok: true, reward };
}

function renderWeeklyRewards() {
    const container = document.getElementById('weekly-grid');
    const weeklyBtn = document.getElementById('weekly-btn');
    if (!container) return;

    const w = getWeeklyData();
    if (!w) {
        container.innerHTML = '<p style="color:#888;text-align:center;padding:20px;grid-column:1/-1;">Connectez-vous pour voir les récompenses</p>';
        return;
    }

    // ✅ Si les 7 jours sont tous réclamés → on cache le bouton
    const allClaimed = w.claimed.length >= 7;

    if (weeklyBtn) {
        if (allClaimed) {
            weeklyBtn.style.display = 'none';
        } else {
            weeklyBtn.style.display = 'flex';
        }
    }

    if (allClaimed) {
        closeWeeklyModal();
    }

    // Met à jour le badge (affiche 1 si le prochain jour est dispo, 0 sinon)
    const badge = document.getElementById('weekly-btn-badge');
    if (badge) {
        const nextDay = getNextDayToClaim(w);
        const available = !allClaimed && isDayAvailable(w, nextDay);
        if (available) {
            badge.textContent = '1';
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // Rendu des cartes
    container.innerHTML = '';
    WEEKLY_REWARDS.forEach(reward => {
        const claimed = w.claimed.includes(reward.day);
        const available = isDayAvailable(w, reward.day);
        const isNext = reward.day === getNextDayToClaim(w);
        const isChest = reward.day === 7;

        let cardClass = 'weekly-card';
        if (claimed) cardClass += ' claimed';
        else if (available) cardClass += ' claimable';
        else cardClass += ' locked';
        if (isChest) cardClass += ' chest-card';

        const card = document.createElement('div');
        card.className = cardClass;

        // ✅ Coin doré M pour les jetons, emoji sinon
        const isTokens = reward.type === 'tokens';
        const iconHTML = isTokens
            ? `<div class="weekly-icon coin-icon"><span class="coin large">M</span></div>`
            : `<div class="weekly-icon">${reward.icon}</div>`;

        // Infos du timer
        let timerInfo = '';
        if (isNext && !available && !claimed) {
            const remaining = getTimeUntilUnlock(w);
            timerInfo = `<div class="weekly-timer">⏳ ${formatTimeRemaining(remaining)}</div>`;
        } else if (!isNext && !claimed) {
            timerInfo = `<div class="weekly-timer">🔒 Plus tard</div>`;
        }

        card.innerHTML = `
            ${iconHTML}
            <div class="weekly-label">${reward.label}</div>
            <div class="weekly-day-badge">J${reward.day}</div>
            ${claimed ? '<div class="weekly-check">✓</div>' : ''}
            ${!available && !claimed ? '<div class="weekly-lock">🔒</div>' : ''}
            ${timerInfo}
        `;

        if (available) {
            card.addEventListener('click', () => {
                const res = claimWeeklyReward(reward.day);
                if (res.ok) {
                    card.classList.add('claiming');
                    setTimeout(() => renderWeeklyRewards(), 300);
                } else {
                    showWeeklyMessage(res.msg);
                }
            });
        } else if (!claimed) {
            card.addEventListener('click', () => {
                if (isNext) {
                    const remaining = getTimeUntilUnlock(w);
                    showWeeklyMessage(`⏳ Jour ${reward.day} disponible dans ${formatTimeRemaining(remaining)}`);
                } else {
                    showWeeklyMessage(`🔒 Termine d'abord le jour ${getNextDayToClaim(w)}`);
                }
            });
        }

        container.appendChild(card);
    });
}

function showWeeklyMessage(text) {
    let msg = document.getElementById('weekly-message');
    if (!msg) {
        msg = document.createElement('div');
        msg.id = 'weekly-message';
        msg.className = 'weekly-message';
        const modal = document.querySelector('.weekly-modal-content');
        if (modal) modal.appendChild(msg);
    }
    msg.textContent = text;
    msg.classList.add('visible');
    clearTimeout(showWeeklyMessage._t);
    showWeeklyMessage._t = setTimeout(() => {
        msg.classList.remove('visible');
    }, 2500);
}

function openWeeklyModal() {
    const modal = document.getElementById('weekly-modal');
    if (modal) {
        modal.classList.add('visible');
        renderWeeklyRewards();
    }
}

function closeWeeklyModal() {
    const modal = document.getElementById('weekly-modal');
    if (modal) modal.classList.remove('visible');
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('weekly-modal');
    if (modal && e.target === modal) closeWeeklyModal();
});

document.addEventListener('DOMContentLoaded', () => {
    renderWeeklyRewards();
    setInterval(renderWeeklyRewards, 1000);
});