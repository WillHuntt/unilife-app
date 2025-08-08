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
            console.log("Using Canvas-provided Firebase config for app.");
        } else {
            console.warn("Canvas-provided Firebase config for app is incomplete. Using default.");
        }
    } catch (e) {
        console.error("Error parsing Canvas-provided Firebase config for app. Using default.", e);
    }
} else {
    console.warn("No Canvas-provided Firebase config for app. Using default.");
}

if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing. Please ensure it's provided in firebaseConfig.");
    const errorMessage = "Error: Firebase API Key is missing. Please check console for details.";
    showConfirmationDialog(errorMessage, () => {});
    throw new Error("Firebase API Key is missing.");
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
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
const notesInput = document.getElementById("notes");
const recurrenceInput = document.getElementById("recurrence");
const colorPicker = document.getElementById("color-picker");
const iconPicker = document.getElementById("icon-picker");
const deleteBtn = document.getElementById("delete-task-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const emptyCalendarMessage = document.getElementById("empty-calendar-message");

// User Info Display
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
    taskForm.reset();
    selectedEvent = null;
    colorPicker.value = "#3498db";
    iconPicker.value = "";
    recurrenceInput.value = "none";
  }
}

// Function to toggle confirmation modal visibility
function showConfirmationDialog(message, onConfirm) {
  confirmationMessage.textContent = message;
  onConfirmCallback = onConfirm;
  confirmationModal.classList.remove("hidden");
  if (!taskModal.classList.contains("hidden")) {
    taskModal.classList.add("hidden");
  }
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

// Function to load events from Firebase
async function loadEvents(fetchInfo, successCallback, failureCallback) {
  if (!isAuthReady || !userId) {
    console.log("Authentication not ready or userId not set. Cannot load events.");
    // Removed redirect here. The onAuthStateChanged listener will handle it.
    successCallback([]);
    return;
  }

  showLoadingSpinner();

  try {
    console.log(`Attempting to load events for userId: ${userId}`);
    const userEventsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/events`);
    const userEventsQuery = query(userEventsCollectionRef);
    const snapshot = await getDocs(userEventsQuery);
    const fetchedEvents = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        start: data.start,
        end: data.end,
        extendedProps: {
          category: data.category,
          originalTitle: data.title,
          notes: data.notes || '',
          color: data.color || null,
          icon: data.icon || null,
          recurrence: data.recurrence || 'none'
        }
      };
    });

    const allCalendarEvents = [];
    const viewStart = fetchInfo.start;
    const viewEnd = fetchInfo.end;

    fetchedEvents.forEach(event => {
      // Always add the original event
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

        const maxRecurrenceDate = new Date(viewEnd);
        maxRecurrenceDate.setMonth(maxRecurrenceDate.getMonth() + 3);

        while (currentDate.getTime() <= maxRecurrenceDate.getTime()) {
          if (event.extendedProps.recurrence === 'daily') {
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (event.extendedProps.recurrence === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (event.extendedProps.recurrence === 'monthly') {
            const originalDay = new Date(event.start).getDate();
            currentDate.setMonth(currentDate.getMonth() + 1);
            if (currentDate.getDate() !== originalDay) {
                currentDate.setDate(0);
                currentDate.setDate(originalDay);
            }
          }

          let newStartDate = new Date(currentDate);
          let newEndDate = originalDuration > 0 ? new Date(newStartDate.getTime() + originalDuration) : null;

          const calendarDisplayEnd = new Date(viewEnd);
          calendarDisplayEnd.setDate(calendarDisplayEnd.getDate() + 1);

          if (newStartDate.getTime() < calendarDisplayEnd.getTime() && newEndDate && newEndDate.getTime() > viewStart.getTime()) {
            allCalendarEvents.push({
                id: `${event.id}-recur-${newStartDate.getTime()}`,
                title: event.extendedProps.icon ? `${event.extendedProps.icon} ${event.title}` : event.title,
                start: newStartDate.toISOString().slice(0, 16),
                end: newEndDate ? newEndDate.toISOString().slice(0, 16) : null,
                extendedProps: {
                    ...event.extendedProps,
                    isRecurringInstance: true,
                    masterEventId: event.id
                },
                backgroundColor: event.extendedProps.color || '',
                borderColor: event.extendedProps.color || '',
                classNames: event.extendedProps.color ? [] : [`fc-event-${event.extendedProps.category}`]
            });
          } else if (newStartDate.getTime() >= maxRecurrenceDate.getTime()) {
              break;
          }
        }
      }
    });

    console.log("Calendar events to render:", allCalendarEvents);
    currentEvents = fetchedEvents;

    if (fetchedEvents.length === 0) {
      emptyCalendarMessage.classList.remove("hidden");
    } else {
      emptyCalendarMessage.classList.add("hidden");
    }

    renderTodayDashboard();
    successCallback(allCalendarEvents);
  } catch (error) {
    console.error("Error loading events:", error);
    failureCallback(error);
    emptyCalendarMessage.classList.remove("hidden");
  } finally {
    hideLoadingSpinner();
  }
}

taskForm.onsubmit = async e => {
  e.preventDefault();

  if (!userId) {
    showConfirmationDialog("You must be signed in to save events.", () => {});
    return;
  }

  const eventData = {
    title: titleInput.value,
    start: startInput.value,
    end: endInput.value,
    category: categoryInput.value,
    notes: notesInput.value,
    recurrence: recurrenceInput.value,
    color: colorPicker.value,
    icon: iconPicker.value,
    userId: userId
  };

  showLoadingSpinner();

  try {
    if (selectedEvent) {
      const idToUpdate = selectedEvent.extendedProps.isRecurringInstance ? selectedEvent.extendedProps.masterEventId : selectedEvent.id;
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, idToUpdate), eventData);
      console.log("Event updated:", idToUpdate);
    } else {
      const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/events`), eventData);
      console.log("Event added with ID:", docRef.id);
    }

    toggleTaskModal(false);
    calendar.refetchEvents();
  } catch (error) {
    console.error("Error saving event:", error);
    showConfirmationDialog(`Error saving event: ${error.message}`, () => {});
  } finally {
    hideLoadingSpinner();
  }
};

async function deleteEvent(eventId) {
  if (!userId) {
    showConfirmationDialog("You must be signed in to delete events.", () => {});
    return;
  }
  showLoadingSpinner();
  try {
    const idToDelete = selectedEvent && selectedEvent.extendedProps.isRecurringInstance ? selectedEvent.extendedProps.masterEventId : eventId;

    await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, idToDelete));
    console.log("Event deleted:", idToDelete);
    toggleTaskModal(false);
    calendar.refetchEvents();
  } catch (error) {
    console.error("Error deleting event:", error);
    showConfirmationDialog(`Error deleting event: ${error.message}`, () => {});
  } finally {
    hideLoadingSpinner();
  }
}

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

if (closeModalBtn) {
  closeModalBtn.onclick = () => toggleTaskModal(false);
}

// --- Theme Management ---
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

// Consolidated sign-out function
async function handleSignOut() {
  showLoadingSpinner();
  try {
    await signOut(auth);
    console.log("User signed out. Redirecting to portal.");
    window.location.href = 'portal.html';
  } catch (error) {
    console.error("Error signing out:", error.message);
    showConfirmationDialog(`Sign Out Error: ${error.message}`, () => {});
  } finally {
    hideLoadingSpinner();
  }
}

if (signOutBtnTop) {
  signOutBtnTop.onclick = handleSignOut;
}

// --- Today Dashboard Rendering ---
function renderTodayDashboard() {
  if (!todayEventsList || !noTodayEventsMessage) {
    console.warn("Today dashboard elements not found.");
    return;
  }

  todayEventsList.innerHTML = '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventsToday = [];

  currentEvents.forEach(event => {
      let currentDate = new Date(event.start);
      const originalDuration = event.end ? new Date(event.end).getTime() - new Date(event.start).getTime() : 0;

      if (event.extendedProps.recurrence !== 'none') {
          for (let i = -30; i <= 30; i++) {
              let checkDate = new Date(event.start);
              if (event.extendedProps.recurrence === 'daily') {
                checkDate.setDate(checkDate.getDate() + i);
              } else if (event.extendedProps.recurrence === 'weekly') {
                checkDate.setDate(checkDate.getDate() + (i * 7));
              } else if (event.extendedProps.recurrence === 'monthly') {
                checkDate.setMonth(checkDate.getMonth() + i);
              } else {
                continue;
              }

              let occurrenceStart = new Date(checkDate);
              occurrenceStart.setHours(new Date(event.start).getHours(), new Date(event.start).getMinutes(), 0, 0);
              let occurrenceEnd = originalDuration > 0 ? new Date(occurrenceStart.getTime() + originalDuration) : null;

              if (occurrenceStart.toDateString() === today.toDateString()) {
                  eventsToday.push({
                      id: event.id,
                      title: event.title,
                      start: occurrenceStart.toISOString(),
                      end: occurrenceEnd ? occurrenceEnd.toISOString() : null,
                      extendedProps: {
                          ...event.extendedProps,
                          isRecurringInstance: true,
                          masterEventId: event.id
                      }
                  });
              }
          }
      } else {
          const eventStart = new Date(event.start);
          eventStart.setHours(0, 0, 0, 0);
          if (eventStart.getTime() === today.getTime()) {
              eventsToday.push(event);
          }
      }
  });


  if (eventsToday.length === 0) {
    noTodayEventsMessage.classList.remove("hidden");
    todayDashboard.classList.add("hidden");
  } else {
    noTodayEventsMessage.classList.add("hidden");
    todayDashboard.classList.remove("hidden");

    eventsToday.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    eventsToday.forEach(event => {
      const eventItem = document.createElement('div');
      eventItem.classList.add('today-event-item');
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
      eventItem.addEventListener('click', () => {
        const masterEvent = currentEvents.find(e => e.id === event.id);
        if (masterEvent) {
            selectedEvent = masterEvent;
            titleInput.value = masterEvent.extendedProps.originalTitle;
            startInput.value = masterEvent.start.slice(0, 16);
            endInput.value = masterEvent.end?.slice(0, 16) || "";
            categoryInput.value = masterEvent.extendedProps.category;
            notesInput.value = masterEvent.extendedProps.notes || "";
            recurrenceInput.value = masterEvent.extendedProps.recurrence || "none";
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
    editable: true,
    height: "auto",
    events: loadEvents,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    eventDidMount: function(info) {},
    dateClick: info => {
      console.log("Date clicked:", info.dateStr);
      if (!userId) {
        showConfirmationDialog("Please sign in to add events.", () => {
            // Removed redirect here. The onAuthStateChanged listener will handle it.
        });
        return;
      }
      selectedEvent = null;
      titleInput.value = "";
      startInput.value = info.dateStr + "T00:00";
      endInput.value = info.dateStr + "T01:00";
      categoryInput.value = "university";
      notesInput.value = "";
      recurrenceInput.value = "none";
      colorPicker.value = "#3498db";
      iconPicker.value = "";
      toggleTaskModal(true);
    },
    eventClick: info => {
      const masterEvent = info.event.extendedProps.masterEventId
        ? currentEvents.find(e => e.id === info.event.extendedProps.masterEventId)
        : currentEvents.find(e => e.id === info.event.id);

      if (masterEvent) {
          selectedEvent = masterEvent;
          titleInput.value = masterEvent.extendedProps.originalTitle;
          startInput.value = masterEvent.start.slice(0, 16);
          endInput.value = masterEvent.end?.slice(0, 16) || "";
          categoryInput.value = masterEvent.extendedProps.category;
          notesInput.value = masterEvent.extendedProps.notes || "";
          recurrenceInput.value = masterEvent.extendedProps.recurrence || "none";
          colorPicker.value = masterEvent.extendedProps.color || "#3498db";
          iconPicker.value = masterEvent.extendedProps.icon || "";
          toggleTaskModal(true);
      } else {
          console.error("Could not find master event for clicked event:", info.event);
          selectedEvent = info.event;
          titleInput.value = info.event.title;
          startInput.value = info.event.start.toISOString().slice(0, 16);
          endInput.value = info.event.end?.toISOString().slice(0, 16) || "";
          categoryInput.value = info.event.extendedProps.category;
          notesInput.value = info.event.extendedProps.notes || "";
          recurrenceInput.value = "none";
          colorPicker.value = info.event.backgroundColor || "#3498db";
          iconPicker.value = info.event.title.split(' ')[0].length === 2 ? info.event.title.split(' ')[0] : "";
          toggleTaskModal(true);
      }
    },
    eventDrop: async function(info) {
      if (!userId) {
        info.revert();
        showConfirmationDialog("You must be signed in to move events.", () => {});
        return;
      }
      showLoadingSpinner();
      try {
        const idToUpdate = info.event.extendedProps.masterEventId || info.event.id;
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, idToUpdate), {
          start: info.event.start.toISOString(),
          end: info.event.end ? info.event.end.toISOString() : null
        });
        calendar.refetchEvents();
      } catch (error) {
        console.error("Error updating event on drop:", error);
        info.revert();
        showConfirmationDialog(`Error moving event: ${error.message}`, () => {});
      } finally {
        hideLoadingSpinner();
      }
    },
    eventResize: async function(info) {
      if (!userId) {
        info.revert();
        showConfirmationDialog("You must be signed in to resize events.", () => {});
        return;
      }
      showLoadingSpinner();
      try {
        const idToUpdate = info.event.extendedProps.masterEventId || info.event.id;
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, idToUpdate), {
          start: info.event.start.toISOString(),
          end: info.event.end ? info.event.end.toISOString() : null
        });
        calendar.refetchEvents();
      } catch (error) {
        console.error("Error updating event on resize:", error);
        info.revert();
        showConfirmationDialog(`Error resizing event: ${error.message}`, () => {});
      } finally {
        hideLoadingSpinner();
      }
    }
  });

  calendar.render();
  console.log("Calendar rendered.");

  // This onAuthStateChanged ensures index.html acts as a protected route.
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      userId = user.uid;
      isAuthReady = true;
      console.log("App: User authenticated. UID:", userId);

      userInfoDisplay.classList.remove("hidden");
      displayUserEmail.textContent = user.email || user.displayName || `User ID: ${user.uid}`;

      calendar.refetchEvents();
    } else {
      userId = null;
      isAuthReady = false;
      console.log("App: No user signed in. Redirecting to portal.html.");
      window.location.href = 'portal.html'; // This is the main redirect
    }
  });
});
