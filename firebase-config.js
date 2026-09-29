// firebase-config.js
// Configuration Firebase — version compat (compatible scripts classiques)

// 🔥 CONFIGURATION DE TON PROJET FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyCZOz9F8Wdc86GtyZRqyXL3i0prUbQt9M",
    authDomain: "casino-virtual-a36b2.firebaseapp.com",
    projectId: "casino-virtual-a36b2",
    storageBucket: "casino-virtual-a36b2.firebasestorage.app",
    messagingSenderId: "572361352791",
    appId: "1:572361352791:web:bf873a91641a4d6f952512",
    measurementId: "G-2GKDKLCP75"
};

// 🔥 Initialisation Firebase (compat v9)
if (typeof firebase !== 'undefined') {
    if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    console.log('✅ Firebase initialisé !');
    console.log('📦 Projet :', firebase.app().options.projectId);
} else {
    console.error('❌ Firebase SDK non chargé — vérifie les balises <script> dans le HTML');
}

// 🔥 Instances globales (accessibles partout)
let fbAuth = null;
let fbDb = null;

if (typeof firebase !== 'undefined') {
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    console.log('✅ Auth + Firestore prêts');
}

// 🔥 Helpers pour récupérer les instances depuis n'importe quel script
function getFbAuth() { return fbAuth; }
function getFbDb() { return fbDb; }
