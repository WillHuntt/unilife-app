// Firebase config (will be replaced by Canvas runtime)
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
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
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Initialize Firebase
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
const deleteBtn = document.getElementById("delete-task-btn");
const closeModalBtn = document.getElementById("close-modal-btn");

// Function to toggle modal visibility
function toggleModal(show) {
  modal.classList.toggle("hidden", !show);
  // Reset form and selected event when modal is hidden
  if (!show) {
    form.reset();
    selectedEvent = null;
  }
}

// Function to load events from Firebase
async function loadEvents(fetchInfo, successCallback, failureCallback) {
  // Only attempt to load events if authentication is ready and userId is available
  if (!isAuthReady || !userId) {
    console.log("Authentication not ready or userId not set. Returning empty events.");
    successCallback([]);
    return;
  }

  try {
    console.log(`Attempting to load events for userId: ${userId}`);
    // Query events specific to the current user
    const userEventsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/events`);
    const userEventsQuery = query(userEventsCollectionRef);
    const snapshot = await getDocs(userEventsQuery);
    const events = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        start: data.start,
        end: data.end,
        extendedProps: {
          category: data.category
        },
        // Apply category-specific classes for styling
        classNames: [`fc-event-${data.category}`]
      };
    });
    console.log("Events loaded:", events);
    successCallback(events); // Pass events to FullCalendar
  } catch (error) {
    console.error("Error loading events:", error);
    failureCallback(error); // Notify FullCalendar of error
  }
}

// Function to save (add or edit) an event to Firebase
form.onsubmit = async e => {
  e.preventDefault(); // Prevent default form submission

  if (!userId) {
    console.error("User not authenticated. Cannot save event.");
    // In a real app, show a user-friendly message
    return;
  }

  const eventData = {
    title: titleInput.value,
    start: startInput.value,
    end: endInput.value,
    category: categoryInput.value,
    userId: userId // Associate events with the user
  };

  try {
    if (selectedEvent) {
      // If an event is selected, update it
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, selectedEvent.id), eventData);
      console.log("Event updated:", selectedEvent.id);
    } else {
      // Otherwise, add a new event
      const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/events`), eventData);
      console.log("Event added with ID:", docRef.id);
    }

    toggleModal(false); // Hide the modal
    calendar.refetchEvents(); // Refresh calendar events
  } catch (error) {
    console.error("Error saving event:", error);
    // In a real app, you might show a user-friendly error message
  }
};

// Function to delete an event from Firebase
deleteBtn.onclick = async () => {
  if (!selectedEvent || !userId) {
    console.error("No event selected or user not authenticated. Cannot delete event.");
    return;
  }

  try {
    // Delete the document from the user's events collection
    await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, selectedEvent.id));
    console.log("Event deleted:", selectedEvent.id);
    toggleModal(false); // Hide the modal
    calendar.refetchEvents(); // Refresh calendar events
  } catch (error) {
    console.error("Error deleting event:", error);
    // In a real app, you might show a user-friendly error message
  }
};

// Modal cancel button click handler
closeModalBtn.onclick = () => toggleModal(false);

// Theme toggle button click handler
document.getElementById("toggle-theme").onclick = () => {
  document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
  console.log("Theme toggled to:", document.body.dataset.theme);
};

// Initialize FullCalendar when the DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded. Initializing calendar...");
  const calendarEl = document.getElementById("calendar");

  // Initialize FullCalendar instance
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth", // Display month view initially
    selectable: true, // Allow date selection
    editable: false, // Events are not directly editable by drag/drop on calendar
    height: "auto", // Calendar height adjusts to content
    events: loadEvents, // Function to load events from Firebase
    // Handle date clicks to open the modal for adding new events
    dateClick: info => {
      console.log("Date clicked:", info.dateStr);
      startInput.value = info.dateStr + "T00:00"; // Set start time to midnight
      endInput.value = info.dateStr + "T01:00";   // Set end time to 1 AM
      toggleModal(true); // Show the modal
    },
    // Handle event clicks to open the modal for editing/deleting events
    eventClick: info => {
      console.log("Event clicked:", info.event.id, info.event.title);
      selectedEvent = info.event; // Store the clicked event
      titleInput.value = info.event.title;
      // Format dates to YYYY-MM-DDTHH:MM for datetime-local input
      startInput.value = info.event.start.toISOString().slice(0, 16);
      // Handle cases where end date might be null
      endInput.value = info.event.end?.toISOString().slice(0, 16) || "";
      categoryInput.value = info.event.extendedProps.category;
      toggleModal(true); // Show the modal
    }
  });

  // Render the calendar immediately after instantiation
  calendar.render();
  console.log("Calendar rendered.");

  // Authenticate user with Firebase and then refetch events
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in
      userId = user.uid;
      console.log("User authenticated:", userId);
    } else {
      // User is signed out, sign in anonymously
      try {
        console.log("No user signed in. Attempting anonymous sign-in...");
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
          console.log("Signed in with custom token.");
        } else {
          await signInAnonymously(auth);
          console.log("Signed in anonymously.");
        }
        userId = auth.currentUser.uid;
        console.log("Current user ID after sign-in:", userId);
      } catch (error) {
        console.error("Error during authentication:", error);
        // Handle authentication error, perhaps show a message to the user
      }
    }
    isAuthReady = true; // Set auth ready flag
    calendar.refetchEvents(); // Refetch events now that auth is ready
    console.log("Authentication state determined. Refetching events.");
  });
});
