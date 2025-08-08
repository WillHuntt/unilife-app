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

// Function to load events from Firebase for the current user
async function loadEvents(fetchInfo, successCallback, failureCallback) {
  if (!userId) {
    // If user is not authenticated yet, return empty array
    successCallback([]);
    return;
  }

  try {
    // Query events specific to the current user
    const userEventsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/events`));
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
    return;
  }

  const eventData = {
    title: titleInput.value,
    start: startInput.value,
    end: endInput.value,
    category: categoryInput.value,
    // Add a userId field to associate events with the user
    userId: userId
  };

  try {
    if (selectedEvent) {
      // If an event is selected, update it
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, selectedEvent.id), eventData);
    } else {
      // Otherwise, add a new event
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/events`), eventData);
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
};

// Initialize FullCalendar when the DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");

  // Authenticate user with Firebase
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in
      userId = user.uid;
      console.log("User authenticated:", userId);
    } else {
      // User is signed out, sign in anonymously
      try {
        if (typeof __initial_auth_token !== 'undefined') {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        userId = auth.currentUser.uid;
        console.log("Signed in anonymously:", userId);
      } catch (error) {
        console.error("Error signing in:", error);
        // Handle authentication error, perhaps show a message to the user
      }
    }

    // Initialize FullCalendar only after authentication is ready
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth", // Display month view initially
      selectable: true, // Allow date selection
      editable: false, // Events are not directly editable by drag/drop on calendar
      height: "auto", // Calendar height adjusts to content
      events: loadEvents, // Function to load events from Firebase
      // Handle date clicks to open the modal for adding new events
      dateClick: info => {
        startInput.value = info.dateStr + "T00:00"; // Set start time to midnight
        endInput.value = info.dateStr + "T01:00";   // Set end time to 1 AM
        toggleModal(true); // Show the modal
      },
      // Handle event clicks to open the modal for editing/deleting events
      eventClick: info => {
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

    calendar.render(); // Render the calendar
  });
});
