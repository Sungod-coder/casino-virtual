// profil.js - Page de profil EN LECTURE SEULE
// ⚠️ Ne modifie JAMAIS les données, ne fait QUE les lire depuis Firestore

document.addEventListener('DOMContentLoaded', () => {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('profile-content');
    const errorEl = document.getElementById('error-message');

    async function loadProfile() {
        if (typeof fbAuth === 'undefined' || !fbAuth) {
            if (loadingEl) loadingEl.textContent = '❌ Firebase non chargé';
            return;
        }

        fbAuth.onAuthStateChanged(async (user) => {
            if (!user) {
                if (loadingEl) loadingEl.textContent = '⚠️ Non connecté, redirection...';
                setTimeout(() => { window.location.href = 'connexion.html'; }, 800);
                return;
            }

            try {
                // 📥 Chargement DIRECT depuis Firestore (source de vérité)
                const docRef = fbDb.collection('users').doc(user.uid);
                const doc = await docRef.get();

                if (!doc.exists) {
                    // Pas de doc = on ne touche à rien, on affiche juste ce qu'on peut
                    console.warn('📭 Doc Firestore inexistant');
                    if (loadingEl) loadingEl.textContent = '⚠️ Aucun profil trouvé';
                    return;
                }

                const data = doc.data();
                const email = data.email || user.email;

                // 🎨 Affichage (lecture seule, on ne sauvegarde RIEN)
                if (document.getElementById('pseudo-display'))
                    document.getElementById('pseudo-display').textContent = data.pseudo || 'Sans pseudo';
                if (document.getElementById('email-display'))
                    document.getElementById('email-display').textContent = email;
                if (document.getElementById('balance-display'))
                    document.getElementById('balance-display').textContent = (data.balance || 0).toLocaleString();
                if (document.getElementById('tickets-display'))
                    document.getElementById('tickets-display').textContent = data.tickets || 0;

                // Niveau Pass
                if (document.getElementById('bp-level-display')) {
                    if (data.bp && typeof data.bp.xp === 'number' && typeof bpGetLevel === 'function') {
                        document.getElementById('bp-level-display').textContent = bpGetLevel(data.bp.xp);
                    } else {
                        document.getElementById('bp-level-display').textContent = '1';
                    }
                }

                // Rang
                if (document.getElementById('rank-display')) {
                    if (typeof getCurrentRankIndex === 'function' && typeof RANKS !== 'undefined') {
                        const idx = getCurrentRankIndex(data.rankXP || 0);
                        document.getElementById('rank-display').textContent = RANKS[idx] ? RANKS[idx].name : 'Fer';
                    } else {
                        document.getElementById('rank-display').textContent = 'Fer';
                    }
                }

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

    // 🚪 Déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                if (typeof fbAuth !== 'undefined' && fbAuth) await fbAuth.signOut();
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
