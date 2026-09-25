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

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const pseudoSection = document.getElementById('pseudo-section');
    const savePseudoBtn = document.getElementById('save-pseudo-btn');
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('error-message');
    const loggedSection = document.getElementById('logged-section');
    const userDisplay = document.getElementById('user-display');
    const logoutBtn = document.getElementById('logout-btn');
    const footerLinks = document.getElementById('footer-links');

    const currentEmail = getCurrentEmail();
    const users = getUsers();

    // Si déjà connecté sur connexion.html
    if (currentEmail && users[currentEmail] && loggedSection) {
        if (loginForm) loginForm.classList.add('hidden');
        loggedSection.classList.remove('hidden');
        if (footerLinks) footerLinks.classList.add('hidden');
        userDisplay.textContent = users[currentEmail].pseudo || currentEmail;
    }

    // 1. INSCRIPTION : ÉTAPE 1
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                errorMsg.textContent = "Les mots de passe ne correspondent pas !";
                return;
            }

            const users = getUsers();
            if (users[email]) {
                errorMsg.textContent = "Cet email est déjà associé à un compte !";
                return;
            }

            users[email] = { password: password, pseudo: null, balance: 1000 };
            saveUsers(users);
            setCurrentEmail(email);
            localStorage.setItem('casinoBalance', '1000');

            registerForm.classList.add('hidden');
            if (footerLinks) footerLinks.classList.add('hidden');
            pseudoSection.classList.remove('hidden');
            errorMsg.textContent = "Compte créé ! Veuillez maintenant choisir votre pseudo.";
        });
    }

    // 2. INSCRIPTION : ÉTAPE 2
    if (savePseudoBtn) {
        savePseudoBtn.addEventListener('click', () => {
            const pseudoInput = document.getElementById('pseudo-input').value.trim();
            if (!pseudoInput) {
                errorMsg.textContent = "Veuillez entrer un pseudo valide !";
                return;
            }

            const email = getCurrentEmail();
            const users = getUsers();

            for (let em in users) {
                if (users[em].pseudo === pseudoInput) {
                    errorMsg.textContent = "Ce pseudo est déjà pris par un autre joueur !";
                    return;
                }
            }

            if (users[email]) {
                users[email].pseudo = pseudoInput;
                saveUsers(users);
            }

            window.location.href = 'index.html';
        });
    }

    // CONNEXION NORMALE
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;

            const users = getUsers();
            if (!users[email] || users[email].password !== password) {
                errorMsg.textContent = "Email ou mot de passe incorrect !";
                return;
            }

            setCurrentEmail(email);
            localStorage.setItem('casinoBalance', users[email].balance.toString());
            window.location.href = 'index.html';
        });
    }

    // DÉCONNEXION
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            setCurrentEmail(null);
            localStorage.removeItem('casinoBalance');
            window.location.href = 'index.html';
        });
    }
});