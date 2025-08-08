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
    // You might want to display a user-friendly error message on the UI here
    // For now, we'll prevent further Firebase initialization
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
  createUserWithEmailAndPassword, // For Email/Password Sign Up
  signInWithEmailAndPassword,     // For Email/Password Sign In
  signOut,                        // For Sign Out
  GoogleAuthProvider,             // For Google Sign-In
  signInWithPopup                 // For Google Sign-In
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Initialize Firebase with the determined config
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let calendar;
let selectedEvent = null;
let userId = null; // To store the current user's ID
let isAuthReady = false; // Flag to indicate if authentication state has been determined

// Modal & form elements
const modal = document.getElementById("task-modal");
const form = document.getElementById("task-form");
const titleInput = document.getElementById("title");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const categoryInput = document.getElementById("category");
const colorPicker = document.getElementById("color-picker"); // New color picker input
const iconPicker = document.getElementById("icon-picker");   // New icon picker select
const deleteBtn = document.getElementById("delete-task-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const emptyCalendarMessage = document.getElementById("empty-calendar-message"); // Empty state message

// Authentication UI elements
const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const signUpBtn = document.getElementById("auth-signup-btn");
const signInBtn = document.getElementById("auth-signin-btn");
const googleSignInBtn = document.getElementById("google-signin-btn");
const signOutBtn = document.getElementById("auth-signout-btn");
const authStatusDiv = document.getElementById("auth-status");
const toggleThemeBtn = document.getElementById("toggle-theme");

// Function to toggle modal visibility
function toggleModal(show) {
  modal.classList.toggle("hidden", !show);
  // Reset form and selected event when modal is hidden
  if (!show) {
    form.reset();
    selectedEvent = null;
    colorPicker.value = "#007bff"; // Reset color picker to default primary
    iconPicker.value = ""; // Reset icon picker
  }
}

// Function to load events from Firebase
async function loadEvents(fetchInfo, successCallback, failureCallback) {
  // Only attempt to load events if authentication is ready and userId is available
  if (!isAuthReady || !userId) {
    console.log("Authentication not ready or userId not set. Returning empty events.");
    emptyCalendarMessage.classList.remove("hidden"); // Show empty message if not authenticated
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
        title: data.icon ? `${data.icon} ${data.title}` : data.title, // Prepend icon to title
        start: data.start,
        end: data.end,
        extendedProps: {
          category: data.category,
          originalTitle: data.title, // Store original title without icon
          color: data.color || null, // Store custom color
          icon: data.icon || null    // Store custom icon
        },
        // Use custom color if available, otherwise fall back to category class
        backgroundColor: data.color || '',
        borderColor: data.color || '',
        classNames: data.color ? [] : [`fc-event-${data.category}`] // Only apply category class if no custom color
      };
    });
    console.log("Events loaded:", events);

    // Show/hide empty message based on loaded events
    if (events.length === 0) {
      emptyCalendarMessage.classList.remove("hidden");
    } else {
      emptyCalendarMessage.classList.add("hidden");
    }

    successCallback(events);
  } catch (error) {
    console.error("Error loading events:", error);
    failureCallback(error);
    emptyCalendarMessage.classList.remove("hidden"); // Show empty message on error
  }
}

// Function to save (add or edit) an event to Firebase
form.onsubmit = async e => {
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
    color: colorPicker.value, // Save custom color
    icon: iconPicker.value,   // Save custom icon
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

    toggleModal(false);
    calendar.refetchEvents();
  } catch (error) {
    console.error("Error saving event:", error);
  }
};

// Function to delete an event from Firebase
deleteBtn.onclick = async () => {
  if (!selectedEvent || !userId) {
    console.error("No event selected or user not authenticated. Cannot delete event.");
    return;
  }

  try {
    await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, selectedEvent.id));
    console.log("Event deleted:", selectedEvent.id);
    toggleModal(false);
    calendar.refetchEvents();
  } catch (error) {
    console.error("Error deleting event:", error);
  }
};

// Modal cancel button click handler
closeModalBtn.onclick = () => toggleModal(false);

// --- Theme Management ---
const THEME_STORAGE_KEY = 'user-theme'; // Key for localStorage

// Function to set the theme and save to localStorage
function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  console.log("Theme set to:", theme);
}

// Function to get the preferred system theme
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Initialize theme on page load
function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme) {
    // Use saved theme if available
    setTheme(savedTheme);
  } else {
    // Otherwise, use system preference
    setTheme(getSystemTheme());
  }
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  // Only update if no explicit theme is saved by the user
  if (!localStorage.getItem(THEME_STORAGE_KEY)) {
    setTheme(event.matches ? 'dark' : 'light');
  }
});

// Theme toggle button click handler
if (toggleThemeBtn) {
  toggleThemeBtn.onclick = () => {
    const currentTheme = document.body.dataset.theme;
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };
}


// --- Authentication Functions ---

// Handle User Sign Up (Email/Password)
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

// Handle User Sign In (Email/Password)
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

// Handle Google Sign In
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

// Handle User Sign Out
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
      localStorage.removeItem(THEME_STORAGE_KEY); // Remove user's manual theme preference
      setTheme(getSystemTheme()); // Revert to system theme on sign out
    } catch (error) {
      console.error("Error signing out:", error.message);
      authStatusDiv.textContent = `Sign Out Error: ${error.message}`;
    }
  };
}

// Initialize FullCalendar and Theme when the DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded. Initializing calendar and theme...");

  // Initialize Theme first
  initializeTheme();

  const calendarEl = document.getElementById("calendar");

  // Initialize FullCalendar instance
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth", // Display month view initially
    selectable: true, // Allow date selection
    editable: true, // Enable drag-and-drop and resizing
    height: "auto", // Calendar height adjusts to content
    events: loadEvents, // Function to load events from Firebase
    headerToolbar: { // New header toolbar for view switching
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay' // Added week and day views
    },
    slotMinTime: '06:00:00', // Start day at 6 AM
    slotMaxTime: '22:00:00', // End day at 10 PM
    eventDidMount: function(info) { // Custom rendering for events (e.g., custom color)
      if (info.event.extendedProps.color) {
        info.el.style.backgroundColor = info.event.extendedProps.color;
        info.el.style.borderColor = info.event.extendedProps.color;
        info.el.style.color = 'white'; // Ensure text is readable on custom color
      }
      // If you want to add the icon dynamically to the event title element
      // This is handled by prepending the icon in loadEvents now.
    },
    // Handle date clicks to open the modal for adding new events
    dateClick: info => {
      console.log("Date clicked:", info.dateStr);
      startInput.value = info.dateStr + "T00:00"; // Set start time to midnight
      endInput.value = info.dateStr + "T01:00";   // Set end time to 1 AM
      colorPicker.value = "#007bff"; // Set default color for new event
      iconPicker.value = ""; // No default icon
      toggleModal(true); // Show the modal
    },
    // Handle event clicks to open the modal for editing/deleting events
    eventClick: info => {
      console.log("Event clicked:", info.event.id, info.event.title);
      selectedEvent = info.event; // Store the clicked event
      titleInput.value = info.event.extendedProps.originalTitle; // Use original title
      startInput.value = info.event.start.toISOString().slice(0, 16);
      endInput.value = info.event.end?.toISOString().slice(0, 16) || "";
      categoryInput.value = info.event.extendedProps.category;
      colorPicker.value = info.event.extendedProps.color || "#007bff"; // Set existing color or default
      iconPicker.value = info.event.extendedProps.icon || ""; // Set existing icon or none
      toggleModal(true); // Show the modal
    },
    // Handle event drop (drag-and-drop)
    eventDrop: async function(info) {
      console.log("Event dropped:", info.event.id, info.event.start, info.event.end);
      if (!userId) {
        console.error("User not authenticated. Cannot update event on drop.");
        info.revert(); // Revert the event to its original position
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
        info.revert(); // Revert if update fails
      }
    },
    // Handle event resize
    eventResize: async function(info) {
      console.log("Event resized:", info.event.id, info.event.start, info.event.end);
      if (!userId) {
        console.error("User not authenticated. Cannot update event on resize.");
        info.revert(); // Revert the event
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
        info.revert(); // Revert if update fails
      }
    }
  });

  // Render the calendar immediately after instantiation
  calendar.render();
  console.log("Calendar rendered.");

  // Authenticate user with Firebase and then refetch events
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
