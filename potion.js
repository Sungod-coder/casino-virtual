// potion.js
// Système de potions de chance

const POTION_CONFIG = {
    'potion-x2': { duration: 2 * 60 * 1000, multiplier: 2, label: 'Potion Chance x2', icon: '🧪' },
    'potion-x5': { duration: 5 * 60 * 1000, multiplier: 5, label: 'Potion Chance x5', icon: '⚗️' }
};

// --- UTILS ---
function potionGetUsers() { return JSON.parse(localStorage.getItem('casino_users')) || {}; }
function potionSaveUsers(users) { localStorage.setItem('casino_users', JSON.stringify(users)); }
function potionGetEmail() { return localStorage.getItem('casino_logged_email'); }

function potionGetInventory() {
    const email = potionGetEmail();
    if (!email) return {};
    const users = potionGetUsers();
    if (!users[email] || !users[email].inventory) return {};
    return users[email].inventory;
}

function potionGetCount(type) {
    const inv = potionGetInventory();
    return inv[type] || 0;
}

function potionGetTotalCount() {
    return potionGetCount('potion-x2') + potionGetCount('potion-x5');
}

function potionConsume(type) {
    const email = potionGetEmail();
    if (!email) return false;
    const users = potionGetUsers();
    if (!users[email] || !users[email].inventory) return false;
    if (!users[email].inventory[type] || users[email].inventory[type] < 1) return false;
    users[email].inventory[type] -= 1;
    potionSaveUsers(users);
    return true;
}

// --- POTION ACTIVE ---
function potionGetActive() {
    const stored = localStorage.getItem('casino_active_potion');
    if (!stored) return null;
    try {
        const potion = JSON.parse(stored);
        if (potion.expiresAt < Date.now()) {
            localStorage.removeItem('casino_active_potion');
            return null;
        }
        return potion;
    } catch (e) {
        return null;
    }
}

function potionActivate(type) {
    if (!POTION_CONFIG[type]) return false;

    if (potionGetActive()) {
        potionShowMessage("⚠️ Une potion est déjà active !");
        return false;
    }

    if (!potionConsume(type)) {
        potionShowMessage("❌ Aucune potion disponible !");
        return false;
    }

    const config = POTION_CONFIG[type];
    const potion = {
        type,
        multiplier: config.multiplier,
        expiresAt: Date.now() + config.duration,
        duration: config.duration
    };
    localStorage.setItem('casino_active_potion', JSON.stringify(potion));
    potionShowMessage(`✨ ${config.label} activée pour ${config.duration / 60000} min !`);
    potionUpdateUI();
    return true;
}

function isPotionActive() {
    return potionGetActive() !== null;
}

function getPotionMultiplier() {
    const active = potionGetActive();
    return active ? active.multiplier : 1;
}

function potionFormatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function potionShowMessage(text) {
    let msg = document.getElementById('potion-message');
    if (!msg) {
        msg = document.createElement('div');
        msg.id = 'potion-message';
        msg.className = 'potion-message';
        document.body.appendChild(msg);
    }
    msg.textContent = text;
    msg.classList.add('visible');
    clearTimeout(potionShowMessage._t);
    potionShowMessage._t = setTimeout(() => {
        msg.classList.remove('visible');
    }, 2800);
}

// --- UI ---
function potionUpdateUI() {
    const count = potionGetTotalCount();
    const active = potionGetActive();

    document.querySelectorAll('.potion-btn').forEach(btn => {
        if (active) {
            btn.classList.add('active');
            const timer = btn.querySelector('.potion-timer');
            const countEl = btn.querySelector('.potion-count');
            if (timer) timer.textContent = potionFormatTime(active.expiresAt - Date.now());
            if (countEl) countEl.style.display = 'none';
        } else {
            btn.classList.remove('active');
            const timer = btn.querySelector('.potion-timer');
            const countEl = btn.querySelector('.potion-count');
            if (timer) timer.textContent = '';
            if (countEl) {
                countEl.style.display = 'inline-flex';
                countEl.textContent = count;
            }
        }
    });

    const indicator = document.getElementById('potion-floating-indicator');
    if (indicator) {
        if (active) {
            const config = POTION_CONFIG[active.type];
            indicator.innerHTML = `${config.icon} <span class="potion-ind-mult">x${active.multiplier}</span> — <span class="potion-ind-timer">${potionFormatTime(active.expiresAt - Date.now())}</span>`;
            indicator.style.display = 'inline-flex';
        } else {
            indicator.style.display = 'none';
        }
    }

    const panel = document.getElementById('potion-panel');
    if (panel && panel.classList.contains('visible')) {
        potionRenderPanel();
    }
}

function potionRenderPanel() {
    const panel = document.getElementById('potion-panel');
    if (!panel) return;

    const active = potionGetActive();
    const countX2 = potionGetCount('potion-x2');
    const countX5 = potionGetCount('potion-x5');

    let html = '';

    if (active) {
        const config = POTION_CONFIG[active.type];
        html += `
            <div class="potion-active-info">
                <div class="potion-active-icon">${config.icon}</div>
                <div class="potion-active-text">
                    <div class="potion-active-title">${config.label} active</div>
                    <div class="potion-active-timer">Temps restant : ${potionFormatTime(active.expiresAt - Date.now())}</div>
                </div>
            </div>
        `;
    }

    html += `
        <div class="potion-item">
            <div class="potion-item-icon">🧪</div>
            <div class="potion-item-info">
                <div class="potion-item-name">Potion Chance x2</div>
                <div class="potion-item-desc">Durée : 2 minutes</div>
                <div class="potion-item-count">x${countX2}</div>
            </div>
            <button class="potion-use-btn" data-potion="potion-x2" ${countX2 < 1 || active ? 'disabled' : ''}>
                ${active ? 'BLOQUÉ' : 'UTILISER'}
            </button>
        </div>
        <div class="potion-item">
            <div class="potion-item-icon">⚗️</div>
            <div class="potion-item-info">
                <div class="potion-item-name">Potion Chance x5</div>
                <div class="potion-item-desc">Durée : 5 minutes</div>
                <div class="potion-item-count">x${countX5}</div>
            </div>
            <button class="potion-use-btn" data-potion="potion-x5" ${countX5 < 1 || active ? 'disabled' : ''}>
                ${active ? 'BLOQUÉ' : 'UTILISER'}
            </button>
        </div>
        <div class="potion-hint">💡 Une seule potion peut être active à la fois. Utilise-la avant de lancer une partie !</div>
    `;

    panel.innerHTML = html;

    panel.querySelectorAll('.potion-use-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            potionActivate(btn.dataset.potion);
        });
    });
}

function potionTogglePanel() {
    const panel = document.getElementById('potion-panel');
    if (!panel) return;
    panel.classList.toggle('visible');
    if (panel.classList.contains('visible')) {
        potionRenderPanel();
    }
}

function potionInjectLobbyUI() {
    const balanceBox = document.querySelector('.global-balance-box');
    if (!balanceBox || document.querySelector('.potion-btn')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'potion-wrapper';
    wrapper.innerHTML = `
        <button class="potion-btn" title="Mes potions">
            <span class="potion-icon">🧪</span>
            <span class="potion-count">0</span>
            <span class="potion-timer"></span>
        </button>
        <div id="potion-panel" class="potion-panel"></div>
    `;

    balanceBox.parentNode.insertBefore(wrapper, balanceBox.nextSibling);

    const btn = wrapper.querySelector('.potion-btn');
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        potionTogglePanel();
    });

    document.addEventListener('click', (e) => {
        const panel = document.getElementById('potion-panel');
        if (panel && !panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.remove('visible');
        }
    });
}

function potionInjectGameIndicator() {
    if (document.querySelector('.potion-btn')) return;
    if (document.getElementById('potion-floating-indicator')) return;

    const indicator = document.createElement('div');
    indicator.id = 'potion-floating-indicator';
    indicator.className = 'potion-floating-indicator';
    indicator.style.display = 'none';
    document.body.appendChild(indicator);
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    potionInjectLobbyUI();
    potionInjectGameIndicator();
    potionUpdateUI();

    setInterval(potionUpdateUI, 500);
});

window.addEventListener('storage', potionUpdateUI);