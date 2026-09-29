// db.js
// Couche de synchronisation Firebase Firestore ↔ localStorage
// Les jeux continuent à utiliser localStorage, ce fichier s'occupe du cloud.

let __dbSyncReady = false;
let __dbCurrentUser = null;
let __dbUnsubscribe = null;

// ============================================
//   MAPPING localStorage → Firestore
// ============================================
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

        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const email = data.email;

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

        console.log('✅ Données Firestore appliquées au localStorage');
        return email;
    } catch (e) {
        console.error('❌ Erreur dbLoadUserToLocal :', e);
        return null;
    }
}

// ============================================
//   SAUVEGARDER localStorage → Firestore (INSTANTANÉ)
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
        console.log('☁️ Données sauvegardées instantanément dans Firestore');
    } catch (e) {
        console.error('❌ Erreur dbSaveUserToCloud :', e);
    }
}

// ============================================
//   DÉMARRAGE de la synchronisation
// ============================================
async function dbStartSync(user) {
    __dbCurrentUser = user;
    console.log('🔄 Sync pour :', user.email);

    // 1. Charger Firestore → localStorage
    const email = await dbLoadUserToLocal(user.uid);
    if (!email) {
        // 🛡️ SÉCURITÉ : avant d'écraser, on vérifie si le doc existe vraiment
        try {
            const doc = await fbDb.collection('users').doc(user.uid).get();
            if (!doc.exists) {
                // Vrai nouveau compte → on crée le doc avec les valeurs par défaut
                console.log('📝 Nouveau compte → création du doc Firestore');
                await dbSaveUserToCloud();
            } else {
                // Le doc existe MAIS dbLoadUserToLocal a échoué
                // → ON N'ÉCRASE PAS, on aurait perdu des données
                console.error('🛡️ Chargement Firestore échoué, on N\'écrase PAS');
            }
        } catch (e) {
            console.error('🛡️ Impossible de vérifier Firestore, on N\'écrase PAS:', e);
        }
    }

    // 2. Refresh l'UI
    dbRefreshAllUI();

    // 3. Écouter les changements Firestore
    if (__dbUnsubscribe) __dbUnsubscribe();
    __dbUnsubscribe = fbDb.collection('users').doc(user.uid).onSnapshot((doc) => {
        if (!doc.exists) return;
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
            console.log('🔄 Solde mis à jour :', firestoreBalance);
            dbRefreshAllUI();
        }
    });

    __dbSyncReady = true;
    console.log('✅ Sync active');
}

// ============================================
//   AUTO-SYNC IMMÉDIAT (Plus de délai d'attente de 1.5s)
// ============================================
(function() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);
        if (key === 'casino_users' || key === 'casinoBalance') {
            dbSaveUserToCloud(); // Sauvegarde directe sur le cloud
        }
    };
})();

// Sécurité : force la sauvegarde si on change de page ou ferme l'onglet
window.addEventListener('beforeunload', () => {
    dbSaveUserToCloud();
});

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
