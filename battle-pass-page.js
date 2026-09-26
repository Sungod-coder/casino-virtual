// battle-pass-page.js

let bpHasAutoScrolled = false;

function renderBattlePass() {
    const data = bpGetData();
    if (!data) {
        document.getElementById('bp-grid').innerHTML = '<p style="color:#888;text-align:center;padding:40px;">Connectez-vous pour voir le Pass.</p>';
        return;
    }

    const scrollContainer = document.querySelector('.bp-scroll-container');
    const savedScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;

    const currentLevel = bpGetLevel(data.bp.xp);
    const currentXP = data.bp.xp;

    document.getElementById('bp-current-level').textContent = currentLevel;
    document.getElementById('bp-current-xp').textContent = currentXP;
    document.getElementById('bp-days-remaining').textContent = data.daysRemaining;
    document.getElementById('bp-balance-val').innerHTML = `${getBalanceFromUsers()} <span class="coin">M</span>`;
    document.getElementById('bp-tickets-val').textContent = data.tickets;
    document.getElementById('bp-premium-status').textContent = data.hasPremium ? '👑 Pass Premium Actif' : 'Pass Gratuit';
    document.getElementById('bp-premium-status').classList.toggle('premium-active', data.hasPremium);

    const currentThreshold = BP_XP_THRESHOLDS[currentLevel - 1] || 0;
    const nextThreshold = BP_XP_THRESHOLDS[currentLevel] || null;
    const fill = document.getElementById('bp-progress-fill');
    const xpToNext = document.getElementById('bp-xp-to-next');

    if (nextThreshold === null) {
        fill.style.width = '100%';
        xpToNext.textContent = '⭐ PASS TERMINÉ !';
    } else {
        const xpInLevel = currentXP - currentThreshold;
        const xpNeeded = nextThreshold - currentThreshold;
        const percent = (xpInLevel / xpNeeded) * 100;
        fill.style.width = percent + '%';
        xpToNext.textContent = `${xpNeeded - xpInLevel} XP pour le niveau ${currentLevel + 1}`;
    }

    // 🎁 Bouton Tout Réclamer
    if (typeof bpUpdateClaimAllButton === 'function') bpUpdateClaimAllButton();

    // Grille
    const grid = document.getElementById('bp-grid');
    grid.innerHTML = '';

    BP_REWARDS.forEach(reward => {
        const level = reward.level;
        const isUnlocked = level <= currentLevel;
        const isCurrent = level === currentLevel;
        const freeClaimed = data.bp.claimedFree.includes(level);
        const premiumClaimed = data.bp.claimedPremium.includes(level);
        const premiumOwned = data.hasPremium;

        const column = document.createElement('div');
        column.className = 'bp-column' + (isUnlocked ? ' unlocked' : '') + (isCurrent ? ' current' : '');

        const premiumCard = document.createElement('div');
        premiumCard.className = 'bp-slot premium-slot';
        if (!premiumOwned) premiumCard.classList.add('locked');
        if (premiumClaimed) premiumCard.classList.add('claimed');
        else if (isUnlocked && premiumOwned) premiumCard.classList.add('claimable');

        premiumCard.innerHTML = `
            <div class="bp-slot-content">
                ${!premiumOwned ? '<div class="bp-slot-lock">🔒</div>' : ''}
                ${premiumClaimed ? '<div class="bp-slot-check">✓</div>' : ''}
                <div class="bp-slot-icon">${getRewardIcon(reward.premium)}</div>
                <div class="bp-slot-text">${getRewardText(reward.premium)}</div>
            </div>
        `;

        if (isUnlocked && premiumOwned && !premiumClaimed) {
            premiumCard.addEventListener('click', () => claimLevel(level, 'premium'));
        }

        const freeCard = document.createElement('div');
        freeCard.className = 'bp-slot free-slot';
        if (freeClaimed) freeCard.classList.add('claimed');
        else if (isUnlocked) freeCard.classList.add('claimable');

        freeCard.innerHTML = `
            <div class="bp-slot-content">
                ${freeClaimed ? '<div class="bp-slot-check">✓</div>' : ''}
                <div class="bp-slot-icon">${getRewardIcon(reward.free)}</div>
                <div class="bp-slot-text">${getRewardText(reward.free)}</div>
            </div>
        `;

        if (isUnlocked && !freeClaimed) {
            freeCard.addEventListener('click', () => claimLevel(level, 'free'));
        }

        const levelNumber = document.createElement('div');
        levelNumber.className = 'bp-column-level';
        levelNumber.textContent = level;

        column.appendChild(premiumCard);
        column.appendChild(levelNumber);
        column.appendChild(freeCard);

        grid.appendChild(column);
    });

    setTimeout(() => {
        if (!bpHasAutoScrolled) {
            bpHasAutoScrolled = true;
            const current = document.querySelector('.bp-column.current');
            if (current) {
                current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        } else if (scrollContainer) {
            scrollContainer.scrollLeft = savedScrollLeft;
        }
    }, 50);
}

function claimLevel(level, type) {
    const res = bpClaimReward(level, type);
    if (res.ok) {
        showBPMessage('✅ Récompense réclamée !', 'success');
        renderBattlePass();
    } else {
        showBPMessage('❌ ' + res.msg, 'error');
    }
}

function getRewardIcon(reward) {
    if (reward.type === 'tokens') return '';
    if (reward.type === 'ticket') return '🎫';
    if (reward.type === 'potion-x2') return '🧪';
    if (reward.type === 'potion-x5') return '⚗️';
    return '?';
}

function getRewardText(reward) {
    if (reward.type === 'tokens') {
        return `${reward.amount} <span class="coin small">M</span>`;
    }
    return `x${reward.amount}`;
}

function getBalanceFromUsers() {
    const email = localStorage.getItem('casino_logged_email');
    if (!email) return 0;
    const users = JSON.parse(localStorage.getItem('casino_users')) || {};
    return (users[email] && users[email].balance) || 0;
}

function showBPMessage(text, type) {
    let msg = document.getElementById('bp-message');
    if (!msg) {
        msg = document.createElement('div');
        msg.id = 'bp-message';
        msg.className = 'bp-message';
        document.querySelector('.bp-container').appendChild(msg);
    }
    msg.textContent = text;
    msg.className = 'bp-message ' + type;
    setTimeout(() => { msg.textContent = ''; msg.className = 'bp-message'; }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
    bpHasAutoScrolled = false;
    renderBattlePass();
    window.addEventListener('storage', renderBattlePass);

    // 🧪 DEBUG : vérifier que la fonction existe
    console.log('=== DEBUG BATTLE PASS ===');
    console.log('bpClaimAllRewards existe ?', typeof bpClaimAllRewards);
    console.log('bpGetAvailableRewards existe ?', typeof bpGetAvailableRewards);
    console.log('Bouton trouvé ?', !!document.getElementById('bp-claim-all-btn'));
    console.log('=========================');
});
