// db.js
// Couche de synchronisation Firebase Firestore ↔ localStorage
// Les jeux continuent à utiliser localStorage, ce fichier s'occupe du cloud.

let __dbSyncReady = false;
let __dbCurrentUser = null;
let __dbUnsubscribe = null;

// ============================================
//   MAPPING localStorage → Firestore
// ============================================
// On stocke TOUT dans un seul document Firestore : users/{uid}
// Structure : { email, pseudo, balance, tickets, inventory, bp, weekly, rankXP, ... }

function dbIsReady() { return __dbSyncReady && __dbCurrentUser !== null; }

// ============================================
//   CHARGER le document Firestore → localStorage
// ============================================
async function dbLoadUserToLocal(uid) {
    if (!fbDb) return;
    try {
        const doc = await fbDb.collection('users').doc(uid).get();
        if (!doc.exists) {
            console.log('📭 Nouvel utilisateur — pas de données Firestore');
            return null;
        }

        const data = doc.data();
        console.log('📥 Données chargées depuis Firestore :', data);

        // On reconstitue casino_users[email] avec les données Firestore
        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const email = data.email;

        users[email] = {
            password: '__FIREBASE__', // le mot de passe est géré par Firebase
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

        console.log('✅ Données Firestore appliquées au localStorage');
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
        console.log('☁️ Données sauvegardées dans Firestore');
    } catch (e) {
        console.error('❌ Erreur dbSaveUserToCloud :', e);
    }
}

// ============================================
//   DÉMARRAGE de la synchronisation
// ============================================
async function dbStartSync(user) {
    __dbCurrentUser = user;
    console.log('🔄 Démarrage de la sync pour :', user.email);

    // 1. Charger les données Firestore → localStorage
    const email = await dbLoadUserToLocal(user.uid);
    if (!email) {
        // Nouveau compte : on crée le doc avec les valeurs par défaut
        await dbSaveUserToCloud();
    }

    // 2. Écouter les changements Firestore en temps réel
    if (__dbUnsubscribe) __dbUnsubscribe();
    __dbUnsubscribe = fbDb.collection('users').doc(user.uid).onSnapshot((doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const email = data.email || user.email;

        // On évite de s'écraser soi-même si la donnée est identique
        const currentLocal = users[email];
        if (!currentLocal) return;

        // Mise à jour douce
        users[email].balance = typeof data.balance === 'number' ? data.balance : currentLocal.balance;
        users[email].tickets = typeof data.tickets === 'number' ? data.tickets : currentLocal.tickets;
        users[email].inventory = data.inventory || currentLocal.inventory;
        users[email].bp = data.bp || currentLocal.bp;
        users[email].weekly = data.weekly || currentLocal.weekly;
        users[email].rankXP = typeof data.rankXP === 'number' ? data.rankXP : currentLocal.rankXP;
        users[email].pseudo = data.pseudo || currentLocal.pseudo;

        localStorage.setItem('casino_users', JSON.stringify(users));
        localStorage.setItem('casinoBalance', (users[email].balance || 0).toString());

        console.log('🔄 Sync Firestore → localStorage');
    });

    __dbSyncReady = true;
    console.log('✅ Synchronisation active');
}

// ============================================
//   AUTO-SYNC localStorage → Firestore (débounce 1.5s)
// ============================================
let __dbSaveTimeout = null;
function dbScheduleSave() {
    if (!__dbSyncReady) return;
    clearTimeout(__dbSaveTimeout);
    __dbSaveTimeout = setTimeout(() => {
        dbSaveUserToCloud();
    }, 1500);
}

// Intercepte les écritures localStorage pour sauvegarder sur Firestore
(function() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);
        if (key === 'casino_users' || key === 'casinoBalance') {
            dbScheduleSave();
        }
    };
})();

// ============================================
//   STOP la sync (déconnexion)
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

// ============================================
//   EXPORT
// ============================================
window.dbIsReady = dbIsReady;
window.dbLoadUserToLocal = dbLoadUserToLocal;
window.dbSaveUserToCloud = dbSaveUserToCloud;
window.dbStartSync = dbStartSync;
window.dbStopSync = dbStopSync;
