// sounds.js
// Gestion centralisée des sons du casino.

const IS_IN_SUBFOLDER = /\/(roulette|machineasous|blackjack|baccarat|craps|videopoker)\//i.test(window.location.pathname);
const SOUND_BASE = IS_IN_SUBFOLDER ? '../sons/' : 'sons/';

// ============================================================
//   MUSIQUE D'AMBIANCE
// ============================================================
function getAmbientVolume() {
    const v = parseFloat(localStorage.getItem('casino_ambient_volume') || '0.4');
    return isNaN(v) ? 0.4 : v;
}
function setAmbientVolume(v) {
    localStorage.setItem('casino_ambient_volume', v.toString());
    if (window.__casinoAmbientAudio) window.__casinoAmbientAudio.volume = v;
    updateAmbientUI();
}
function isAmbientMuted() {
    return localStorage.getItem('casino_ambient_muted') === 'true';
}
function setAmbientMuted(muted) {
    localStorage.setItem('casino_ambient_muted', muted ? 'true' : 'false');
    if (window.__casinoAmbientAudio) window.__casinoAmbientAudio.muted = muted;
    updateAmbientUI();
}
function initAmbientSound() {
    if (window.__casinoAmbientAudio) {
        const a = window.__casinoAmbientAudio;
        a.volume = getAmbientVolume();
        a.muted = isAmbientMuted();
        if (a.paused) a.play().catch(() => {});
        return;
    }
    const audio = new Audio(SOUND_BASE + 'sonambiance.mp3');
    audio.loop = true;
    audio.volume = getAmbientVolume();
    audio.muted = isAmbientMuted();
    audio.preload = 'auto';
    setInterval(() => {
        if (!audio.paused && audio.readyState >= 2) {
            try { sessionStorage.setItem('casino_ambient_time', audio.currentTime.toString()); } catch (e) {}
        }
    }, 30);
    const saveNow = () => {
        if (!audio.paused) {
            try { sessionStorage.setItem('casino_ambient_time', audio.currentTime.toString()); } catch (e) {}
        }
    };
    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveNow();
    });
    const onReady = () => {
        const saved = parseFloat(sessionStorage.getItem('casino_ambient_time') || '0');
        if (saved > 0.1 && audio.duration && saved < audio.duration - 0.1) {
            try { audio.currentTime = saved; } catch (e) {}
        }
        const p = audio.play();
        if (p && p.catch) {
            p.catch(() => {
                const tryPlay = () => {
                    audio.play().catch(() => {});
                    document.removeEventListener('click', tryPlay);
                    document.removeEventListener('touchstart', tryPlay);
                    document.removeEventListener('keydown', tryPlay);
                };
                document.addEventListener('click', tryPlay, { once: true });
                document.addEventListener('touchstart', tryPlay, { once: true });
                document.addEventListener('keydown', tryPlay, { once: true });
            });
        }
    };
    if (audio.readyState >= 1) onReady();
    else {
        audio.addEventListener('loadedmetadata', onReady, { once: true });
        audio.load();
    }
    window.__casinoAmbientAudio = audio;
}
function playAmbientSound() {
    const a = window.__casinoAmbientAudio;
    if (!a) { initAmbientSound(); return; }
    a.volume = getAmbientVolume();
    a.muted = isAmbientMuted();
    if (a.paused) a.play().catch(() => {});
}
function stopAmbientSound() {
    if (window.__casinoAmbientAudio) window.__casinoAmbientAudio.pause();
}
function updateAmbientUI() {
    const slider = document.getElementById('ambient-volume');
    const percent = document.getElementById('ambient-percent');
    const toggle = document.getElementById('ambient-toggle');
    const statusText = document.getElementById('music-status-text');
    const icon = document.getElementById('music-icon');
    const label = document.getElementById('music-label');
    const volumeWrap = document.getElementById('volume-wrap');
    const muted = isAmbientMuted();
    const vol = getAmbientVolume();
    if (slider) slider.value = vol;
    if (percent) percent.textContent = Math.round(vol * 100) + '%';
    if (toggle) toggle.checked = !muted;
    if (statusText) statusText.textContent = muted ? 'Musique coupée' : 'Musique activée';
    if (icon) icon.textContent = muted ? '🔇' : '🎵';
    if (label) label.classList.toggle('active', !muted);
    if (volumeWrap) volumeWrap.classList.toggle('disabled', muted);
}
function setupProfileMusicControls() {
    const slider = document.getElementById('ambient-volume');
    const toggle = document.getElementById('ambient-toggle');
    if (slider) {
        slider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            setAmbientVolume(v);
            if (v > 0 && isAmbientMuted()) setAmbientMuted(false);
            if (v === 0) setAmbientMuted(true);
            updateAmbientUI();
        });
    }
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            setAmbientMuted(!e.target.checked);
            if (e.target.checked) playAmbientSound();
            updateAmbientUI();
        });
    }
    updateAmbientUI();
}

// ============================================================
//   AUTRES SONS
// ============================================================
let cashRegisterSound = null;
function initCashRegisterSound() {
    if (cashRegisterSound) return;
    try {
        cashRegisterSound = new Audio(SOUND_BASE + 'cash-register.mp3');
        cashRegisterSound.volume = 0.8;
        cashRegisterSound.load();
    } catch (e) {}
}
function playCashRegister() {
    try {
        initCashRegisterSound();
        if (!cashRegisterSound) return;
        cashRegisterSound.currentTime = 0;
        cashRegisterSound.volume = 0.8;
        const p = cashRegisterSound.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
}

let diceSound = null;
function initDiceSound() {
    if (diceSound) return;
    try {
        diceSound = new Audio(SOUND_BASE + 'u_qpfzpydtro-dice-142528.mp3');
        diceSound.loop = true;
        diceSound.volume = 0.6;
        diceSound.load();
    } catch (e) {}
}
function playDiceSound() {
    try {
        initDiceSound();
        if (!diceSound) return;
        diceSound.currentTime = 0;
        diceSound.volume = 0.6;
        const p = diceSound.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
}
function stopDiceSound() {
    try {
        if (!diceSound) return;
        if (!diceSound.paused) {
            const fade = setInterval(() => {
                if (diceSound.volume > 0.05) diceSound.volume -= 0.08;
                else { clearInterval(fade); diceSound.pause(); diceSound.currentTime = 0; diceSound.volume = 0.6; }
            }, 30);
        }
    } catch (e) {}
}

let slotSound = null;
function initSlotSound() {
    if (slotSound) return;
    try {
        slotSound = new Audio(SOUND_BASE + 'floraphonic-playful-casino-slot-machine-jackpot-3-183921.mp3');
        slotSound.loop = true;
        slotSound.volume = 0.9;
        slotSound.preload = 'auto';
        slotSound.load();
    } catch (e) {}
}
function playSlotSound() {
    try {
        initSlotSound();
        if (!slotSound) return;
        slotSound.volume = 0.9;
        const startPlaying = () => {
            slotSound.currentTime = 0;
            const p = slotSound.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        };
        if (slotSound.readyState >= 1) startPlaying();
        else { slotSound.addEventListener('loadedmetadata', startPlaying, { once: true }); slotSound.load(); }
    } catch (e) {}
}
function stopSlotSound() {
    try {
        if (!slotSound) return;
        if (!slotSound.paused) {
            const fade = setInterval(() => {
                if (slotSound.volume > 0.05) slotSound.volume -= 0.08;
                else { clearInterval(fade); slotSound.pause(); slotSound.currentTime = 0; slotSound.volume = 0.9; }
            }, 30);
        }
    } catch (e) {}
}

let slotWinSound = null;
function initSlotWinSound() {
    if (slotWinSound) return;
    try {
        slotWinSound = new Audio(SOUND_BASE + 'floraphonic-playful-casino-slot-machine-bonus-2-183919.mp3');
        slotWinSound.volume = 0.9;
        slotWinSound.load();
    } catch (e) {}
}
function playSlotWinSound() {
    try {
        initSlotWinSound();
        if (!slotWinSound) return;
        slotWinSound.currentTime = 0;
        slotWinSound.volume = 0.9;
        const p = slotWinSound.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
}

let diamondSound = null;
function initDiamondSound() {
    if (diamondSound) return;
    try {
        diamondSound = new Audio(SOUND_BASE + '3diamants.mp3');
        diamondSound.volume = 1.0;
        diamondSound.load();
    } catch (e) {}
}
function playDiamondSound() {
    try {
        initDiamondSound();
        if (!diamondSound) return;
        diamondSound.currentTime = 0;
        diamondSound.volume = 1.0;
        const p = diamondSound.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
}

let cardSound = null;
function initCardSound() {
    if (cardSound) return;
    try {
        cardSound = new Audio(SOUND_BASE + 'oxidvideos-taking-playing-card-2-522516.mp3');
        cardSound.volume = 0.6;
        cardSound.load();
    } catch (e) {}
}
function playCardSound() {
    try {
        initCardSound();
        if (!cardSound) return;
        const clone = cardSound.cloneNode();
        clone.volume = 0.6;
        const p = clone.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
}

// ============================================================
//   SON DE TIRAGE DU COFFRE (spin) — volume très réduit
// ============================================================
let chestSpinSound = null;
const CHEST_SPIN_VOLUME = 0.15;   // ✅ Volume réduit (était 0.35)
const CHEST_SPIN_RATE_START = 1.6;
const CHEST_SPIN_RATE_END = 0.35;

function initChestSpinSound() {
    if (chestSpinSound) return;
    try {
        chestSpinSound = new Audio(SOUND_BASE + 'spinsound.mp3');
        chestSpinSound.loop = true;
        chestSpinSound.volume = CHEST_SPIN_VOLUME;
        chestSpinSound.preload = 'auto';
        chestSpinSound.addEventListener('error', () => {
            console.warn('⚠️ Son spinsound introuvable');
        });
        chestSpinSound.load();
    } catch (e) {
        console.warn('Erreur init son spin :', e);
    }
}

function playChestSpinSound() {
    try {
        initChestSpinSound();
        if (!chestSpinSound) return;
        chestSpinSound.pause();
        chestSpinSound.currentTime = 0;
        chestSpinSound.playbackRate = CHEST_SPIN_RATE_START;
        chestSpinSound.volume = CHEST_SPIN_VOLUME;
        const p = chestSpinSound.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
        console.log('Erreur son spin :', e);
    }
}

function setChestSpinRate(rate) {
    if (!chestSpinSound) return;
    try {
        chestSpinSound.playbackRate = Math.max(CHEST_SPIN_RATE_END, Math.min(CHEST_SPIN_RATE_START, rate));
    } catch (e) {}
}

function stopChestSpinSound() {
    try {
        if (!chestSpinSound) return;
        if (!chestSpinSound.paused) {
            const startVol = chestSpinSound.volume;
            const steps = 12;
            let i = 0;
            const fade = setInterval(() => {
                i++;
                chestSpinSound.volume = startVol * (1 - i / steps);
                if (i >= steps) {
                    clearInterval(fade);
                    chestSpinSound.pause();
                    chestSpinSound.currentTime = 0;
                    chestSpinSound.volume = CHEST_SPIN_VOLUME;
                    chestSpinSound.playbackRate = CHEST_SPIN_RATE_START;
                }
            }, 20);
        }
    } catch (e) {}
}

// ============================================================
//   PRÉCHARGEMENT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initCashRegisterSound();
    initDiceSound();
    initSlotSound();
    initSlotWinSound();
    initDiamondSound();
    initCardSound();
    initChestSpinSound();

    initAmbientSound();
    setupProfileMusicControls();
});
