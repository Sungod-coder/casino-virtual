// db.js
// Sauvegarde FIABLE avec REST API keepalive + retry

let __dbSyncReady = false;
let __dbCurrentUser = null;
let __dbSaveInFlight = false;
let __dbSaveQueued = false;

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
//   SAUVEGARDE — Approche double (SDK + REST keepalive)
// ============================================
async function dbSaveUserToCloud() {
    if (!__dbCurrentUser) return;

    // Si une sauvegarde est déjà en cours, mettre en file d'attente
    if (__dbSaveInFlight) {
        __dbSaveQueued = true;
        return;
    }
    __dbSaveInFlight = true;

    const email = localStorage.getItem('casino_logged_email');
    if (!email) {
        __dbSaveInFlight = false;
        return;
    }

    const users = JSON.parse(localStorage.getItem('casino_users')) || {};
    const u = users[email];
    if (!u) {
        __dbSaveInFlight = false;
        return;
    }

    const uid = __dbCurrentUser.uid;
    const payload = {
        email: email,
        pseudo: u.pseudo || null,
        balance: u.balance || 0,
        tickets: u.tickets || 0,
        inventory: u.inventory || {},
        bp: u.bp || { xp: 0, claimedFree: [], claimedPremium: [], season: 1 },
        weekly: u.weekly || { weekStartDate: Date.now(), lastClaimTime: null, claimed: [] },
        rankXP: u.rankXP || 0
    };

    console.log('💾 Tentative de sauvegarde... balance =', payload.balance);

    try {
        // ✅ Tentative 1 : SDK Firebase (peut être annulée si on navigue)
        await fbDb.collection('users').doc(uid).set({
            ...payload,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        localStorage.removeItem('casino_pending_save');
        console.log('☁️ ✅ Sauvegardé via SDK (balance:', payload.balance, ')');
    } catch (e) {
        console.error('❌ SDK save échoué:', e);

        // ⚡ Tentative 2 : REST API avec keepalive (survit à la navigation)
        try {
            const token = await __dbCurrentUser.getIdToken();
            const projectId = firebase.app().options.projectId;
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=balance&updateMask.fieldPaths=tickets&updateMask.fieldPaths=rankXP&updateMask.fieldPaths=bp&updateMask.fieldPaths=weekly&updateMask.fieldPaths=inventory&updateMask.fieldPaths=pseudo&updateMask.fieldPaths=email`;

            const body = {
                fields: {
                    email: { stringValue: email },
                    pseudo: { stringValue: u.pseudo || '' },
                    balance: { integerValue: String(u.balance || 0) },
                    tickets: { integerValue: String(u.tickets || 0) },
                    rankXP: { integerValue: String(u.rankXP || 0) },
                    inventory: { stringValue: JSON.stringify(u.inventory || {}) },
                    bp: { stringValue: JSON.stringify(u.bp || {}) },
                    weekly: { stringValue: JSON.stringify(u.weekly || {}) }
                }
            };

            await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                keepalive: true // 🔥 SURVIT À LA NAVIGATION
            });

            localStorage.removeItem('casino_pending_save');
            console.log('☁️ ✅ Sauvegardé via REST (balance:', payload.balance, ')');
        } catch (e2) {
            console.error('❌ REST save échoué aussi:', e2);
        }
    } finally {
        __dbSaveInFlight = false;
        if (__dbSaveQueued) {
            __dbSaveQueued = false;
            setTimeout(dbSaveUserToCloud, 50);
        }
    }
}

// ============================================
//   DÉMARRAGE
// ============================================
async function dbStartSync(user) {
    if (!user) return;

    __dbCurrentUser = user;
    __dbSyncReady = false;
    console.log('🔄 Sync pour :', user.email, '| UID:', user.uid);

    // Si modifs locales en attente → sauvegarde immédiate
    const pending = localStorage.getItem('casino_pending_save');
    if (pending && (Date.now() - parseInt(pending, 10) < 300000)) {
        console.log('🛡️ Modifs en attente → sauvegarde d\'abord');
        __dbSyncReady = true;
        await dbSaveUserToCloud();
        dbRefreshAllUI();
        console.log('✅ Sync active (local gardé)');
        return;
    }

    // Sinon charger Firestore
    await dbLoadUserToLocal(user.uid);
    dbRefreshAllUI();
    __dbSyncReady = true;
    console.log('✅ Sync active');
}

// ============================================
//   WRAPPER localStorage — SAUVEGARDE IMMÉDIATE
// ============================================
(function() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);

        if (key === 'casino_users' || key === 'casinoBalance') {
            // 📌 Marquer pour retry
            originalSetItem('casino_pending_save', Date.now().toString());

            if (__dbCurrentUser) {
                // 🔥 SAUVEGARDE IMMÉDIATE — pas de debounce
                dbSaveUserToCloud();
            } else {
                console.log('⏸️ Pas encore de user, save reportée');
            }
        }
    };
})();

// ============================================
//   SAUVEGARDES DE SÉCURITÉ (mobile-friendly)
// ============================================
function forceSave() {
    if (__dbCurrentUser) {
        console.log('💾 Force save');
        dbSaveUserToCloud();
    }
}

window.addEventListener('pagehide', forceSave);            // 📱 mobile
window.addEventListener('beforeunload', forceSave);        // 🖥️ desktop
document.addEventListener('visibilitychange', () => {     // 📱 onglet caché
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
