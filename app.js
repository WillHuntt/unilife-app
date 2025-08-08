// Firebase config (will be replaced by Canvas runtime, or use fallback)
// This is the default configuration, using the values you provided initially.
const defaultFirebaseConfig = {
  apiKey: "AIzaSyAEMOiOm_ksNO57NYp2sNh5va0y6Y40kR0", // <-- VERIFY THIS API KEY IN YOUR FIREBASE CONSOLE
  authDomain: "personal-reminder-app.firebaseapp.com",
  projectId: "personal-reminder-app",
  storageBucket: "personal-reminder-app.firebasestorage.app",
  messagingSenderId: "530943110596",
  appId: "1:530943110596:web:753349f5577bd39eeb4891",
  measurementId: "G-255K8FCD4J"
};

let firebaseConfig = defaultFirebaseConfig; // Start with the default config

// Check if Canvas environment provides a Firebase config
if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
        const canvasConfig = JSON.parse(__firebase_config);
        // Validate if the Canvas-provided config has essential properties
        if (canvasConfig.projectId && canvasConfig.apiKey) {
            firebaseConfig = canvasConfig; // Use Canvas config if valid
            console.log("Using Canvas-provided Firebase config.");
        } else {
            console.warn("Canvas-provided Firebase config is incomplete (missing projectId or apiKey). Using default config.");
        }
    } catch (e) {
        console.error("Error parsing Canvas-provided Firebase config. Using default config.", e);
    }
} else {
    console.warn("No Canvas-provided Firebase config found. Using default config.");
}

// Crucial check: Ensure apiKey is present before initializing Firebase
if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing. Please ensure it's provided in firebaseConfig.");
    alert("Error: Firebase API Key is missing. Please check console for details.");
    throw new Error("Firebase API Key is missing."); // Stop script execution
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Firebase Init
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Initialize Firebase with the determined config
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let calendar;
let selectedEvent = null;
let userId = null;
let isAuthReady = false;

// Modal & form elements
const taskModal = document.getElementById("task-modal"); // Renamed to avoid conflict
const taskForm = document.getElementById("task-form");   // Renamed
const titleInput = document.getElementById("title");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const categoryInput = document.getElementById("category");
const colorPicker = document.getElementById("color-picker"); // New color picker input
const iconPicker = document.getElementById("icon-picker");   // New icon picker select
const deleteBtn = document.getElementById("delete-task-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const emptyCalendarMessage = document.getElementById("empty-calendar-message");

// Authentication UI elements
const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const signUpBtn = document.getElementById("auth-signup-btn");
const signInBtn = document.getElementById("auth-signin-btn");
const googleSignInBtn = document.getElementById("google-signin-btn");
const signOutBtn = document.getElementById("auth-signout-btn");
const authStatusDiv = document.getElementById("auth-status");
const toggleThemeBtn = document.getElementById("toggle-theme");
const resetThemeBtn = document.getElementById("reset-theme-btn");

// Event Popover elements
const eventPopover = document.getElementById("event-popover");
const popoverTitle = document.getElementById("popover-title");
const popoverTime = document.getElementById("popover-time");
const popoverCategory = document.getElementById("popover-category");
const popoverEditBtn = document.getElementById("popover-edit-btn");
const popoverDeleteBtn = document.getElementById("popover-delete-btn");
const popoverCloseBtn = document.getElementById("popover-close-btn");

// Confirmation Modal elements
const confirmationModal = document.getElementById("confirmation-modal");
const confirmationMessage = document.getElementById("confirmation-message");
const confirmYesBtn = document.getElementById("confirm-yes-btn");
const confirmNoBtn = document.getElementById("confirm-no-btn");
let onConfirmCallback = null; // Callback for confirmation dialog

// Function to toggle task modal visibility
function toggleTaskModal(show) {
  taskModal.classList.toggle("hidden", !show);
  if (!show) {
    taskForm.reset();
    selectedEvent = null;
    colorPicker.value = "#3498db"; // Reset color picker to default primary
    iconPicker.value = ""; // Reset icon picker
    hidePopover(); // Ensure popover is hidden when task modal opens/closes
  }
}

// Function to toggle confirmation modal visibility
function showConfirmationDialog(message, onConfirm) {
  confirmationMessage.textContent = message;
  onConfirmCallback = onConfirm; // Store the callback
  confirmationModal.classList.remove("hidden");
  // Hide task modal if it's open
  if (!taskModal.classList.contains("hidden")) {
    taskModal.classList.add("hidden");
  }
  hidePopover(); // Hide popover if it's open
}

function hideConfirmationDialog() {
  confirmationModal.classList.add("hidden");
  onConfirmCallback = null;
}

// Confirmation button handlers
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


// Function to show event popover
function showPopover(event, jsEvent) {
  selectedEvent = event; // Set selected event for popover actions
  popoverTitle.textContent = event.extendedProps.originalTitle; // Use original title
  popoverTime.textContent = `${event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${event.end ? event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No end time'}`;
  popoverCategory.textContent = `Category: ${event.extendedProps.category}`;

  // Position the popover near the clicked event
  const rect = jsEvent.target.getBoundingClientRect();
  eventPopover.style.top = `${rect.bottom + window.scrollY + 10}px`;
  eventPopover.style.left = `${rect.left + window.scrollX}px`;
  eventPopover.classList.remove("hidden");
}

// Function to hide event popover
function hidePopover() {
  eventPopover.classList.add("hidden");
  selectedEvent = null; // Clear selected event when popover is hidden
}

// Popover button handlers
if (popoverEditBtn) {
  popoverEditBtn.onclick = () => {
    if (selectedEvent) {
      titleInput.value = selectedEvent.extendedProps.originalTitle;
      startInput.value = selectedEvent.start.toISOString().slice(0, 16);
      endInput.value = selectedEvent.end?.toISOString().slice(0, 16) || "";
      categoryInput.value = selectedEvent.extendedProps.category;
      colorPicker.value = selectedEvent.extendedProps.color || "#3498db";
      iconPicker.value = selectedEvent.extendedProps.icon || "";
      toggleTaskModal(true); // Open the main task modal for editing
    }
    hidePopover();
  };
}

if (popoverDeleteBtn) {
  popoverDeleteBtn.onclick = () => {
    showConfirmationDialog("Are you sure you want to delete this event?", async (confirmed) => {
      if (confirmed && selectedEvent) {
        await deleteEvent(selectedEvent.id); // Call delete function
      }
      hidePopover();
    });
  };
}

if (popoverCloseBtn) {
  popoverCloseBtn.onclick = () => hidePopover();
}

// Close popover if clicking outside it
document.addEventListener('click', (e) => {
  if (!eventPopover.classList.contains('hidden') &&
      !eventPopover.contains(e.target) &&
      !e.target.closest('.fc-event')) { // Don't hide if clicking on another event
    hidePopover();
  }
});


// Function to load events from Firebase
async function loadEvents(fetchInfo, successCallback, failureCallback) {
  if (!isAuthReady || !userId) {
    console.log("Authentication not ready or userId not set. Returning empty events.");
    emptyCalendarMessage.classList.remove("hidden");
    successCallback([]);
    return;
  }

  try {
    console.log(`Attempting to load events for userId: ${userId}`);
    const userEventsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/events`);
    const userEventsQuery = query(userEventsCollectionRef);
    const snapshot = await getDocs(userEventsQuery);
    const events = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.icon ? `${data.icon} ${data.title}` : data.title,
        start: data.start,
        end: data.end,
        extendedProps: {
          category: data.category,
          originalTitle: data.title,
          color: data.color || null,
          icon: data.icon || null
        },
        backgroundColor: data.color || '',
        borderColor: data.color || '',
        classNames: data.color ? [] : [`fc-event-${data.category}`]
      };
    });
    console.log("Events loaded:", events);

    if (events.length === 0) {
      emptyCalendarMessage.classList.remove("hidden");
    } else {
      emptyCalendarMessage.classList.add("hidden");
    }

    successCallback(events);
  } catch (error) {
    console.error("Error loading events:", error);
    failureCallback(error);
    emptyCalendarMessage.classList.remove("hidden");
  }
}

// Function to save (add or edit) an event to Firebase
taskForm.onsubmit = async e => {
  e.preventDefault();

  if (!userId) {
    console.error("User not authenticated. Cannot save event.");
    return;
  }

  const eventData = {
    title: titleInput.value,
    start: startInput.value,
    end: endInput.value,
    category: categoryInput.value,
    color: colorPicker.value,
    icon: iconPicker.value,
    userId: userId
  };

  try {
    if (selectedEvent) {
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, selectedEvent.id), eventData);
      console.log("Event updated:", selectedEvent.id);
    } else {
      const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/events`), eventData);
      console.log("Event added with ID:", docRef.id);
    }

    toggleTaskModal(false);
    calendar.refetchEvents();
  } catch (error) {
    console.error("Error saving event:", error);
  }
};

// Function to delete an event from Firebase (extracted for reuse)
async function deleteEvent(eventId) {
  if (!userId) {
    console.error("User not authenticated. Cannot delete event.");
    return;
  }
  try {
    await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, eventId));
    console.log("Event deleted:", eventId);
    calendar.refetchEvents();
  } catch (error) {
    console.error("Error deleting event:", error);
  }
}

// Original delete button handler (now uses confirmation dialog)
if (deleteBtn) {
  deleteBtn.onclick = () => {
    if (selectedEvent) {
      showConfirmationDialog("Are you sure you want to delete this event?", async (confirmed) => {
        if (confirmed) {
          await deleteEvent(selectedEvent.id);
          toggleTaskModal(false); // Close task modal after deletion
        }
      });
    }
  };
}

// Modal cancel button click handler
if (closeModalBtn) {
  closeModalBtn.onclick = () => toggleTaskModal(false);
}


// --- Theme Management ---
const THEME_STORAGE_KEY = 'user-theme';

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  updateThemeToggleButton(theme);
  console.log("Theme set to:", theme);
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
    setTheme(newTheme); // This will save the new preference
  };
}

if (resetThemeBtn) {
  resetThemeBtn.onclick = () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    setTheme(getSystemTheme());
    console.log("Theme reset to system preference.");
  };
}


// --- Authentication Functions ---
if (signUpBtn) {
  signUpBtn.onclick = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User signed up (Email/Password):", userCredential.user.uid);
    } catch (error) {
      console.error("Error signing up:", error.message);
      authStatusDiv.textContent = `Sign Up Error: ${error.message}`;
    }
  };
}

if (signInBtn) {
  signInBtn.onclick = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("User signed in (Email/Password):", userCredential.user.uid);
    } catch (error) {
      console.error("Error signing in:", error.message);
      authStatusDiv.textContent = `Sign In Error: ${error.message}`;
    }
  };
}

if (googleSignInBtn) {
  googleSignInBtn.onclick = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      const user = result.user;
      console.log("User signed in with Google:", user.uid, user.displayName);
    } catch (error) {
      console.error("Error during Google Sign-In:", error.code, error.message);
      authStatusDiv.textContent = `Google Sign-In Error: ${error.message}`;
      if (error.code === 'auth/popup-closed-by-user') {
        console.log("Google Sign-In popup was closed by the user.");
      }
    }
  };
}

if (signOutBtn) {
  signOutBtn.onclick = async () => {
    try {
      await signOut(auth);
      console.log("User signed out.");
      userId = null;
      isAuthReady = false;
      calendar.refetchEvents();
      authStatusDiv.textContent = "Not signed in.";
      emailInput.value = "";
      passwordInput.value = "";
      localStorage.removeItem(THEME_STORAGE_KEY);
      setTheme(getSystemTheme());
    } catch (error) {
      console.error("Error signing out:", error.message);
      authStatusDiv.textContent = `Sign Out Error: ${error.message}`;
    }
  };
}

// Initialize FullCalendar and Theme when the DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded. Initializing calendar and theme...");

  initializeTheme();

  const calendarEl = document.getElementById("calendar");

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    editable: true, // Enabled for drag-and-drop/resizing
    height: "auto",
    events: loadEvents,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    eventDidMount: function(info) {
      // Custom color is handled by backgroundColor/borderColor directly
      // Icon is prepended in loadEvents
    },
    dateClick: info => {
      console.log("Date clicked:", info.dateStr);
      selectedEvent = null; // Ensure no event is pre-selected for new entry
      titleInput.value = ""; // Clear title
      startInput.value = info.dateStr + "T00:00";
      endInput.value = info.dateStr + "T01:00";
      categoryInput.value = "university"; // Default category
      colorPicker.value = "#3498db"; // Default color
      iconPicker.value = ""; // No default icon
      toggleTaskModal(true);
    },
    eventClick: info => {
      // Hide popover if another event is clicked
      if (selectedEvent && selectedEvent.id === info.event.id) {
        hidePopover(); // Clicked same event, hide popover/modal
      } else {
        showPopover(info.event, info.jsEvent); // Show popover for this event
      }
    },
    eventDrop: async function(info) {
      console.log("Event dropped:", info.event.id, info.event.start, info.event.end);
      if (!userId) {
        console.error("User not authenticated. Cannot update event on drop.");
        info.revert();
        return;
      }
      try {
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, info.event.id), {
          start: info.event.start.toISOString(),
          end: info.event.end ? info.event.end.toISOString() : null
        });
        console.log("Event updated in Firestore after drop.");
      } catch (error) {
        console.error("Error updating event on drop:", error);
        info.revert();
      }
    },
    eventResize: async function(info) {
      console.log("Event resized:", info.event.id, info.event.start, info.event.end);
      if (!userId) {
        console.error("User not authenticated. Cannot update event on resize.");
        info.revert();
        return;
      }
      try {
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, info.event.id), {
          start: info.event.start.toISOString(),
          end: info.event.end ? info.event.end.toISOString() : null
        });
        console.log("Event updated in Firestore after resize.");
      } catch (error) {
        console.error("Error updating event on resize:", error);
        info.revert();
      }
    }
  });

  calendar.render();
  console.log("Calendar rendered.");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      userId = user.uid;
      isAuthReady = true;
      console.log("User authenticated:", userId);
      authStatusDiv.textContent = `Signed in as: ${user.email || user.displayName || user.uid}`;
      calendar.refetchEvents();
    } else {
      try {
        console.log("No user signed in. Attempting anonymous sign-in...");
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
          console.log("Signed in with custom token.");
        } else {
          await signInAnonymously(auth);
          console.log("Signed in anonymously.");
        }
      } catch (error) {
        console.error("Error during initial authentication:", error);
        authStatusDiv.textContent = "Authentication failed. Please check console.";
      }
    }
  });
});
