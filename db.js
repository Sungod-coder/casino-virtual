// db.js
// Sync FIABLE : sauvegarde immédiate + flag pending_save

let __dbSyncReady = false;
let __dbCurrentUser = null;
let __dbSaveTimeout = null;
let __dbLastSavePromise = null;

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
//   CHARGER Firestore → localStorage
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

        console.log('✅ Firestore → localStorage (balance:', users[email].balance, ')');
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

        // ✅ Sauvegarde réussie → on retire le flag
        localStorage.removeItem('casino_pending_save');
        console.log('☁️ Sauvegardé (balance:', u.balance, ')');
    } catch (e) {
        console.error('❌ dbSaveUserToCloud :', e);
        // ❌ Échec → le flag reste pour réessayer plus tard
    }
}

// ============================================
//   DÉMARRAGE
// ============================================
async function dbStartSync(user) {
    if (!user) return;

    __dbCurrentUser = user;
    __dbSyncReady = false;
    console.log('🔄 Sync pour :', user.email);

    // 🛡️ VÉRIFICATION CRITIQUE : y a-t-il des modifs locales non sauvegardées ?
    const pending = localStorage.getItem('casino_pending_save');
    const hasPending = pending && (Date.now() - parseInt(pending, 10) < 300000); // < 5 min

    if (hasPending) {
        // ⚠️ Modifs locales récentes → on GARDE le local et on essaie de sauvegarder
        console.log('🛡️ Modifs locales récentes → on garde le local et on envoie à Firestore');

        __dbSyncReady = true;
        dbRefreshAllUI();
        await dbSaveUserToCloud(); // Retente la sauvegarde
    } else {
        // Charger Firestore normalement
        await dbLoadUserToLocal(user.uid);
        dbRefreshAllUI();
        __dbSyncReady = true;
    }

    console.log('✅ Sync active');
}

// ============================================
//   WRAPPER localStorage.setItem (sauvegarde immédiate)
// ============================================
(function() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);

        if (key === 'casino_users' || key === 'casinoBalance') {
            // 📌 Marquer qu'il y a des modifs en attente
            originalSetItem('casino_pending_save', Date.now().toString());

            if (__dbSyncReady && __dbCurrentUser) {
                // Sauvegarde immédiate (pas de debounce long)
                clearTimeout(__dbSaveTimeout);
                __dbSaveTimeout = setTimeout(() => {
                    dbSaveUserToCloud();
                }, 100); // 100ms au lieu de 300ms
            }
        }
    };
})();

// ============================================
//   SAUVEGARDES DE SÉCURITÉ (avant fermeture)
// ============================================
function forceSaveNow() {
    if (__dbSyncReady && __dbCurrentUser) {
        console.log('💾 Sauvegarde forcée (fermeture)');
        dbSaveUserToCloud();
    }
}

// 📱 Utiliser plusieurs events pour maximiser les chances
window.addEventListener('beforeunload', forceSaveNow);
window.addEventListener('pagehide', forceSaveNow);       // ← plus fiable sur mobile
document.addEventListener('visibilitychange', () => {    // ← quand on change d'onglet
    if (document.visibilityState === 'hidden') {
        forceSaveNow();
    }
});

// ============================================
//   AUTO-START
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
