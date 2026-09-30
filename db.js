// db.js — sync Firestore ↔ localStorage
// Règle d'or : une page n'écrit dans le cloud QUE si elle a réellement modifié des données
// (drapeau "dirty"). Une page qui n'a rien joué ne peut donc jamais écraser le solde d'un autre appareil.

let __dbCurrentUser = null;
let __dbSyncReady = false;
let __dbSaveInFlight = false;
let __dbModSeq = 0;          // compteur de modifications locales
let __dbUnsub = null;
let __dbStartPromise = null;
let __dbApplying = false;

const __rawSet = localStorage.setItem.bind(localStorage);
const DIRTY_KEY = 'casino_dirty_v2';   // "1" = modifs locales pas encore confirmées par Firestore

function isDirty() { return localStorage.getItem(DIRTY_KEY) === '1'; }
function dbIsReady() { return __dbSyncReady && __dbCurrentUser !== null; }

// Les écritures sont mises en file (IndexedDB) : si la page est quittée avant la fin
// de l'envoi (fréquent sur mobile), elles partent au prochain chargement.
try {
    if (typeof fbDb !== 'undefined' && fbDb && fbDb.enablePersistence) {
        fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    }
} catch (e) {}

// ============================================
//   REFRESH UI
// ============================================
function dbRefreshAllUI() {
    const fns = ['updateDisplayBalance', 'renderBattlePass', 'refreshBPTicketsUI', 'potionUpdateUI',
                 'renderWeeklyRewards', 'updateRankButton', 'shopUpdateUI', 'updateUI'];
    fns.forEach(n => { try { if (typeof window[n] === 'function') window[n](); } catch (e) {} });

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
//   Firestore → localStorage (sans déclencher de sauvegarde)
// ============================================
function dbApplyRemote(data) {
    const email = data.email;
    if (!email) return false;
    const before = localStorage.getItem('casino_users') + '|' + localStorage.getItem('casinoBalance');
    const users = JSON.parse(localStorage.getItem('casino_users')) || {};
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
    __dbApplying = true;
    __rawSet('casino_users', JSON.stringify(users));
    __rawSet('casino_logged_email', email);
    __rawSet('casinoBalance', users[email].balance.toString());
    __dbApplying = false;
    const after = localStorage.getItem('casino_users') + '|' + localStorage.getItem('casinoBalance');
    return before !== after;
}

async function dbFetchRemote(uid) {         // 'ok' | 'missing' | 'error'
    try {
        const doc = await fbDb.collection('users').doc(uid).get();
        if (!doc.exists) return 'missing';
        dbApplyRemote(doc.data());
        console.log('✅ Firestore → local (balance:', doc.data().balance, ')');
        return 'ok';
    } catch (e) {
        console.error('❌ Lecture Firestore :', e);
        return 'error';
    }
}

async function dbLoadUserToLocal(uid) {
    const r = await dbFetchRemote(uid);
    return r === 'ok' ? localStorage.getItem('casino_logged_email') : null;
}

// ============================================
//   localStorage → Firestore
// ============================================
function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

async function dbSaveUserToCloud() {
    if (!__dbCurrentUser || !fbDb || !isDirty()) return;
    if (__dbSaveInFlight) return;              // la boucle ci-dessous renverra les modifs arrivées entre-temps
    __dbSaveInFlight = true;
    try {
        let seq;
        do {
            seq = __dbModSeq;
            const email = localStorage.getItem('casino_logged_email');
            const u = (JSON.parse(localStorage.getItem('casino_users')) || {})[email];
            if (!u) break;
            await withTimeout(
                fbDb.collection('users').doc(__dbCurrentUser.uid).set({
                    email,
                    pseudo: u.pseudo || null,
                    balance: u.balance || 0,
                    tickets: u.tickets || 0,
                    inventory: u.inventory || {},
                    bp: u.bp || { xp: 0, claimedFree: [], claimedPremium: [], season: 1 },
                    weekly: u.weekly || { weekStartDate: Date.now(), lastClaimTime: null, claimed: [] },
                    rankXP: u.rankXP || 0,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }),
                8000
            );
            if (seq === __dbModSeq) {           // rien n'a bougé pendant l'envoi → tout est à jour
                localStorage.removeItem(DIRTY_KEY);
                console.log('☁️ ✅ SAVED — balance:', u.balance);
            }
        } while (seq !== __dbModSeq);           // modifs arrivées pendant l'envoi → on renvoie
    } catch (e) {
        console.error('❌ Save ÉCHEC (sera réessayé):', e && e.message);
    } finally {
        __dbSaveInFlight = false;
    }
}

// ============================================
//   Détection des modifs locales (wrapper localStorage.setItem)
// ============================================
localStorage.setItem = function (key, value) {
    __rawSet(key, value);
    if ((key === 'casino_users' || key === 'casinoBalance') && !__dbApplying && __dbSyncReady) {
        __dbModSeq++;
        __rawSet(DIRTY_KEY, '1');
        dbSaveUserToCloud();
    }
};

// Retry si un envoi a échoué
setInterval(() => { if (__dbCurrentUser && __dbSyncReady && isDirty() && !__dbSaveInFlight) dbSaveUserToCloud(); }, 3000);

// Quitter / masquer la page : on n'envoie QUE s'il y a du non-envoyé (plus d'écrasement par un onglet périmé)
function forceSave() { if (__dbCurrentUser && isDirty()) dbSaveUserToCloud(); }
window.addEventListener('pagehide', forceSave);
window.addEventListener('beforeunload', forceSave);

// Revenir sur la page : si on n'a rien de non-envoyé, on relit le serveur (onglet/téléphone périmé)
async function dbPullIfClean() {
    if (!__dbCurrentUser || !__dbSyncReady || isDirty() || __dbSaveInFlight) return;
    try {
        const doc = await fbDb.collection('users').doc(__dbCurrentUser.uid).get({ source: 'server' });
        if (doc.exists && !isDirty() && !__dbSaveInFlight && dbApplyRemote(doc.data())) dbRefreshAllUI();
    } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') forceSave(); else dbPullIfClean();
});

// ============================================
//   DÉMARRAGE
// ============================================
function dbStartSync(user) {
    if (!user) return Promise.resolve();
    if (__dbStartPromise && __dbCurrentUser && __dbCurrentUser.uid === user.uid) return __dbStartPromise;
    __dbCurrentUser = user;
    console.log('🔄 Sync START pour :', user.email);

    __dbStartPromise = (async () => {
        localStorage.removeItem('casino_pending_save');   // ancien drapeau, remplacé par DIRTY_KEY

        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const localUser = users[user.email];
        const hasLocal = localUser && typeof localUser.balance === 'number'
                      && localStorage.getItem('casino_logged_email') === user.email;

        if (isDirty() && hasLocal) {
            console.log('🛡️ Modifs locales non envoyées → on garde le local et on push');
            __dbSyncReady = true;
            dbRefreshAllUI();
            await dbSaveUserToCloud();
        } else {
            localStorage.removeItem(DIRTY_KEY);
            const r = await dbFetchRemote(user.uid);
            if (r === 'missing' && hasLocal) {              // vrai nouveau compte : on crée le doc
                __rawSet(DIRTY_KEY, '1');
                __dbSyncReady = true;
                await dbSaveUserToCloud();
            }
            __dbSyncReady = true;
            dbRefreshAllUI();
        }

        // Écoute temps réel : les autres appareils mettent à jour celui-ci
        if (__dbUnsub) __dbUnsub();
        __dbUnsub = fbDb.collection('users').doc(user.uid).onSnapshot((doc) => {
            if (!doc.exists || doc.metadata.hasPendingWrites || doc.metadata.fromCache) return;
            if (isDirty() || __dbSaveInFlight) return;
            if (dbApplyRemote(doc.data())) dbRefreshAllUI();
        }, () => {});

        console.log('✅ Sync READY');
    })();
    return __dbStartPromise;
}

function dbStopSync() {
    if (__dbUnsub) { __dbUnsub(); __dbUnsub = null; }
    __dbCurrentUser = null;
    __dbSyncReady = false;
    __dbStartPromise = null;
    console.log('🛑 Sync arrêtée');
}

if (typeof fbAuth !== 'undefined' && fbAuth) {
    fbAuth.onAuthStateChanged((user) => { if (user) dbStartSync(user); else dbStopSync(); });
}

window.dbIsReady = dbIsReady;
window.dbLoadUserToLocal = dbLoadUserToLocal;
window.dbSaveUserToCloud = dbSaveUserToCloud;
window.dbStartSync = dbStartSync;
window.dbStopSync = dbStopSync;
window.dbForceSave = forceSave;
window.dbRefreshAllUI = dbRefreshAllUI;
