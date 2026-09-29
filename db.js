// db.js
// Sync Firestore ↔ localStorage avec protection anti-écrasement

let __dbCurrentUser = null;
let __dbSyncReady = false;
let __dbSaveInFlight = false;

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
    if (!__dbCurrentUser || !fbDb) {
        return;
    }
    if (__dbSaveInFlight) return;
    __dbSaveInFlight = true;

    const email = localStorage.getItem('casino_logged_email');
    const users = JSON.parse(localStorage.getItem('casino_users')) || {};
    const u = users[email];
    if (!u) {
        __dbSaveInFlight = false;
        return;
    }

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

        localStorage.removeItem('casino_pending_save');
        console.log('☁️ ✅ SAVED — balance:', u.balance);
    } catch (e) {
        console.error('❌ Save ÉCHEC:', e);
        localStorage.setItem('casino_pending_save', Date.now().toString());
    } finally {
        __dbSaveInFlight = false;
    }
}

// ============================================
//   DÉMARRAGE (avec vérification intelligente)
// ============================================
async function dbStartSync(user) {
    if (!user) return;
    __dbCurrentUser = user;
    console.log('🔄 Sync START pour :', user.email);

    // 📖 Vérifie si on a VRAIMENT des données locales valides
    const users = JSON.parse(localStorage.getItem('casino_users')) || {};
    const localUser = users[user.email];
    const hasLocalData = localUser && typeof localUser.balance === 'number';

    const pending = localStorage.getItem('casino_pending_save');
    const pendingAge = pending ? Date.now() - parseInt(pending, 10) : Infinity;

    // 🛡️ On garde le local UNIQUEMENT si :
    // 1. Il y a des données locales valides
    // 2. ET le flag pending est récent (< 2 min)
    if (hasLocalData && pending && pendingAge < 120000) {
        console.log('🛡️ Modifs récentes → on garde le local et on push');
        __dbSyncReady = true;
        dbRefreshAllUI();
        await dbSaveUserToCloud();
        return;
    }

    // ✅ Sinon : Firestore est la source de vérité
    console.log('📥 Chargement Firestore');
    await dbLoadUserToLocal(user.uid);
    dbRefreshAllUI();
    __dbSyncReady = true;
    console.log('✅ Sync READY');
}

// ============================================
//   WRAPPER localStorage.setItem
// ============================================
(function() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);
        if (key === 'casino_users' || key === 'casinoBalance') {
            originalSetItem('casino_pending_save', Date.now().toString());
            console.log('📝 Modif locale détectée');
            if (__dbCurrentUser) {
                dbSaveUserToCloud();
            }
        }
    };
})();

// ============================================
//   TIMER DE SECOURS (retry toutes les 2s)
// ============================================
setInterval(() => {
    if (!__dbCurrentUser) return;
    const pending = localStorage.getItem('casino_pending_save');
    if (pending && !__dbSaveInFlight) {
        console.log('⏰ Timer : retry save');
        dbSaveUserToCloud();
    }
}, 2000);

// ============================================
//   SAUVEGARDES AGRESSIVES
// ============================================
function forceSave() {
    if (__dbCurrentUser) dbSaveUserToCloud();
}
window.addEventListener('pagehide', forceSave);
window.addEventListener('beforeunload', forceSave);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') forceSave();
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
window.dbForceSave = forceSave;
