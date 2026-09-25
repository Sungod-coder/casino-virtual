// rank.js
// Système de rangs style League of Legends

const RANKS = [
    { name: 'Fer',          xp: 0,       color: '#95a5a6', color2: '#4a5a5c', color3: '#95a5a6', glow: '#7f8c8d' },
    { name: 'Bronze',       xp: 5000,    color: '#cd7f32', color2: '#8b5a2b', color3: '#cd7f32', glow: '#e67e22' },
    { name: 'Argent',       xp: 15000,   color: '#ecf0f1', color2: '#95a5a6', color3: '#ecf0f1', glow: '#bdc3c7' },
    { name: 'Or',           xp: 30000,   color: '#f1c40f', color2: '#d35400', color3: '#f1c40f', glow: '#ffd700' },
    { name: 'Platine',      xp: 50000,   color: '#1abc9c', color2: '#0e6655', color3: '#1abc9c', glow: '#16a085' },
    { name: 'Diamant',      xp: 80000,   color: '#3498db', color2: '#1f618d', color3: '#3498db', glow: '#2980b9' },
    { name: 'Maître',       xp: 120000,  color: '#9b59b6', color2: '#6c3483', color3: '#9b59b6', glow: '#8e44ad' },
    { name: 'Grand Maître', xp: 180000,  color: '#e74c3c', color2: '#922b21', color3: '#e74c3c', glow: '#ff4757' },
    { name: 'Onix',         xp: 250000,  color: '#e74c3c', color2: '#6c3483', color3: '#f1c40f', glow: '#ffcc00' }
];

function rankGetUsers() { return JSON.parse(localStorage.getItem('casino_users')) || {}; }
function rankSaveUsers(users) { localStorage.setItem('casino_users', JSON.stringify(users)); }
function rankGetEmail() { return localStorage.getItem('casino_logged_email'); }

function getRankXP() {
    const email = rankGetEmail();
    if (!email) return 0;
    const users = rankGetUsers();
    if (!users[email]) return 0;
    if (typeof users[email].rankXP !== 'number') {
        users[email].rankXP = 0;
        rankSaveUsers(users);
    }
    return users[email].rankXP;
}

function getCurrentRankIndex(xp) {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) {
        if (xp >= RANKS[i].xp) idx = i;
        else break;
    }
    return idx;
}

function getNextRank(currentIndex) {
    if (currentIndex >= RANKS.length - 1) return null;
    return RANKS[currentIndex + 1];
}

// ============================================
//   POPUP DE RANK UP — affichée DEVANT TOUT
// ============================================
function showRankUpPopup(rank) {
    // ---- 1. Crée/réutilise l'overlay ----
    let overlay = document.getElementById('rankup-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'rankup-overlay';
        overlay.className = 'rankup-overlay';
        document.body.appendChild(overlay);
    }
    overlay.classList.remove('visible');
    void overlay.offsetWidth;
    overlay.classList.add('visible');

    // ---- 2. Crée la popup ----
    const popup = document.createElement('div');
    popup.className = 'rankup-popup';
    popup.innerHTML = `
        <div class="rankup-icon">
            <div class="rank-emblem large" style="--c1: ${rank.color}; --c2: ${rank.color2}; --c3: ${rank.color3 || rank.color2}; --glow: ${rank.glow};"></div>
        </div>
        <div class="rankup-title">NOUVEAU RANG !</div>
        <div class="rankup-name" style="color: ${rank.glow}">${rank.name}</div>
    `;
    document.body.appendChild(popup);

    // Force le navigateur à peindre l'état initial avant la transition
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            popup.classList.add('show');
        });
    });

    // ---- 3. Son ----
    if (typeof playDiamondSound === 'function') {
        try { playDiamondSound(); } catch (e) {}
    }

    // ---- 4. Fade out propre ----
    setTimeout(() => {
        popup.classList.add('fade-out');
        overlay.classList.remove('visible');
        setTimeout(() => {
            popup.remove();
            overlay.remove();
        }, 500);
    }, 3000);
}

// ============================================
//   BOUTON DE RANG (top-bar)
// ============================================
function updateRankButton() {
    const btn = document.getElementById('rank-btn');
    if (!btn) return;
    const xp = getRankXP();
    const idx = getCurrentRankIndex(xp);
    const rank = RANKS[idx];

    btn.style.setProperty('--rank-color', rank.color);
    btn.style.setProperty('--rank-color2', rank.color2);
    btn.style.setProperty('--rank-glow', rank.glow);

    btn.innerHTML = `<div class="rank-emblem mini" style="--c1: ${rank.color}; --c2: ${rank.color2}; --c3: ${rank.color3 || rank.color2}; --glow: ${rank.glow};"></div>`;
}

function openRankModal() {
    const modal = document.getElementById('rank-modal');
    if (modal) {
        modal.classList.add('visible');
        renderRankModal();
    }
}

function closeRankModal() {
    const modal = document.getElementById('rank-modal');
    if (modal) modal.classList.remove('visible');
}

function renderRankModal() {
    const content = document.getElementById('rank-modal-content');
    if (!content) return;

    const xp = getRankXP();
    const currentIdx = getCurrentRankIndex(xp);
    const currentRank = RANKS[currentIdx];
    const nextRank = getNextRank(currentIdx);

    let progress = 0;
    let xpInRank = 0;
    let xpNeeded = 0;

    if (nextRank) {
        xpInRank = xp - currentRank.xp;
        xpNeeded = nextRank.xp - currentRank.xp;
        progress = Math.min(100, (xpInRank / xpNeeded) * 100);
    } else {
        progress = 100;
    }

    content.innerHTML = `
        <div class="rank-current-section">
            <div class="rank-current-emblem">
                <div class="rank-emblem large" style="--c1: ${currentRank.color}; --c2: ${currentRank.color2}; --c3: ${currentRank.color3 || currentRank.color2}; --glow: ${currentRank.glow};"></div>
            </div>
            <div class="rank-current-info">
                <div class="rank-current-name" style="color: ${currentRank.glow}">${currentRank.name}</div>
                <div class="rank-current-xp">${xp.toLocaleString()} XP</div>
            </div>
        </div>

        <div class="rank-progress-section">
            <div class="rank-progress-header">
                <span>Progression vers ${nextRank ? nextRank.name : 'MAX'}</span>
                <span>${nextRank ? `${xpInRank.toLocaleString()} / ${xpNeeded.toLocaleString()} XP` : 'RANG MAX'}</span>
            </div>
            <div class="rank-progress-bar">
                <div class="rank-progress-fill" style="width: ${progress}%; background: linear-gradient(90deg, ${currentRank.color}, ${nextRank ? nextRank.color : currentRank.color});"></div>
            </div>
            ${nextRank ? `<div class="rank-progress-next">Encore <strong>${(xpNeeded - xpInRank).toLocaleString()} XP</strong> pour atteindre ${nextRank.name}</div>` : ''}
        </div>

        <div class="rank-list-title">TOUS LES RANGS</div>
        <div class="rank-list">
            ${RANKS.map((r, i) => {
                const isCurrent = i === currentIdx;
                const isUnlocked = i <= currentIdx;
                const lockedClass = isUnlocked ? '' : 'locked';
                const currentClass = isCurrent ? 'current' : '';
                return `
                    <div class="rank-item ${lockedClass} ${currentClass}">
                        <div class="rank-item-emblem">
                            <div class="rank-emblem small" style="--c1: ${r.color}; --c2: ${r.color2}; --c3: ${r.color3 || r.color2}; --glow: ${r.glow};"></div>
                        </div>
                        <div class="rank-item-info">
                            <div class="rank-item-name" style="${isUnlocked ? `color: ${r.glow}` : ''}">${r.name}</div>
                            <div class="rank-item-xp">${r.xp.toLocaleString()} XP</div>
                        </div>
                        ${isCurrent ? '<div class="rank-item-badge">ACTUEL</div>' : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('rank-modal');
    if (modal && e.target === modal) closeRankModal();
});

document.addEventListener('DOMContentLoaded', () => {
    updateRankButton();
    setInterval(updateRankButton, 1000);
});