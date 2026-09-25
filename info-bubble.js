// info-bubble.js
// Ajoute une bulle d'info en haut à gauche décrivant le jeu en cours.

const GAME_INFO = {
    lobby: {
        title: "🏛️ Lobby — Guide des jeux",
        text: `
🎡 ROULETTE : Rouge/Noir paient x2, Vert x35. Mode Quitte ou Double après une victoire.
🎰 MACHINE À SOUS : 3 symboles = x2 à x50 selon le symbole. 2 identiques = x1.5. Mode Quitte ou Double.
🎲 CRAPS : 7 ou 11 au 1er lancer = x2. 2/3/12 = perdu. Sinon Point à refaire avant un 7.
🃏 BLACKJACK : 21 en 2 cartes paie x2.5. Sinon, plus proche de 21 sans dépasser gagne x2.
🎴 BACCARAT : Joueur x2 / Banquier x1.95 / Égalité x8. Le plus proche de 9 gagne.
🃏 VIDEO POKER : Paire de J/Q/K/A x1, Deux Paires x2, Brelan x3, Quinte x4, Couleur x6, Full x9, Carré x25, Quinte Flush x50, Royale x250.
        `
    },
    roulette: {
        title: "🎡 Roulette Couleurs",
        text: "Placez votre mise sur ROUGE, NOIR ou VERT puis lancez la roue. Rouge/Noir paient x2, Vert paie x35. Si vous gagnez, entrez en mode Quitte ou Double pour doubler vos gains."
    },
    machine: {
        title: "🎰 Machine à Sous",
        text: "3 symboles identiques alignés : 💎 x50, 7️⃣ x20, 🔔 x10, 🍉 x5, 🍋 x3, 🍒 x2. Avec 2 symboles identiques, vous entrez en mode Quitte ou Double : doublez vos gains ou encaissez avant de tout perdre."
    },
    craps: {
        title: "🎲 Craps (Dés)",
        text: "Misez sur la ligne Pass Line puis lancez les dés. Un 7 ou 11 au premier lancer = gain x2 immédiat. Un 2, 3 ou 12 = perdu. Tout autre chiffre devient votre 'Point' : refaites-le avant de faire un 7 pour gagner x2."
    },
    blackjack: {
        title: "🃏 Blackjack",
        text: "Approchez-vous de 21 sans dépasser. Cliquez sur TIRER pour recevoir une carte, RESTER pour vous arrêter. Le croupier tire jusqu'à 17. Un Blackjack naturel (21 en 2 cartes) paie x2.5, une victoire normale paie x2, l'égalité rembourse la mise."
    },
    baccarat: {
        title: "🎴 Baccarat",
        text: "Pariez sur JOUEUR, BANQUIER ou ÉGALITÉ. Le camp le plus proche de 9 gagne. Pas de décision après la mise : les cartes sont tirées automatiquement selon les règles officielles. Paiements : JOUEUR x2, BANQUIER x1.95, ÉGALITÉ x8."
    },
    poker: {
        title: "🃏 Video Poker (Jacks or Better)",
        text: "Recevez 5 cartes. Cliquez sur celles à GARDER, puis échangez les autres. Paiements : Paire de J/Q/K/A x1, Deux Paires x2, Brelan x3, Quinte x4, Couleur x6, Full House x9, Carré x25, Quinte Flush x50, Quinte Flush Royale x250."
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const gameKey = document.body.dataset.game;
    if (!gameKey || !GAME_INFO[gameKey]) return;

    const info = GAME_INFO[gameKey];

    const bubble = document.createElement('div');
    bubble.className = 'info-bubble';
    bubble.innerHTML = `
        <button class="info-bubble-btn" title="Informations sur le jeu">ℹ️</button>
        <div class="info-bubble-content hidden">
            <h4>${info.title}</h4>
            <p>${info.text.replace(/\n/g, '<br>')}</p>
        </div>
    `;

    document.body.appendChild(bubble);

    const btn = bubble.querySelector('.info-bubble-btn');
    const content = bubble.querySelector('.info-bubble-content');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        content.classList.toggle('hidden');
    });

    // Ferme la bulle si on clique ailleurs
    document.addEventListener('click', (e) => {
        if (!bubble.contains(e.target)) {
            content.classList.add('hidden');
        }
    });
});