// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyCZOz9F8Wdc86GtyZRqyXL3i0prUbQt9M",
    authDomain: "casino-virtual-a36b2.firebaseapp.com",
    projectId: "casino-virtual-a36b2",
    storageBucket: "casino-virtual-a36b2.firebasestorage.app",
    messagingSenderId: "572361352791",
    appId: "1:572361352791:web:34db420bb7165d7b952512",
    measurementId: "G-4YXFBRT7HC"
};

if (typeof firebase !== 'undefined') {
    if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    console.log('✅ Firebase initialisé !');
    console.log('📦 Projet :', firebase.app().options.projectId);
} else {
    console.error('❌ Firebase SDK non chargé');
}

let fbAuth = null;
let fbDb = null;

if (typeof firebase !== 'undefined') {
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    console.log('✅ Auth + Firestore prêts');
}

function getFbAuth() { return fbAuth; }
function getFbDb() { return fbDb; }
