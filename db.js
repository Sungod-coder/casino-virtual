// db.js — sync Firestore ↔ localStorage (Version Mobile Ultra-Corrigée)

let __dbCurrentUser = null;
let __dbSyncReady = false;
let __dbSaveInFlight = false;
let __dbModSeq = 0;          
let __dbUnsub = null;
let __dbStartPromise = null;
let __dbApplying = false;

const __rawSet = localStorage.setItem.bind(localStorage);
const DIRTY_KEY = 'casino_dirty_v2';   

function isDirty() { return localStorage.getItem(DIRTY_KEY) === '1'; }
function dbIsReady() { return __dbSyncReady && __dbCurrentUser !== null; }

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
//   Firestore → localStorage
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

async function dbFetchRemote(uid) {         
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
    if (__dbSaveInFlight) return;              
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
            if (seq === __dbModSeq) {           
                localStorage.removeItem(DIRTY_KEY);
                console.log('☁️ ✅ SAVED — balance:', u.balance);
            }
        } while (seq !== __dbModSeq);           
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
        // Sauvegarde immédiate sans attendre sur mobile
        dbSaveUserToCloud();
    }
};

// Retry régulier pour s'assurer que le mobile pousse ses scores
setInterval(() => { if (__dbCurrentUser && __dbSyncReady && isDirty() && !__dbSaveInFlight) dbSaveUserToCloud(); }, 2000);

// Gestion mobile robuste pour forcer l'envoi instantané lors du masquage/quittage
function forceSave() { 
    if (__dbCurrentUser && isDirty()) {
        dbSaveUserToCloud();
    } 
}

window.addEventListener('pagehide', forceSave);
window.addEventListener('beforeunload', forceSave);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        forceSave();
    } else {
        // Au retour sur la page mobile, on force une synchro propre avec le serveur
        if (__dbCurrentUser && __dbSyncReady && !isDirty()) {
            dbFetchRemote(__dbCurrentUser.uid).then(() => dbRefreshAllUI());
        }
    }
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
        localStorage.removeItem('casino_pending_save');   

        const users = JSON.parse(localStorage.getItem('casino_users')) || {};
        const localUser = users[user.email];
        const hasLocal = localUser && typeof localUser.balance === 'number'
                      && localStorage.getItem('casino_logged_email') === user.email;

        // Sur mobile, si des modifs locales n'ont pas été envoyées, on les priorise et on les pousse direct
        if (isDirty() && hasLocal) {
            console.log('🛡️ Modifs locales mobile non envoyées → push immédiat');
            __dbSyncReady = true;
            dbRefreshAllUI();
            await dbSaveUserToCloud();
        } else {
            localStorage.removeItem(DIRTY_KEY);
            const r = await dbFetchRemote(user.uid);
            if (r === 'missing' && hasLocal) {              
                __rawSet(DIRTY_KEY, '1');
                __dbSyncReady = true;
                await dbSaveUserToCloud();
            }
            __dbSyncReady = true;
            dbRefreshAllUI();
        }

        // Écoute temps réel
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
