// db.js
// Synchronisation Firebase ↔ localStorage avec VERROU DE SÉCURITÉ

let __dbSyncReady = false;       // Sync active (démarrage fini)
let __dbIsLoading = false;        // En cours de chargement initial
let __dbCurrentUser = null;
let __dbUnsubscribe = null;

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

        if (!email) {
            console.error('❌ Doc Firestore sans email !');
            return null;
        }

        // 🛡️ PROTECTION : on ne remplace JAMAIS les données locales si Firestore a des valeurs par défaut suspectes
        const existingLocal = users[email];
        const firestoreBalance = data.balance;
        const firestoreIsSuspicious = (typeof firestoreBalance !== 'number') || (firestoreBalance === 1000 && existingLocal && existingLocal.balance > 1000);

        if (firestoreIsSuspicious && existingLocal) {
            console.warn('🛡️ Firestore a 1000 mais local a plus → on garde le local');
            return email; // On garde le local sans écraser
        }

        // Sinon, on remplace par les données Firestore (source de vérité)
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

        console.log('✅ Firestore → localStorage OK');
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
    // 🛡️ VERROU : on ne sauvegarde PAS pendant le chargement initial
    if (__dbIsLoading) {
        console.log('⏸️ Sauvegarde bloquée (chargement en cours)');
        return;
    }
    if (!__dbSyncReady || !__dbCurrentUser) {
        console.log('⏸️ Sauvegarde bloquée (sync pas prête)');
        return;
    }

    const email = localStorage.getItem('casino_logged_email');
    if (!email) return;

    const users = JSON.parse(localStorage.getItem('casino_users')) || {};
    const u = users[email];
    if (!u) return;

    // 🛡️ PROTECTION : si balance est 0 ou undefined ET qu'on a un doute → ne pas sauvegarder
    if (u.balance === 0 && !u.__balanceKnownZero) {
        console.warn('🛡️ Solde local à 0 suspect, sauvegarde bloquée');
        return;
    }

    try {
        await fbDb.collection('users').doc(__dbCurrentUser.uid).set({
            email: email,
            pseudo: u.pseudo || null,
            balance: u.balance,
            tickets: u.tickets || 0,
            inventory: u.inventory || {},
            bp: u.bp || { xp: 0, claimedFree: [], claimedPremium: [], season: 1 },
            weekly: u.weekly || { weekStartDate: Date.now(), lastClaimTime: null, claimed: [] },
            rankXP: u.rankXP || 0,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('☁️ Sauvegardé dans Firestore');
    } catch (e) {
        console.error('❌ dbSaveUserToCloud :', e);
    }
}

// ============================================
//   DÉMARRAGE
// ============================================
async function dbStartSync(user) {
    if (!user) return;

    __dbCurrentUser = user;
    __dbIsLoading = true;    // 🔒 VERROU ON
    __dbSyncReady = false;
    console.log('🔄 Début sync pour :', user.email);

    // 1. Charger Firestore → localStorage
    const email = await dbLoadUserToLocal(user.uid);

    if (!email) {
        // Doc inexistant ou erreur → on ne crée PAS de doc pour ne pas écraser
        console.warn('🛡️ Chargement échoué → on ne touche pas à Firestore');
    }

    // 2. Refresh UI
    dbRefreshAllUI();

    // 3. Écoute temps réel
    if (__dbUnsubscribe) __dbUnsubscribe();
    __dbUnsubscribe = fbDb.collection('users').doc(user.uid).onSnapshot((doc) => {
        if (!doc.exists) return;
        if (__dbIsLoading) return;  // Ignore pendant le chargement

        const data = doc.data();
        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const email = data.email || user.email;
        if (!users[email]) return;

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

        if (localBalance !== firestoreBalance) {
            dbRefreshAllUI();
        }
    });

    // 🔓 VERROU OFF — maintenant on peut sauvegarder
    __dbIsLoading = false;
    __dbSyncReady = true;
    console.log('✅ Sync active');
}

// ============================================
//   WRAPPER localStorage.setItem (avec verrou)
// ============================================
(function() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);
        // 🛡️ Ne déclenche la sauvegarde cloud QUE si sync prête
        if ((key === 'casino_users' || key === 'casinoBalance') && __dbSyncReady && !__dbIsLoading) {
            // Debounce 500ms pour éviter le spam
            clearTimeout(window.__dbSaveTimeout);
            window.__dbSaveTimeout = setTimeout(() => {
                dbSaveUserToCloud();
            }, 500);
        }
    };
})();

// Sauvegarde forcée à la fermeture
window.addEventListener('beforeunload', () => {
    if (__dbSyncReady && __dbCurrentUser && !__dbIsLoading) {
        dbSaveUserToCloud();
    }
});

// ============================================
//   AUTO-START : lance la sync dès que l'utilisateur est détecté
// ============================================
if (typeof fbAuth !== 'undefined' && fbAuth) {
    fbAuth.onAuthStateChanged((user) => {
        if (user) {
            // Ne pas redémarrer la sync si déjà faite pour ce même user
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
    if (__dbUnsubscribe) {
        __dbUnsubscribe();
        __dbUnsubscribe = null;
    }
    __dbCurrentUser = null;
    __dbSyncReady = false;
    __dbIsLoading = false;
    console.log('🛑 Sync arrêtée');
}

window.dbIsReady = dbIsReady;
window.dbLoadUserToLocal = dbLoadUserToLocal;
window.dbSaveUserToCloud = dbSaveUserToCloud;
window.dbStartSync = dbStartSync;
window.dbStopSync = dbStopSync;
