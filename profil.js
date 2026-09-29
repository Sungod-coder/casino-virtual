// profil.js - Gestion de la page de profil (Lecture seule sécurisée)

document.addEventListener('DOMContentLoaded', () => {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('profile-content');
    const errorEl = document.getElementById('error-message');

    async function loadProfile() {
        if (!window.fbAuth || !window.fbDb) {
            if (loadingEl) loadingEl.textContent = '❌ Firebase non chargé';
            return;
        }

        // Écoute de l'état d'authentification
        fbAuth.onAuthStateChanged(async (user) => {
            if (!user) {
                if (loadingEl) loadingEl.textContent = '⚠️ Non connecté, redirection...';
                setTimeout(() => {
                    window.location.href = 'connexion.html';
                }, 800);
                return;
            }

            try {
                // 📥 Récupération directe des données depuis Firestore (la source de vérité absolue)
                const docRef = fbDb.collection('users').doc(user.uid);
                const doc = await docRef.get();

                if (!doc.exists) {
                    throw new Error('Profil introuvable dans Firestore');
                }

                const data = doc.data();
                const email = data.email || user.email;

                // 🔄 Mise à jour propre du localStorage SANS écraser bêtement les objets annexes
                let users = JSON.parse(localStorage.getItem('casino_users')) || {};
                if (!users[email]) users[email] = {};

                // On fusionne les données reçues du Cloud sans perdre le reste
                users[email].pseudo = data.pseudo || users[email].pseudo || null;
                users[email].balance = typeof data.balance === 'number' ? data.balance : (users[email].balance || 1000);
                users[email].tickets = typeof data.tickets === 'number' ? data.tickets : (users[email].tickets || 0);
                users[email].inventory = data.inventory || users[email].inventory || {};
                users[email].bp = data.bp || users[email].bp || { xp: 0, claimedFree: [], claimedPremium: [], season: 1 };
                users[email].weekly = data.weekly || users[email].weekly || { weekStartDate: Date.now(), lastClaimTime: null, claimed: [] };
                users[email].rankXP = typeof data.rankXP === 'number' ? data.rankXP : (users[email].rankXP || 0);

                // Enregistrement silencieux dans le localStorage pour les autres pages
                localStorage.setItem('casino_users', JSON.stringify(users));
                localStorage.setItem('casino_logged_email', email);
                localStorage.setItem('casinoBalance', users[email].balance.toString());

                // 🎨 Affichage dans l'interface du profil
                const pseudoDisp = document.getElementById('pseudo-display');
                const emailDisp = document.getElementById('email-display');
                const balanceDisp = document.getElementById('balance-display');
                const ticketsDisp = document.getElementById('tickets-display');
                const bpLevelDisp = document.getElementById('bp-level-display');
                const rankDisp = document.getElementById('rank-display');

                if (pseudoDisp) pseudoDisp.textContent = data.pseudo || 'Sans pseudo';
                if (emailDisp) emailDisp.textContent = email;
                if (balanceDisp) balanceDisp.textContent = (users[email].balance).toLocaleString();
                if (ticketsDisp) ticketsDisp.textContent = users[email].tickets;

                // Niveau Pass
                if (bpLevelDisp) {
                    if (data.bp && typeof data.bp.xp === 'number' && typeof bpGetLevel === 'function') {
                        bpLevelDisp.textContent = bpGetLevel(data.bp.xp);
                    } else {
                        bpLevelDisp.textContent = data.bp && data.bp.season ? data.bp.season : '1';
                    }
                }

                // Rang
                if (rankDisp) {
                    if (typeof getCurrentRankIndex === 'function' && typeof RANKS !== 'undefined') {
                        const rankXP = data.rankXP || 0;
                        const idx = getCurrentRankIndex(rankXP);
                        rankDisp.textContent = RANKS[idx] ? RANKS[idx].name : 'Fer';
                    } else {
                        rankDisp.textContent = 'Fer';
                    }
                }

                // Affichage du contenu de la carte
                if (loadingEl) loadingEl.style.display = 'none';
                if (contentEl) contentEl.style.display = 'block';

            } catch (e) {
                console.error('❌ Erreur chargement profil :', e);
                if (loadingEl) loadingEl.style.display = 'none';
                if (errorEl) {
                    errorEl.textContent = '❌ Erreur de chargement du profil';
                    errorEl.style.display = 'block';
                }
            }
        });
    }

    // 🚪 Gestion du bouton de déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                if (window.fbAuth) await fbAuth.signOut();
                if (typeof dbStopSync === 'function') dbStopSync();
                localStorage.removeItem('casino_logged_email');
                localStorage.removeItem('casinoBalance');
                window.location.href = 'connexion.html';
            } catch (e) {
                console.error('❌ Erreur déconnexion :', e);
            }
        });
    }

    loadProfile();
});
