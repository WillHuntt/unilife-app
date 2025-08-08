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
    // Using a custom modal/message box instead of alert()
    const errorMessage = "Error: Firebase API Key is missing. Please check console for details.";
    showConfirmationDialog(errorMessage, () => {}); // Show error, no action on confirm
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
let currentEvents = []; // Store the fetched events for the dashboard

// Modal & form elements
const taskModal = document.getElementById("task-modal");
const taskForm = document.getElementById("task-form");
const titleInput = document.getElementById("title");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const categoryInput = document.getElementById("category");
const notesInput = document.getElementById("notes"); // Notes input
const recurrenceInput = document.getElementById("recurrence"); // New recurrence input
const colorPicker = document.getElementById("color-picker");
const iconPicker = document.getElementById("icon-picker");
const deleteBtn = document.getElementById("delete-task-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const emptyCalendarMessage = document.getElementById("empty-calendar-message");

// Authentication UI elements
const authFormsContainer = document.getElementById("auth-forms-container");
const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const signUpBtn = document.getElementById("auth-signup-btn");
const signInBtn = document.getElementById("auth-signin-btn");
const googleSignInBtn = document.getElementById("google-signin-btn");
const userInfoDisplay = document.getElementById("user-info-display");
const displayUserEmail = document.getElementById("display-user-email");
const signOutBtnTop = document.getElementById("auth-signout-btn-top");

const toggleThemeBtn = document.getElementById("toggle-theme");
const resetThemeBtn = document.getElementById("reset-theme-btn");

// Today Dashboard elements
const todayDashboard = document.getElementById("today-dashboard");
const todayEventsList = document.getElementById("today-events-list");
const noTodayEventsMessage = document.getElementById("no-today-events");

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

// Function to toggle task modal visibility
function toggleTaskModal(show) {
  taskModal.classList.toggle("hidden", !show);
  if (!show) {
    // ONLY reset form and selectedEvent when closing the modal
    taskForm.reset();
    selectedEvent = null; // Reset selectedEvent when closing the modal
    colorPicker.value = "#3498db";
    iconPicker.value = "";
    recurrenceInput.value = "none"; // Reset recurrence
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

// Function to load events from Firebase
async function loadEvents(fetchInfo, successCallback, failureCallback) {
  if (!isAuthReady || !userId) {
    console.log("Authentication not ready or userId not set. Returning empty events.");
    emptyCalendarMessage.classList.remove("hidden");
    successCallback([]);
    return;
  }

  showLoadingSpinner(); // Show spinner before fetching

  try {
    console.log(`Attempting to load events for userId: ${userId}`);
    const userEventsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/events`);
    const userEventsQuery = query(userEventsCollectionRef);
    const snapshot = await getDocs(userEventsQuery);
    const fetchedEvents = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Firestore document ID
        title: data.title,
        start: data.start,
        end: data.end,
        extendedProps: {
          category: data.category,
          originalTitle: data.title,
          notes: data.notes || '',
          color: data.color || null,
          icon: data.icon || null,
          recurrence: data.recurrence || 'none' // Load recurrence
        }
      };
    });

    // Generate recurring events for display within the current view
    const allCalendarEvents = [];
    const viewStart = fetchInfo.start; // FullCalendar's current view start
    const viewEnd = fetchInfo.end;   // FullCalendar's current view end

    fetchedEvents.forEach(event => {
      allCalendarEvents.push({
        id: event.id,
        title: event.extendedProps.icon ? `${event.extendedProps.icon} ${event.title}` : event.title,
        start: event.start,
        end: event.end,
        extendedProps: event.extendedProps,
        backgroundColor: event.extendedProps.color || '',
        borderColor: event.extendedProps.color || '',
        classNames: event.extendedProps.color ? [] : [`fc-event-${event.extendedProps.category}`]
      });

      if (event.extendedProps.recurrence !== 'none') {
        let currentDate = new Date(event.start);
        const originalDuration = event.end ? new Date(event.end).getTime() - new Date(event.start).getTime() : 0;

        // Loop to generate future occurrences within a reasonable range (e.g., this view + 1 month)
        // Adjust loop conditions to cover the current view plus some buffer
        const maxRecurrenceDate = new Date(viewEnd);
        maxRecurrenceDate.setMonth(maxRecurrenceDate.getMonth() + 1); // Generate for one month beyond current view

        while (currentDate.getTime() <= maxRecurrenceDate.getTime()) {
          let newStartDate = new Date(currentDate);
          let newEndDate = originalDuration > 0 ? new Date(newStartDate.getTime() + originalDuration) : null;

          // Only add event if it falls within the fetchInfo date range or buffer
          if (newStartDate.getTime() >= viewStart.getTime() && newStartDate.getTime() < maxRecurrenceDate.getTime()) {
            // Check if this occurrence is the original event or a generated one
            // We want to skip adding the original event here if it's already added above
            // This is a simplified check, assuming the `id` for generated instances is different
            if (newStartDate.toISOString().slice(0,10) !== new Date(event.start).toISOString().slice(0,10) || event.extendedProps.recurrence === 'none') {
                 allCalendarEvents.push({
                    // Use a unique ID for recurring instances for FullCalendar, e.g., masterId-date
                    id: `${event.id}-${newStartDate.getTime()}`,
                    title: event.extendedProps.icon ? `${event.extendedProps.icon} ${event.title}` : event.title,
                    start: newStartDate.toISOString().slice(0, 16),
                    end: newEndDate ? newEndDate.toISOString().slice(0, 16) : null,
                    extendedProps: {
                        ...event.extendedProps,
                        isRecurringInstance: true, // Flag this as a generated instance
                        masterEventId: event.id // Link to original event
                    },
                    backgroundColor: event.extendedProps.color || '',
                    borderColor: event.extendedProps.color || '',
                    classNames: event.extendedProps.color ? [] : [`fc-event-${event.extendedProps.category}`]
                 });
            }
          }

          // Advance date based on recurrence type
          if (event.extendedProps.recurrence === 'daily') {
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (event.extendedProps.recurrence === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (event.extendedProps.recurrence === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
          } else {
            break; // Should not happen if recurrence is 'none'
          }
        }
      }
    });

    console.log("Calendar events to render:", allCalendarEvents);
    currentEvents = fetchedEvents; // Keep original fetched events for dashboard, not generated ones
    if (fetchedEvents.length === 0) {
      emptyCalendarMessage.classList.remove("hidden");
    } else {
      emptyCalendarMessage.classList.add("hidden");
    }

    renderTodayDashboard(); // Render today's events after loading
    successCallback(allCalendarEvents); // Pass generated events to FullCalendar
  } catch (error) {
    console.error("Error loading events:", error);
    failureCallback(error); // Notify FullCalendar of error
    emptyCalendarMessage.classList.remove("hidden");
  } finally {
    hideLoadingSpinner(); // Hide spinner after fetching (success or failure)
  }
}


// Function to save (add or edit) an event to Firebase
taskForm.onsubmit = async e => {
  e.preventDefault();

  if (!userId) {
    console.error("User not authenticated. Cannot save event.");
    showConfirmationDialog("You must be signed in to save events.", () => {});
    return;
  }

  const eventData = {
    title: titleInput.value,
    start: startInput.value,
    end: endInput.value,
    category: categoryInput.value,
    notes: notesInput.value,
    recurrence: recurrenceInput.value, // Save recurrence
    color: colorPicker.value,
    icon: iconPicker.value,
    userId: userId
  };

  showLoadingSpinner(); // Show spinner before saving

  try {
    if (selectedEvent) {
      // If it's a recurring instance, update the master event
      const idToUpdate = selectedEvent.extendedProps.isRecurringInstance ? selectedEvent.extendedProps.masterEventId : selectedEvent.id;
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, idToUpdate), eventData);
      console.log("Event updated:", idToUpdate);
    } else {
      const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/events`), eventData);
      console.log("Event added with ID:", docRef.id);
    }

    toggleTaskModal(false);
    calendar.refetchEvents(); // Re-fetch all events including recurrences
  } catch (error) {
    console.error("Error saving event:", error);
    showConfirmationDialog(`Error saving event: ${error.message}`, () => {});
  } finally {
    hideLoadingSpinner(); // Hide spinner after saving
  }
};

// Function to delete an event from Firebase (extracted for reuse)
async function deleteEvent(eventId) {
  if (!userId) {
    console.error("User not authenticated. Cannot delete event.");
    showConfirmationDialog("You must be signed in to delete events.", () => {});
    return;
  }
  showLoadingSpinner(); // Show spinner before deleting
  try {
    // Determine the ID to delete. If it's a recurring instance, delete the master event.
    const idToDelete = selectedEvent && selectedEvent.extendedProps.isRecurringInstance ? selectedEvent.extendedProps.masterEventId : eventId;

    await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, idToDelete));
    console.log("Event deleted:", idToDelete);
    toggleTaskModal(false); // Close task modal after deletion
    calendar.refetchEvents(); // Refresh calendar events (including all recurrences)
  } catch (error) {
    console.error("Error deleting event:", error);
    showConfirmationDialog(`Error deleting event: ${error.message}`, () => {});
  } finally {
    hideLoadingSpinner(); // Hide spinner after deleting
  }
}

// Delete button handler for the task modal
if (deleteBtn) {
  deleteBtn.onclick = () => {
    if (selectedEvent) {
      showConfirmationDialog("Are you sure you want to delete this event and ALL its occurrences?", async (confirmed) => {
        if (confirmed) {
          await deleteEvent(selectedEvent.id);
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
    showLoadingSpinner(); // Show spinner
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User signed up (Email/Password):", userCredential.user.uid);
      // UI update handled by onAuthStateChanged
    } catch (error) {
      console.error("Error signing up:", error.message);
      showConfirmationDialog(`Sign Up Error: ${error.message}`, () => {});
    } finally {
      hideLoadingSpinner(); // Hide spinner
    }
  };
}

if (signInBtn) {
  signInBtn.onclick = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    showLoadingSpinner(); // Show spinner
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("User signed in (Email/Password):", userCredential.user.uid);
      // UI update handled by onAuthStateChanged
    } catch (error) {
      console.error("Error signing in:", error.message);
      showConfirmationDialog(`Sign In Error: ${error.message}`, () => {});
    } finally {
      hideLoadingSpinner(); // Hide spinner
    }
  };
}

if (googleSignInBtn) {
  googleSignInBtn.onclick = async () => {
    const provider = new GoogleAuthProvider();
    showLoadingSpinner(); // Show spinner
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("User signed in with Google:", user.uid, user.displayName);
      // UI update handled by onAuthStateChanged
    } catch (error) {
      console.error("Error during Google Sign-In:", error.code, error.message);
      let errorMessage = `Google Sign-In Error: ${error.message}`;
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Google Sign-In popup was closed by the user.";
      }
      showConfirmationDialog(errorMessage, () => {});
    } finally {
      hideLoadingSpinner(); // Hide spinner
    }
  };
}

// Consolidated sign-out function for both buttons
async function handleSignOut() {
  showLoadingSpinner(); // Show spinner
  try {
    await signOut(auth);
    console.log("User signed out.");
    // UI update handled by onAuthStateChanged
  } catch (error) {
    console.error("Error signing out:", error.message);
    showConfirmationDialog(`Sign Out Error: ${error.message}`, () => {});
  } finally {
    hideLoadingSpinner(); // Hide spinner
  }
}

// Attach sign-out handler to the top sign-out button
if (signOutBtnTop) {
  signOutBtnTop.onclick = handleSignOut;
}

// --- Today Dashboard Rendering ---
function renderTodayDashboard() {
  if (!todayEventsList || !noTodayEventsMessage) {
    console.warn("Today dashboard elements not found.");
    return;
  }

  todayEventsList.innerHTML = ''; // Clear previous events
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of today

  const eventsToday = [];

  // Iterate over original fetched events and generate today's instances
  currentEvents.forEach(event => {
      let currentDate = new Date(event.start);
      const originalDuration = event.end ? new Date(event.end).getTime() - new Date(event.start).getTime() : 0;

      // Loop only if it's a recurring event or the original event is today
      if (event.extendedProps.recurrence !== 'none') {
          // Look for occurrences within a relevant range for today's dashboard
          // A simple approach is to check for occurrences for a few days around 'today'
          // This ensures that weekly/monthly events that fall on 'today' are caught
          for (let i = -30; i <= 30; i++) { // Check +/- 30 days around today
              let checkDate = new Date(event.start);
              if (event.extendedProps.recurrence === 'daily') {
                checkDate.setDate(checkDate.getDate() + i);
              } else if (event.extendedProps.recurrence === 'weekly') {
                checkDate.setDate(checkDate.getDate() + (i * 7));
              } else if (event.extendedProps.recurrence === 'monthly') {
                checkDate.setMonth(checkDate.getMonth() + i);
              } else {
                continue; // Skip if no recurrence
              }

              let occurrenceStart = new Date(checkDate);
              occurrenceStart.setHours(new Date(event.start).getHours(), new Date(event.start).getMinutes(), 0, 0);
              let occurrenceEnd = originalDuration > 0 ? new Date(occurrenceStart.getTime() + originalDuration) : null;

              if (occurrenceStart.toDateString() === today.toDateString()) {
                  eventsToday.push({
                      id: event.id, // Use master event ID for consistency on dashboard
                      title: event.title,
                      start: occurrenceStart.toISOString(),
                      end: occurrenceEnd ? occurrenceEnd.toISOString() : null,
                      extendedProps: {
                          ...event.extendedProps,
                          isRecurringInstance: true, // Mark as recurring for dashboard click logic
                          masterEventId: event.id
                      }
                  });
              }
          }
      } else {
          // Non-recurring events, only add if they are today
          const eventStart = new Date(event.start);
          eventStart.setHours(0, 0, 0, 0);
          if (eventStart.getTime() === today.getTime()) {
              eventsToday.push(event);
          }
      }
  });


  if (eventsToday.length === 0) {
    noTodayEventsMessage.classList.remove("hidden");
    todayDashboard.classList.add("hidden"); // Hide the whole dashboard if no events
  } else {
    noTodayEventsMessage.classList.add("hidden");
    todayDashboard.classList.remove("hidden"); // Show the dashboard

    // Sort events by start time
    eventsToday.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    eventsToday.forEach(event => {
      const eventItem = document.createElement('div');
      eventItem.classList.add('today-event-item');
      // Set border-left color if a custom color is defined for the event
      if (event.extendedProps.color) {
        eventItem.style.borderLeftColor = event.extendedProps.color;
      }


      const startTime = new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endTime = event.end ? new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No end time';

      eventItem.innerHTML = `
        <span class="event-time">${startTime} - ${endTime}</span>
        <div class="event-details">
          <p class="event-title">${event.extendedProps.icon ? event.extendedProps.icon + ' ' : ''}${event.extendedProps.originalTitle}</p>
          <p class="event-category">Category: ${event.extendedProps.category}</p>
          ${event.extendedProps.notes ? `<p class="event-notes">${event.extendedProps.notes}</p>` : ''}
        </div>
      `;
      // Add click listener to dashboard item to open the main modal for editing the MASTER event
      eventItem.addEventListener('click', () => {
        // Ensure we always edit the master event, not a generated instance
        const masterEvent = currentEvents.find(e => e.id === event.id);
        if (masterEvent) {
            selectedEvent = masterEvent;
            titleInput.value = masterEvent.extendedProps.originalTitle;
            startInput.value = masterEvent.start.slice(0, 16);
            endInput.value = masterEvent.end?.slice(0, 16) || "";
            categoryInput.value = masterEvent.extendedProps.category;
            notesInput.value = masterEvent.extendedProps.notes || "";
            recurrenceInput.value = masterEvent.extendedProps.recurrence || "none"; // Populate recurrence
            colorPicker.value = masterEvent.extendedProps.color || "#3498db";
            iconPicker.value = masterEvent.extendedProps.icon || "";
            toggleTaskModal(true);
        } else {
            console.error("Master event not found for dashboard item:", event.id);
        }
      });

      todayEventsList.appendChild(eventItem);
    });
  }
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
      if (!userId) {
        showConfirmationDialog("Please sign in to add events.", () => {});
        return;
      }
      selectedEvent = null; // Ensure no event is pre-selected for new entry
      titleInput.value = ""; // Clear title
      startInput.value = info.dateStr + "T00:00";
      endInput.value = info.dateStr + "T01:00";
      categoryInput.value = "university"; // Default category
      notesInput.value = ""; // Clear notes
      recurrenceInput.value = "none"; // Default recurrence to none
      colorPicker.value = "#3498db"; // Default color
      iconPicker.value = ""; // No default icon
      toggleTaskModal(true);
    },
    eventClick: info => {
      // Direct editing: When an event is clicked, open the task modal with its details
      // If it's a recurring instance, find its master event to populate the form correctly
      const masterEvent = info.event.extendedProps.masterEventId
        ? currentEvents.find(e => e.id === info.event.extendedProps.masterEventId)
        : currentEvents.find(e => e.id === info.event.id); // Fallback to itself if not an instance

      if (masterEvent) {
          selectedEvent = masterEvent; // Store the clicked (master) event for editing
          titleInput.value = masterEvent.extendedProps.originalTitle;
          startInput.value = masterEvent.start.slice(0, 16); // Use original start for the form
          endInput.value = masterEvent.end?.slice(0, 16) || ""; // Use original end for the form
          categoryInput.value = masterEvent.extendedProps.category;
          notesInput.value = masterEvent.extendedProps.notes || "";
          recurrenceInput.value = masterEvent.extendedProps.recurrence || "none"; // Populate recurrence
          colorPicker.value = masterEvent.extendedProps.color || "#3498db";
          iconPicker.value = masterEvent.extendedProps.icon || "";
          toggleTaskModal(true); // Show the modal for editing
      } else {
          console.error("Could not find master event for clicked event:", info.event);
          // Fallback to showing raw event details if master not found (shouldn't happen often)
          selectedEvent = info.event;
          titleInput.value = info.event.title;
          startInput.value = info.event.start.toISOString().slice(0, 16);
          endInput.value = info.event.end?.toISOString().slice(0, 16) || "";
          categoryInput.value = info.event.extendedProps.category;
          notesInput.value = info.event.extendedProps.notes || "";
          recurrenceInput.value = "none"; // Assume none if master not found
          colorPicker.value = info.event.backgroundColor || "#3498db";
          iconPicker.value = info.event.title.split(' ')[0].length === 2 ? info.event.title.split(' ')[0] : ""; // Try to extract icon
          toggleTaskModal(true);
      }
    },
    eventDrop: async function(info) {
      console.log("Event dropped:", info.event.id, info.event.start, info.event.end);
      if (!userId) {
        console.error("User not authenticated. Cannot update event on drop.");
        info.revert();
        showConfirmationDialog("You must be signed in to move events.", () => {});
        return;
      }
      showLoadingSpinner(); // Show spinner
      try {
        // If a recurring instance is dropped, update the master event's start/end time
        const idToUpdate = info.event.extendedProps.masterEventId || info.event.id;
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, idToUpdate), {
          start: info.event.start.toISOString(),
          end: info.event.end ? info.event.end.toISOString() : null
        });
        console.log("Event updated in Firestore after drop:", idToUpdate);
        calendar.refetchEvents(); // Re-fetch to update dashboard and all recurrences
      } catch (error) {
        console.error("Error updating event on drop:", error);
        info.revert();
        showConfirmationDialog(`Error moving event: ${error.message}`, () => {});
      } finally {
        hideLoadingSpinner(); // Hide spinner
      }
    },
    eventResize: async function(info) {
      console.log("Event resized:", info.event.id, info.event.start, info.event.end);
      if (!userId) {
        console.error("User not authenticated. Cannot update event on resize.");
        info.revert();
        showConfirmationDialog("You must be signed in to resize events.", () => {});
        return;
      }
      showLoadingSpinner(); // Show spinner
      try {
        // If a recurring instance is resized, update the master event's start/end time
        const idToUpdate = info.event.extendedProps.masterEventId || info.event.id;
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, idToUpdate), {
          start: info.event.start.toISOString(),
          end: info.event.end ? info.event.end.toISOString() : null
        });
        console.log("Event updated in Firestore after resize:", idToUpdate);
        calendar.refetchEvents(); // Re-fetch to update dashboard and all recurrences
      } catch (error) {
        console.error("Error updating event on resize:", error);
        info.revert();
        showConfirmationDialog(`Error resizing event: ${error.message}`, () => {});
      } finally {
        hideLoadingSpinner(); // Hide spinner
      }
    }
  });

  calendar.render();
  console.log("Calendar rendered.");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      userId = user.uid;
      isAuthReady = true;
      console.log("onAuthStateChanged: User authenticated. UID:", userId);
      console.log("onAuthStateChanged: Showing user info, hiding auth forms.");

      // Show user info and hide auth forms
      if (userInfoDisplay) {
        userInfoDisplay.classList.remove("hidden");
      }
      if (authFormsContainer) {
        authFormsContainer.classList.add("hidden");
      }

      displayUserEmail.textContent = user.email || user.displayName || `User ID: ${user.uid}`;

      // Clear email/password inputs (important if they were partially filled before login)
      emailInput.value = "";
      passwordInput.value = "";

      calendar.refetchEvents();
    } else {
      userId = null;
      isAuthReady = false;
      console.log("onAuthStateChanged: No user signed in.");
      console.log("onAuthStateChanged: Hiding user info, showing auth forms.");

      // Hide user info and show auth forms
      if (userInfoDisplay) {
        userInfoDisplay.classList.add("hidden");
      }
      if (authFormsContainer) {
        authFormsContainer.classList.remove("hidden");
      }

      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
          console.log("onAuthStateChanged: Signed in with custom token (anonymous).");
        } else {
          await signInAnonymously(auth);
          console.log("Signed in anonymously.");
        }
      } catch (error) {
        console.error("onAuthStateChanged: Error during initial authentication (anonymous sign-in):", error);
        showConfirmationDialog("Authentication failed. Please check console.", () => {});
      }
      calendar.refetchEvents();
    }
  });
});
