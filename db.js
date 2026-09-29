// db.js
// Sync Firebase Firestore ↔ localStorage avec refresh UI automatique

let __dbSyncReady = false;
let __dbCurrentUser = null;
let __dbUnsubscribe = null;

function dbIsReady() { return __dbSyncReady && __dbCurrentUser !== null; }

// ============================================
//   REFRESH UI après sync Firebase
// ============================================
function dbRefreshAllUI() {
    console.log('🔄 Refresh de l\'UI après sync Firebase...');

    if (typeof updateDisplayBalance === 'function') {
        try { updateDisplayBalance(); } catch (e) {}
    }
    if (typeof renderBattlePass === 'function') {
        try { renderBattlePass(); } catch (e) {}
    }
    if (typeof refreshBPTicketsUI === 'function') {
        try { refreshBPTicketsUI(); } catch (e) {}
    }
    if (typeof potionUpdateUI === 'function') {
        try { potionUpdateUI(); } catch (e) {}
    }
    if (typeof renderWeeklyRewards === 'function') {
        try { renderWeeklyRewards(); } catch (e) {}
    }
    if (typeof updateRankButton === 'function') {
        try { updateRankButton(); } catch (e) {}
    }
    if (typeof shopUpdateUI === 'function') {
        try { shopUpdateUI(); } catch (e) {}
    }

    // Refresh aussi les solde des jeux (si on est sur une page de jeu)
    const balanceEl = document.getElementById('balance-val');
    if (balanceEl) {
        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const email = localStorage.getItem('casino_logged_email');
        if (users[email] && typeof users[email].balance === 'number') {
            const coinHtml = '<span class="coin">M</span>';
            balanceEl.innerHTML = `${users[email].balance} ${coinHtml}`;
        }
    }
}

// ============================================
//   CHARGER Firestore → localStorage
// ============================================
async function dbLoadUserToLocal(uid) {
    if (!fbDb) return null;
    try {
        const doc = await fbDb.collection('users').doc(uid).get();
        if (!doc.exists) {
            console.log('📭 Nouvel utilisateur');
            return null;
        }

        const data = doc.data();
        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const email = data.email;

        // ⚠️ IMPORTANT : on écrase avec les données Firestore
        users[email] = {
            password: '__FIREBASE__',
            pseudo: data.pseudo || null,
            balance: typeof data.balance === 'number' ? data.balance : 1000,
            tickets: typeof data.tickets === 'number' ? data.tickets : 0,
            inventory: data.inventory || {},
            bp: data.bp || { xp: 0, claimedFree: [], claimedPremium: [], season: 1 },
            weekly: data.weekly || { weekStartDate: Date.now(), lastClaimTime: null, claimed: [] },
            rankXP: typeof data.rankXP === 'number' ? data.rankXP : 0
        };

        localStorage.setItem('casino_users', JSON.stringify(users));
        localStorage.setItem('casino_logged_email', email);
        localStorage.setItem('casinoBalance', users[email].balance.toString());

        console.log('✅ Données Firestore appliquées');
        return email;
    } catch (e) {
        console.error('❌ Erreur dbLoadUserToLocal :', e);
        return null;
    }
}

// ============================================
//   SAUVEGARDER localStorage → Firestore
// ============================================
async function dbSaveUserToCloud() {
    if (!fbDb || !__dbCurrentUser) return;
    const email = localStorage.getItem('casino_logged_email');
    if (!email) return;

    const users = JSON.parse(localStorage.getItem('casino_users')) || {};
    const u = users[email];
    if (!u) return;

    try {
        await fbDb.collection('users').doc(__dbCurrentUser.uid).set({
            email: email,
            pseudo: u.pseudo || null,
            balance: u.balance || 0,
            tickets: u.tickets || 0,
            inventory: u.inventory || {},
            bp: u.bp || { xp: 0, claimedFree: [], claimedPremium: [], season: 1 },
            weekly: u.weekly || { weekStartDate: Date.now(), lastClaimTime: null, claimed: [] },
            rankXP: u.rankXP || 0,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('☁️ Sauvegardé dans Firestore');
    } catch (e) {
        console.error('❌ Erreur dbSaveUserToCloud :', e);
    }
}

// ============================================
//   DÉMARRAGE de la sync
// ============================================
async function dbStartSync(user) {
    __dbCurrentUser = user;
    console.log('🔄 Sync pour :', user.email);

    // 1. Charger Firestore → localStorage
    const email = await dbLoadUserToLocal(user.uid);
    if (!email) {
        // Nouveau compte : on crée le doc
        await dbSaveUserToCloud();
    }

    // 2. 🔥 Refresh l'UI avec les vraies données
    dbRefreshAllUI();

    // 3. Écouter les changements Firestore en temps réel
    if (__dbUnsubscribe) __dbUnsubscribe();
    __dbUnsubscribe = fbDb.collection('users').doc(user.uid).onSnapshot((doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const email = data.email || user.email;
        if (!users[email]) return;

        // 🔥 Vérifie si les données ont vraiment changé
        const localBalance = users[email].balance || 0;
        const firestoreBalance = typeof data.balance === 'number' ? data.balance : localBalance;

        users[email].balance = firestoreBalance;
        users[email].tickets = typeof data.tickets === 'number' ? data.tickets : users[email].tickets;
        users[email].inventory = data.inventory || users[email].inventory;
        users[email].bp = data.bp || users[email].bp;
        users[email].weekly = data.weekly || users[email].weekly;
        users[email].rankXP = typeof data.rankXP === 'number' ? data.rankXP : users[email].rankXP;
        users[email].pseudo = data.pseudo || users[email].pseudo;

        localStorage.setItem('casino_users', JSON.stringify(users));
        localStorage.setItem('casinoBalance', (users[email].balance || 0).toString());

        // 🔥 Refresh l'UI si le solde a changé
        if (localBalance !== firestoreBalance) {
            console.log('🔄 Solde mis à jour depuis Firestore :', firestoreBalance);
            dbRefreshAllUI();
        }
    });

    __dbSyncReady = true;
    console.log('✅ Synchronisation active');
}

// ============================================
//   AUTO-SYNC avec DEBOUNCE
// ============================================
let __dbSaveTimeout = null;
function dbScheduleSave() {
    if (!__dbSyncReady) return;
    clearTimeout(__dbSaveTimeout);
    __dbSaveTimeout = setTimeout(() => {
        dbSaveUserToCloud();
    }, 800);
}

// Intercepte localStorage.setItem
(function() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);
        if (key === 'casino_users' || key === 'casinoBalance') {
            dbScheduleSave();
        }
    };
})();

// 🔥 Force la sauvegarde quand on quitte la page
window.addEventListener('beforeunload', () => {
    if (__dbSyncReady && __dbCurrentUser) {
        // Save synchrone (best effort)
        try {
            const email = localStorage.getItem('casino_logged_email');
            const users = JSON.parse(localStorage.getItem('casino_users')) || {};
            const u = users[email];
            if (u) {
                fbDb.collection('users').doc(__dbCurrentUser.uid).set({
                    balance: u.balance || 0,
                    tickets: u.tickets || 0,
                    inventory: u.inventory || {},
                    bp: u.bp || {},
                    weekly: u.weekly || {},
                    rankXP: u.rankXP || 0
                }, { merge: true });
            }
        } catch (e) {}
    }
});

// ============================================
//   STOP
// ============================================
function dbStopSync() {
    if (__dbUnsubscribe) {
        __dbUnsubscribe();
        __dbUnsubscribe = null;
    }
    __dbCurrentUser = null;
    __dbSyncReady = false;
    console.log('🛑 Sync arrêtée');
}
