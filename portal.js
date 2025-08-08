// Firebase config (will be replaced by Canvas runtime, or use fallback)
const defaultFirebaseConfig = {
  apiKey: "AIzaSyAEMOiOm_ksNO57NYp2sNh5va0y6Y40kR0",
  authDomain: "personal-reminder-app.firebaseapp.com",
  projectId: "personal-reminder-app",
  storageBucket: "personal-reminder-app.firebasestorage.app",
  messagingSenderId: "530943110596",
  appId: "1:530943110596:web:753349f5577bd39eeb4891",
  measurementId: "G-255K8FCD4J"
};

let firebaseConfig = defaultFirebaseConfig;

if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
        const canvasConfig = JSON.parse(__firebase_config);
        if (canvasConfig.projectId && canvasConfig.apiKey) {
            firebaseConfig = canvasConfig;
            console.log("Using Canvas-provided Firebase config for portal.");
        } else {
            console.warn("Canvas-provided Firebase config for portal is incomplete. Using default.");
        }
    } catch (e) {
        console.error("Error parsing Canvas-provided Firebase config for portal. Using default.", e);
    }
} else {
    console.warn("No Canvas-provided Firebase config for portal. Using default.");
}

if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing. Please ensure it's provided in firebaseConfig.");
    const errorMessage = "Error: Firebase API Key is missing. Please check console for details.";
    showConfirmationDialog(errorMessage, () => {});
    throw new Error("Firebase API Key is missing.");
}

// Firebase Init
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Authentication UI elements
const authFormsContainer = document.getElementById("auth-forms-container");
const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const signUpBtn = document.getElementById("auth-signup-btn");
const signInBtn = document.getElementById("auth-signin-btn");
const googleSignInBtn = document.getElementById("google-signin-btn");
const authStatus = document.getElementById("auth-status"); // New status element for the portal page

const toggleThemeBtn = document.getElementById("toggle-theme");
const resetThemeBtn = document.getElementById("reset-theme-btn");

// Loading Spinner element
const loadingSpinner = document.getElementById("loading-spinner");

// Confirmation Modal elements
const confirmationModal = document.getElementById("confirmation-modal");
const confirmationMessage = document.getElementById("confirmation-message");
const confirmYesBtn = document.getElementById("confirm-yes-btn");
const confirmNoBtn = document.getElementById("confirm-no-btn");
let onConfirmCallback = null;

// Function to show loading spinner
function showLoadingSpinner() {
  if (loadingSpinner) {
    loadingSpinner.classList.remove("hidden");
  }
}

// Function to hide loading spinner
function hideLoadingSpinner() {
  if (loadingSpinner) {
    loadingSpinner.classList.add("hidden");
  }
}

// Function to show confirmation dialog (reused from app.js)
function showConfirmationDialog(message, onConfirm) {
  confirmationMessage.textContent = message;
  onConfirmCallback = onConfirm;
  confirmationModal.classList.remove("hidden");
}

function hideConfirmationDialog() {
  confirmationModal.classList.add("hidden");
  onConfirmCallback = null;
}

if (confirmYesBtn) {
  confirmYesBtn.onclick = () => {
    if (onConfirmCallback) {
      onConfirmCallback(true);
    }
    hideConfirmationDialog();
  };
}

if (confirmNoBtn) {
  confirmNoBtn.onclick = () => {
    if (onConfirmCallback) {
      onConfirmCallback(false);
    }
    hideConfirmationDialog();
  };
}

// --- Theme Management (reused from app.js) ---
const THEME_STORAGE_KEY = 'user-theme';

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  updateThemeToggleButton(theme);
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeToggleButton(theme) {
  if (toggleThemeBtn) {
    toggleThemeBtn.textContent = theme === 'dark' ? '☀️' : '🌗';
    toggleThemeBtn.setAttribute('data-tooltip', `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`);
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    setTheme(getSystemTheme());
  }
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  if (!localStorage.getItem(THEME_STORAGE_KEY)) {
    setTheme(event.matches ? 'dark' : 'light');
  }
});

if (toggleThemeBtn) {
  toggleThemeBtn.onclick = () => {
    const currentTheme = document.body.dataset.theme;
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };
}

if (resetThemeBtn) {
  resetThemeBtn.onclick = () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    setTheme(getSystemTheme());
    console.log("Theme reset to system preference.");
  };
}

// --- Authentication Functions (moved here) ---
if (signUpBtn) {
  signUpBtn.onclick = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    showLoadingSpinner();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log("User signed up (Email/Password). Redirecting...");
      window.location.href = 'index.html'; // Redirect to calendar
    } catch (error) {
      console.error("Error signing up:", error.message);
      authStatus.textContent = `Error: ${error.message}`;
      showConfirmationDialog(`Sign Up Error: ${error.message}`, () => {});
    } finally {
      hideLoadingSpinner();
    }
  };
}

if (signInBtn) {
  signInBtn.onclick = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    showLoadingSpinner();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("User signed in (Email/Password). Redirecting...");
      window.location.href = 'index.html'; // Redirect to calendar
    } catch (error) {
      console.error("Error signing in:", error.message);
      authStatus.textContent = `Error: ${error.message}`;
      showConfirmationDialog(`Sign In Error: ${error.message}`, () => {});
    } finally {
      hideLoadingSpinner();
    }
  };
}

if (googleSignInBtn) {
  googleSignInBtn.onclick = async () => {
    const provider = new GoogleAuthProvider();
    showLoadingSpinner();
    try {
      await signInWithPopup(auth, provider);
      console.log("User signed in with Google. Redirecting...");
      window.location.href = 'index.html'; // Redirect to calendar
    } catch (error) {
      console.error("Error during Google Sign-In:", error.code, error.message);
      let errorMessage = `Google Sign-In Error: ${error.message}`;
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Google Sign-In popup was closed by the user.";
      }
      authStatus.textContent = `Error: ${errorMessage}`;
      showConfirmationDialog(errorMessage, () => {});
    } finally {
      hideLoadingSpinner();
    }
  };
}

// Check auth state on portal page load
document.addEventListener("DOMContentLoaded", async () => {
  initializeTheme(); // Initialize theme on portal page

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // If user is already logged in, redirect them directly to the main app
      console.log("User already authenticated on portal page. Redirecting to calendar.");
      window.location.href = 'index.html';
    } else {
      // If no user, try anonymous sign-in (for initial setup/storage capabilities)
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
            console.log("Portal: Signed in with custom token.");
        } else {
            await signInAnonymously(auth);
            console.log("Portal: Signed in anonymously.");
        }
        authStatus.textContent = "Please sign in to your account.";
      } catch (error) {
        console.error("Portal: Error during initial authentication (anonymous sign-in):", error);
        authStatus.textContent = `Authentication setup failed: ${error.message}`;
        showConfirmationDialog("Authentication setup failed. Please check console.", () => {});
      }
    }
  });
});
