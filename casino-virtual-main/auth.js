// auth.js
// Authentification via Firebase Auth + synchronisation Firestore

// ============================================
//   UTILS (compat avec l'ancien code)
// ============================================
function getUsers() {
    return JSON.parse(localStorage.getItem('casino_users')) || {};
}

function saveUsers(users) {
    localStorage.setItem('casino_users', JSON.stringify(users));
}

function getCurrentEmail() {
    return localStorage.getItem('casino_logged_email');
}

function setCurrentEmail(email) {
    if (email) {
        localStorage.setItem('casino_logged_email', email);
    } else {
        localStorage.removeItem('casino_logged_email');
    }
}

// ============================================
//   INSCRIPTION
// ============================================
async function firebaseRegister(email, password, pseudo) {
    try {
        const userCredential = await fbAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Créer le document Firestore
        await fbDb.collection('users').doc(user.uid).set({
            email: email,
            pseudo: pseudo || null,
            balance: 1000,
            tickets: 0,
            inventory: {},
            bp: { xp: 0, claimedFree: [], claimedPremium: [], season: 1 },
            weekly: { weekStartDate: Date.now(), lastClaimTime: null, claimed: [] },
            rankXP: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Charger dans localStorage
        await dbLoadUserToLocal(user.uid);

        console.log('✅ Compte créé sur Firebase');
        return { ok: true, user };
    } catch (e) {
        console.error('❌ Erreur inscription :', e);
        let msg = 'Erreur inconnue';
        if (e.code === 'auth/email-already-in-use') msg = "Cet email est déjà utilisé !";
        else if (e.code === 'auth/weak-password') msg = "Le mot de passe doit faire 6 caractères minimum.";
        else if (e.code === 'auth/invalid-email') msg = "L'adresse email est invalide.";
        return { ok: false, msg };
    }
}

// ============================================
//   CONNEXION
// ============================================
async function firebaseLogin(email, password) {
    try {
        const userCredential = await fbAuth.signInWithEmailAndPassword(email, password);
        console.log('✅ Connexion Firebase réussie');
        // dbStartSync sera appelé via onAuthStateChanged
        return { ok: true, user: userCredential.user };
    } catch (e) {
        console.error('❌ Erreur connexion :', e);
        let msg = 'Erreur inconnue';
        if (e.code === 'auth/user-not-found') msg = "Aucun compte avec cet email.";
        else if (e.code === 'auth/wrong-password') msg = "Mot de passe incorrect.";
        else if (e.code === 'auth/invalid-credential') msg = "Email ou mot de passe incorrect.";
        else if (e.code === 'auth/invalid-email') msg = "Adresse email invalide.";
        else if (e.code === 'auth/too-many-requests') msg = "Trop de tentatives. Réessaie plus tard.";
        return { ok: false, msg };
    }
}

// ============================================
//   DÉCONNEXION
// ============================================
async function firebaseLogout() {
    try {
        await fbAuth.signOut();
        dbStopSync();
        localStorage.removeItem('casino_users');
        localStorage.removeItem('casino_logged_email');
        localStorage.removeItem('casinoBalance');
        console.log('👋 Déconnecté');
    } catch (e) {
        console.error('❌ Erreur déconnexion :', e);
    }
}

// ============================================
//   onAuthStateChanged : l'utilisateur est-il connecté ?
// ============================================
if (typeof fbAuth !== 'undefined' && fbAuth) {
    fbAuth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('👤 Utilisateur connecté :', user.email);
            await dbStartSync(user);

            // Si on est sur une page qui nécessite le pseudo
            const pseudoSection = document.getElementById('pseudo-section');
            const registerForm = document.getElementById('register-form');
            const loggedSection = document.getElementById('logged-section');
            const userDisplay = document.getElementById('user-display');
            const footerLinks = document.getElementById('footer-links');
            const loginForm = document.getElementById('login-form');

            const users = getUsers();
            const u = users[user.email];

            if (u && !u.pseudo && pseudoSection) {
                // Doit choisir un pseudo
                if (registerForm) registerForm.classList.add('hidden');
                pseudoSection.classList.remove('hidden');
                if (footerLinks) footerLinks.classList.add('hidden');
            } else if (u && u.pseudo) {
                // Connecté et a un pseudo
                if (loginForm) loginForm.classList.add('hidden');
                if (loggedSection) loggedSection.classList.remove('hidden');
                if (footerLinks) footerLinks.classList.add('hidden');
                if (userDisplay) userDisplay.textContent = u.pseudo || user.email;

                // Rediriger vers index après login réussi (sauf si déjà sur index)
                const path = window.location.pathname;
                const isIndex = path.endsWith('/index.html') || path.endsWith('/') || path.endsWith('/index');
                if (!isIndex && document.getElementById('logout-btn')) {
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 500);
                }
            }
        } else {
            console.log('👤 Aucun utilisateur connecté');
            dbStopSync();
        }
    });
}

// ============================================
//   GESTION DES FORMULAIRES
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const pseudoSection = document.getElementById('pseudo-section');
    const savePseudoBtn = document.getElementById('save-pseudo-btn');
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('error-message');
    const logoutBtn = document.getElementById('logout-btn');

    // ========================================
    //   INSCRIPTION (ÉTAPE 1)
    // ========================================
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (errorMsg) errorMsg.textContent = '';

            if (password !== confirmPassword) {
                if (errorMsg) errorMsg.textContent = "Les mots de passe ne correspondent pas !";
                return;
            }

            if (password.length < 6) {
                if (errorMsg) errorMsg.textContent = "Le mot de passe doit faire au moins 6 caractères.";
                return;
            }

            if (errorMsg) errorMsg.textContent = "⏳ Création du compte...";

            const res = await firebaseRegister(email, password, null);
            if (res.ok) {
                if (registerForm) registerForm.classList.add('hidden');
                if (pseudoSection) pseudoSection.classList.remove('hidden');
                const footerLinks = document.getElementById('footer-links');
                if (footerLinks) footerLinks.classList.add('hidden');
                if (errorMsg) errorMsg.textContent = "Compte créé ! Choisis ton pseudo.";
            } else {
                if (errorMsg) errorMsg.textContent = "❌ " + res.msg;
            }
        });
    }

    // ========================================
    //   INSCRIPTION (ÉTAPE 2 — PSEUDO)
    // ========================================
    if (savePseudoBtn) {
        savePseudoBtn.addEventListener('click', async () => {
            const pseudoInput = document.getElementById('pseudo-input').value.trim();
            if (errorMsg) errorMsg.textContent = '';

            if (!pseudoInput) {
                if (errorMsg) errorMsg.textContent = "Veuillez entrer un pseudo valide !";
                return;
            }

            const user = fbAuth.currentUser;
            if (!user) {
                if (errorMsg) errorMsg.textContent = "❌ Utilisateur non connecté. Réessaie.";
                return;
            }

            if (errorMsg) errorMsg.textContent = "⏳ Vérification du pseudo...";

            try {
                // Vérifie que le pseudo n'est pas déjà pris
                const snapshot = await fbDb.collection('users').where('pseudo', '==', pseudoInput).get();
                if (!snapshot.empty) {
                    // Un autre user a ce pseudo ?
                    let taken = false;
                    snapshot.forEach(doc => {
                        if (doc.id !== user.uid) taken = true;
                    });
                    if (taken) {
                        if (errorMsg) errorMsg.textContent = "Ce pseudo est déjà pris !";
                        return;
                    }
                }

                // Enregistre le pseudo dans Firestore
                await fbDb.collection('users').doc(user.uid).update({ pseudo: pseudoInput });

                // Met à jour le localStorage
                const users = getUsers();
                if (!users[user.email]) users[user.email] = {};
                users[user.email].pseudo = pseudoInput;
                saveUsers(users);

                if (errorMsg) errorMsg.textContent = "✅ Pseudo enregistré ! Redirection...";
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            } catch (e) {
                console.error('❌ Erreur pseudo :', e);
                if (errorMsg) errorMsg.textContent = "❌ Erreur : " + e.message;
            }
        });
    }

    // ========================================
    //   CONNEXION
    // ========================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;

            if (errorMsg) errorMsg.textContent = "⏳ Connexion...";

            const res = await firebaseLogin(email, password);
            if (!res.ok) {
                if (errorMsg) errorMsg.textContent = "❌ " + res.msg;
            }
            // Si succès, onAuthStateChanged va rediriger automatiquement
        });
    }

    // ========================================
    //   DÉCONNEXION
    // ========================================
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await firebaseLogout();
            window.location.href = 'index.html';
        });
    }
});
