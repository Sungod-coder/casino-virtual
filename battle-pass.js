function bpClaimAllRewards() {
    alert('🔍 Début de bpClaimAllRewards');

    const data = bpGetData();
    alert('🔍 data = ' + (data ? 'OK' : 'NULL'));

    if (!data) {
        alert('❌ Pas de data (non connecté ?)');
        return;
    }

    alert('🔍 Niveau actuel : ' + bpGetLevel(data.bp.xp));
    alert('🔍 Récompenses gratuites réclamées : ' + JSON.stringify(data.bp.claimedFree));
    alert('🔍 Récompenses premium réclamées : ' + JSON.stringify(data.bp.claimedPremium));
    alert('🔍 Pass Premium : ' + data.hasPremium);

    const available = bpGetAvailableRewards();
    alert('🔍 Disponibles - Gratuit : ' + available.free.length + ' | Premium : ' + available.premium.length);

    const total = available.free.length + available.premium.length;

    if (total === 0) {
        alert('ℹ️ Aucune récompense à réclamer');
        return;
    }

    const email = bpGetEmail();
    const users = bpGetUsers();
    if (!users[email]) {
        alert('❌ Utilisateur introuvable');
        return;
    }

    const u = users[email];
    if (!u.bp) u.bp = { xp: 0, claimedFree: [], claimedPremium: [] };

    let tokensGained = 0;
    let ticketsGained = 0;
    let potionsX2 = 0;
    let potionsX5 = 0;

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
        } else if (r.type === 'potion-x2') {
            if (!u.inventory) u.inventory = {};
            u.inventory['potion-x2'] = (u.inventory['potion-x2'] || 0) + r.amount;
            potionsX2 += r.amount;
        } else if (r.type === 'potion-x5') {
            if (!u.inventory) u.inventory = {};
            u.inventory['potion-x5'] = (u.inventory['potion-x5'] || 0) + r.amount;
            potionsX5 += r.amount;
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
        } else if (r.type === 'potion-x2') {
            if (!u.inventory) u.inventory = {};
            u.inventory['potion-x2'] = (u.inventory['potion-x2'] || 0) + r.amount;
            potionsX2 += r.amount;
        } else if (r.type === 'potion-x5') {
            if (!u.inventory) u.inventory = {};
            u.inventory['potion-x5'] = (u.inventory['potion-x5'] || 0) + r.amount;
            potionsX5 += r.amount;
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
    if (potionsX5 > 0) parts.push(`${potionsX5} potion(s) x5`);

    alert('🎉 SUCCÈS !\n\n' + total + ' récompense(s) réclamée(s) :\n' + parts.join('\n'));
}
