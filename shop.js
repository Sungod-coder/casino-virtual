// shop.js
// Boutique + Coffre avec animation de défilement style CS:GO
// + son synchronisé avec volume réduit

const SHOP_ITEMS = {
    'potion-x2':     { name: 'Potion Chance x2',       price: 1500,  unique: false },
    'potion-x5':     { name: 'Potion Chance x5',       price: 3750,  unique: false },
    'mystery-chest': { name: 'Coffre Mystère',         price: 7500,  unique: false },
    'battle-pass':   { name: 'Pass Combat Premium',    price: 12000, unique: true  }
};

const CHEST_REWARDS = [
    { type: 'tokens',       amount: 50000, chance: 0.5, label: 'MÉGA JACKPOT', color: '#ff007a', rarity: 'legendary', icon: '💎', short: '50 000 jetons' },
    { type: 'multi-ticket', min: 3, max: 5, chance: 4,  label: 'Multi-Ticket',  color: '#ff66a3', rarity: 'epic',      icon: '🎟️', short: '3-5 tickets' },
    { type: 'tokens',       amount: 10000, chance: 8,   label: 'Grosse Somme',  color: '#f1c40f', rarity: 'epic',      icon: '💰', short: '10 000 jetons' },
    { type: 'potion-pack',  chance: 8,                  label: 'Pack Potions',  color: '#9b59b6', rarity: 'rare',      icon: '🎒', short: '3x x2 + 2x x5' },
    { type: 'ticket',       amount: 2,     chance: 6,   label: '2 Tickets',     color: '#ff66a3', rarity: 'rare',      icon: '🎫', short: '2 tickets' },
    { type: 'ticket',       amount: 1,     chance: 10,  label: '1 Ticket',      color: '#ff66a3', rarity: 'uncommon',  icon: '🎫', short: '1 ticket' },
    { type: 'potion-x5',    amount: 1,     chance: 8,   label: '1 Potion x5',   color: '#ff66a3', rarity: 'uncommon',  icon: '⚗️', short: '1 potion x5' },
    { type: 'potion-x2',    amount: 2,     chance: 10,  label: '2 Potions x2',  color: '#f1c40f', rarity: 'uncommon',  icon: '🧪', short: '2 potions x2' },
    { type: 'potion-x2',    amount: 1,     chance: 15,  label: '1 Potion x2',   color: '#f1c40f', rarity: 'common',    icon: '🧪', short: '1 potion x2' },
    { type: 'tokens',       amount: 5000,  chance: 10,  label: '5 000 jetons',  color: '#2ecc71', rarity: 'rare',      icon: '🪙', short: '5 000 jetons' },
    { type: 'tokens',       amount: 2500,  chance: 20,  label: '2 500 jetons',  color: '#2ecc71', rarity: 'common',    icon: '🪙', short: '2 500 jetons' }
];

function drawChestReward() {
    const total = CHEST_REWARDS.reduce((s, r) => s + r.chance, 0);
    let r = Math.random() * total;
    for (const reward of CHEST_REWARDS) {
        r -= reward.chance;
        if (r <= 0) return reward;
    }
    return CHEST_REWARDS[CHEST_REWARDS.length - 1];
}

// ============================================================
//   COURBE CUBIC-BEZIER (identique au CSS)
// ============================================================
function bezierCalc(t, p1, p2) {
    const mt = 1 - t;
    return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
}
function bezierDeriv(t, p1, p2) {
    const mt = 1 - t;
    return 3 * mt * mt * p1 + 6 * mt * t * (p2 - p1) + 3 * t * t * (1 - p2);
}
function cubicBezierY(x, p1x, p1y, p2x, p2y) {
    let t = x;
    for (let i = 0; i < 8; i++) {
        const xEst = bezierCalc(t, p1x, p2x);
        const dx = xEst - x;
        if (Math.abs(dx) < 0.001) break;
        const d = bezierDeriv(t, p1x, p2x);
        if (Math.abs(d) < 0.0001) break;
        t -= dx / d;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
    }
    return bezierCalc(t, p1y, p2y);
}

// ============================================================
//   ACCÈS DONNÉES
// ============================================================
function shopGetUsers() { return JSON.parse(localStorage.getItem('casino_users')) || {}; }
function shopSaveUsers(users) { localStorage.setItem('casino_users', JSON.stringify(users)); }
function shopGetEmail() { return localStorage.getItem('casino_logged_email'); }

function shopGetBalance() {
    const email = shopGetEmail();
    if (!email) return 0;
    const users = shopGetUsers();
    return (users[email] && typeof users[email].balance === 'number') ? users[email].balance : 0;
}
function shopSetBalance(newAmount) {
    const email = shopGetEmail();
    if (!email) return;
    const users = shopGetUsers();
    if (users[email]) {
        users[email].balance = newAmount;
        shopSaveUsers(users);
        localStorage.setItem('casinoBalance', newAmount.toString());
        if (typeof updateDisplayBalance === 'function') updateDisplayBalance();
        shopUpdateUI();
    }
}
function shopGetInventory() {
    const email = shopGetEmail();
    if (!email) return {};
    const users = shopGetUsers();
    if (users[email]) {
        if (!users[email].inventory) {
            users[email].inventory = {};
            shopSaveUsers(users);
        }
        return users[email].inventory;
    }
    return {};
}
function shopSetInventoryItem(itemKey, value) {
    const email = shopGetEmail();
    if (!email) return;
    const users = shopGetUsers();
    if (users[email]) {
        if (!users[email].inventory) users[email].inventory = {};
        users[email].inventory[itemKey] = value;
        shopSaveUsers(users);
    }
}

// ============================================================
//   MESSAGE
// ============================================================
function shopShowMessage(text, type = 'success') {
    const msg = document.getElementById('shop-message');
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'shop-message ' + type;
    clearTimeout(shopShowMessage._t);
    shopShowMessage._t = setTimeout(() => {
        msg.textContent = '';
        msg.className = 'shop-message';
    }, 3000);
}

// ============================================================
//   OUVERTURE DU COFFRE — Animation CS:GO
// ============================================================
function openChest() {
    const winner = drawChestReward();

    const TOTAL_ITEMS = 55;
    const WINNER_INDEX = 50;

    const strip = [];
    for (let i = 0; i < TOTAL_ITEMS; i++) {
        if (i === WINNER_INDEX) strip.push(winner);
        else strip.push(CHEST_REWARDS[Math.floor(Math.random() * CHEST_REWARDS.length)]);
    }

    const overlay = document.getElementById('chest-overlay');
    overlay.classList.add('visible');

    const roller = document.getElementById('chest-roller');
    const resultBox = document.getElementById('chest-result');
    const resultTitle = document.getElementById('chest-result-title');
    const resultText = document.getElementById('chest-result-text');
    const continueBtn = document.getElementById('chest-continue-btn');
    const shine = document.getElementById('chest-shine');

    resultBox.classList.remove('visible');
    continueBtn.classList.remove('visible');
    shine.classList.remove('active');

    roller.innerHTML = '';
    strip.forEach((reward) => {
        const item = document.createElement('div');
        item.className = 'chest-roll-item ' + reward.rarity;
        item.innerHTML = `
            <div class="chest-roll-icon">${reward.icon}</div>
            <div class="chest-roll-label">${reward.short}</div>
        `;
        roller.appendChild(item);
    });

    roller.style.transition = 'none';
    roller.style.transform = 'translateX(0px)';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const wrapWidth = roller.parentElement.offsetWidth;
            const firstItem = roller.querySelector('.chest-roll-item');
            if (!firstItem) return;

            const itemWidth = firstItem.offsetWidth;
            const gap = 15;
            const paddingLeft = 40;
            const stepWidth = itemWidth + gap;

            const centerX = wrapWidth / 2;
            const winnerCenter = paddingLeft + WINNER_INDEX * stepWidth + itemWidth / 2;
            const randomOffset = (Math.random() - 0.5) * (itemWidth * 0.35);
            const targetX = centerX - winnerCenter + randomOffset;

            const duration = 6000;
            const bezier = [0.15, 0.65, 0.25, 1];

            roller.style.transition = `transform ${duration}ms cubic-bezier(${bezier.join(', ')})`;
            roller.style.transform = `translateX(${targetX}px)`;

            if (typeof playChestSpinSound === 'function') {
                try { playChestSpinSound(); } catch (e) {}
                if (typeof chestSpinSound !== 'undefined' && chestSpinSound) {
                    chestSpinSound.volume = 0.15;
                }
            }

            const startTime = performance.now();
            const startRate = 1.6;
            const endRate = 0.35;

            function syncSoundRate(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = cubicBezierY(progress, bezier[0], bezier[1], bezier[2], bezier[3]);
                const easedPower = Math.pow(eased, 2.2);
                const rate = startRate - (startRate - endRate) * easedPower;
                if (typeof setChestSpinRate === 'function') {
                    setChestSpinRate(rate);
                }
                if (progress < 1) {
                    requestAnimationFrame(syncSoundRate);
                }
            }
            requestAnimationFrame(syncSoundRate);

            setTimeout(() => {
                if (typeof stopChestSpinSound === 'function') {
                    try { stopChestSpinSound(); } catch (e) {}
                }

                shine.classList.add('active');

                const items = roller.querySelectorAll('.chest-roll-item');
                if (items[WINNER_INDEX]) items[WINNER_INDEX].classList.add('winner');

                applyChestReward(winner);

                let titleText = 'FÉLICITATIONS !';
                let titleColor = '#f1c40f';
                if (winner.rarity === 'legendary') { titleText = '🎉 LÉGENDAIRE ! 🎉'; titleColor = '#ff007a'; }
                else if (winner.rarity === 'epic') { titleText = '✨ ÉPIQUE !'; titleColor = '#9b59b6'; }
                else if (winner.rarity === 'rare') { titleText = '⭐ RARE !'; titleColor = '#3498db'; }

                resultTitle.textContent = titleText;
                resultTitle.style.color = titleColor;
                resultText.innerHTML = getRewardText(winner);

                resultBox.classList.add('visible');
                continueBtn.classList.add('visible');

                if (typeof playSlotWinSound === 'function') {
                    try { playSlotWinSound(); } catch (e) {}
                }
                if ((winner.rarity === 'legendary' || winner.rarity === 'epic') && typeof playDiamondSound === 'function') {
                    setTimeout(() => { try { playDiamondSound(); } catch (e) {} }, 400);
                }
            }, duration);
        });
    });
}

function getRewardText(reward) {
    if (reward.type === 'tokens') return `<strong style="color:${reward.color}">${reward.amount.toLocaleString()} jetons <span class="coin small">M</span></strong>`;
    if (reward.type === 'ticket') return `<strong style="color:${reward.color}">${reward.amount} Ticket${reward.amount > 1 ? 's' : ''} de Tirage</strong>`;
    if (reward.type === 'multi-ticket') return `<strong style="color:${reward.color}">Tickets de Tirage (voir ci-dessus)</strong>`;
    if (reward.type === 'potion-x2') return `<strong style="color:${reward.color}">${reward.amount}x Potions Chance x2</strong>`;
    if (reward.type === 'potion-x5') return `<strong style="color:${reward.color}">${reward.amount}x Potions Chance x5</strong>`;
    if (reward.type === 'potion-pack') return `<strong style="color:${reward.color}">3x Potions x2 + 2x Potions x5</strong>`;
    return '';
}

function applyChestReward(reward) {
    const email = shopGetEmail();
    if (!email) return;
    const users = shopGetUsers();
    const u = users[email];

    if (reward.type === 'tokens') {
        u.balance = (u.balance || 0) + reward.amount;
        localStorage.setItem('casinoBalance', u.balance.toString());
    } else if (reward.type === 'ticket') {
        u.tickets = (u.tickets || 0) + reward.amount;
    } else if (reward.type === 'multi-ticket') {
        const n = Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
        u.tickets = (u.tickets || 0) + n;
    } else if (reward.type === 'potion-x2' || reward.type === 'potion-x5') {
        if (!u.inventory) u.inventory = {};
        u.inventory[reward.type] = (u.inventory[reward.type] || 0) + reward.amount;
    } else if (reward.type === 'potion-pack') {
        if (!u.inventory) u.inventory = {};
        u.inventory['potion-x2'] = (u.inventory['potion-x2'] || 0) + 3;
        u.inventory['potion-x5'] = (u.inventory['potion-x5'] || 0) + 2;
    }

    shopSaveUsers(users);
    if (typeof updateDisplayBalance === 'function') updateDisplayBalance();
    if (typeof refreshBPTicketsUI === 'function') refreshBPTicketsUI();
    if (typeof potionUpdateUI === 'function') potionUpdateUI();
}

function closeChestOverlay() {
    const overlay = document.getElementById('chest-overlay');
    if (overlay) overlay.classList.remove('visible');
}

// ============================================================
//   ACHAT
// ============================================================
function shopBuy(itemKey) {
    const item = SHOP_ITEMS[itemKey];
    if (!item) return;

    const email = shopGetEmail();
    if (!email) {
        shopShowMessage("❌ Vous devez être connecté pour acheter !", "error");
        return;
    }

    const inventory = shopGetInventory();
    if (item.unique && inventory[itemKey]) {
        shopShowMessage("✅ Vous possédez déjà cet objet !", "success");
        return;
    }

    const balance = shopGetBalance();
    if (balance < item.price) {
        shopShowMessage(`❌ Solde insuffisant ! Il vous manque ${item.price - balance} jetons.`, "error");
        return;
    }

    shopSetBalance(balance - item.price);

    if (itemKey === 'mystery-chest') {
        openChest();
        shopShowMessage(`🎁 Coffre ouvert !`, "success");
    } else if (item.unique) {
        shopSetInventoryItem(itemKey, true);
        shopShowMessage(`🎉 Achat réussi : ${item.name} !`, "success");
    } else {
        shopSetInventoryItem(itemKey, (inventory[itemKey] || 0) + 1);
        shopShowMessage(`🎉 Achat réussi : ${item.name} !`, "success");
    }

    shopUpdateUI();
}

// ============================================================
//   UI
// ============================================================
function shopUpdateUI() {
    const balance = shopGetBalance();
    const inventory = shopGetInventory();

    document.querySelectorAll('.shop-btn').forEach(btn => {
        const key = btn.dataset.item;
        const item = SHOP_ITEMS[key];
        if (!item) return;

        if (item.unique && inventory[key]) {
            btn.disabled = true;
            btn.textContent = '✅ DÉJÀ POSSÉDÉ';
            btn.classList.add('owned');
            return;
        }

        btn.disabled = balance < item.price;
        if (key === 'mystery-chest') btn.textContent = 'OUVRIR';
        else btn.textContent = 'ACHETER';
        btn.classList.remove('owned');
    });
}

// ============================================================
//   INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.shop-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            shopBuy(btn.dataset.item);
        });
    });

    shopUpdateUI();
});

window.addEventListener('storage', shopUpdateUI);
setInterval(shopUpdateUI, 500);
