// db.js
// Sync SIMPLE et FIABLE : local → Firestore (pas de temps réel)

let __dbSyncReady = false;
let __dbCurrentUser = null;
let __dbSaveTimeout = null;

function dbIsReady() { return __dbSyncReady && __dbCurrentUser !== null; }

// ============================================
//   REFRESH UI
// ============================================
function dbRefreshAllUI() {
    if (typeof updateDisplayBalance === 'function') { try { updateDisplayBalance(); } catch (e) {} }
    if (typeof renderBattlePass === 'function') { try { renderBattlePass(); } catch (e) {} }
    if (typeof refreshBPTicketsUI === 'function') { try { refreshBPTicketsUI(); } catch (e) {} }
    if (typeof potionUpdateUI === 'function') { try { potionUpdateUI(); } catch (e) {} }
    if (typeof renderWeeklyRewards === 'function') { try { renderWeeklyRewards(); } catch (e) {} }
    if (typeof updateRankButton === 'function') { try { updateRankButton(); } catch (e) {} }
    if (typeof shopUpdateUI === 'function') { try { shopUpdateUI(); } catch (e) {} }

    // 🔄 Met à jour l'affichage du solde dans les jeux
    const balanceEl = document.getElementById('balance-val');
    if (balanceEl) {
        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const email = localStorage.getItem('casino_logged_email');
        if (users[email] && typeof users[email].balance === 'number') {
            balanceEl.innerHTML = `${users[email].balance} <span class="coin">M</span>`;
        }
    }
}

// ============================================
//   CHARGER Firestore → localStorage (au démarrage uniquement)
// ============================================
async function dbLoadUserToLocal(uid) {
    if (!fbDb) return null;
    try {
        const doc = await fbDb.collection('users').doc(uid).get();
        if (!doc.exists) return null;

        const data = doc.data();
        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const email = data.email;
        if (!email) return null;

        // On charge les données Firestore dans localStorage
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

        console.log('✅ Firestore → localStorage OK (balance:', users[email].balance, ')');
        return email;
    } catch (e) {
        console.error('❌ dbLoadUserToLocal :', e);
        return null;
    }
}

// ============================================
//   SAUVEGARDER localStorage → Firestore
// ============================================
async function dbSaveUserToCloud() {
    if (!__dbSyncReady || !__dbCurrentUser) return;

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
        console.log('☁️ Sauvegardé (balance:', u.balance, ')');
    } catch (e) {
        console.error('❌ dbSaveUserToCloud :', e);
    }
}

// ============================================
//   DÉMARRAGE (au login uniquement)
// ============================================
async function dbStartSync(user) {
    if (!user) return;

    __dbCurrentUser = user;
    __dbSyncReady = false;
    console.log('🔄 Sync pour :', user.email);

    // 1. Charger Firestore → localStorage
    const email = await dbLoadUserToLocal(user.uid);
    if (!email) {
        console.warn('🛡️ Chargement Firestore échoué → on n\'écrase pas');
    }

    // 2. Refresh UI
    dbRefreshAllUI();

    // 3. Marquer prêt
    __dbSyncReady = true;
    console.log('✅ Sync active');
}

// ============================================
//   WRAPPER localStorage.setItem
//   Chaque écriture locale → sauvegarde Firestore (300ms debounce)
// ============================================
(function() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);

        if (key === 'casino_users' || key === 'casinoBalance') {
            if (__dbSyncReady && __dbCurrentUser) {
                clearTimeout(__dbSaveTimeout);
                __dbSaveTimeout = setTimeout(() => {
                    dbSaveUserToCloud();
                }, 300);
            }
        }
    };
})();

// ============================================
//   Sauvegarde à la fermeture (au cas où)
// ============================================
window.addEventListener('beforeunload', () => {
    if (__dbSyncReady && __dbCurrentUser) {
        // Écriture synchrone forcée (peut échouer mais on tente)
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
//   AUTO-START : dès que l'utilisateur est détecté
// ============================================
if (typeof fbAuth !== 'undefined' && fbAuth) {
    fbAuth.onAuthStateChanged((user) => {
        if (user) {
            if (__dbCurrentUser && __dbCurrentUser.uid === user.uid && __dbSyncReady) return;
            dbStartSync(user);
        } else {
            dbStopSync();
        }
    });
}

// ============================================
//   STOP
// ============================================
function dbStopSync() {
    __dbCurrentUser = null;
    __dbSyncReady = false;
    console.log('🛑 Sync arrêtée');
}

window.dbIsReady = dbIsReady;
window.dbLoadUserToLocal = dbLoadUserToLocal;
window.dbSaveUserToCloud = dbSaveUserToCloud;
window.dbStartSync = dbStartSync;
window.dbStopSync = dbStopSync;
