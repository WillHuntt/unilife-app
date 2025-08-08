// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAEMOiOm_ksNO57NYp2sNh5va0y6Y40kR0",
  authDomain: "personal-reminder-app.firebaseapp.com",
  projectId: "personal-reminder-app",
  storageBucket: "personal-reminder-app.firebasestorage.app",
  messagingSenderId: "530943110596",
  appId: "1:530943110596:web:753349f5577bd39eeb4891",
  measurementId: "G-255K8FCD4J"
};

// Firebase Init
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const eventsCollection = collection(db, "events");

let calendar;
let selectedEvent = null;

// Modal & form
const modal = document.getElementById("task-modal");
const form = document.getElementById("task-form");
const titleInput = document.getElementById("title");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const categoryInput = document.getElementById("category");
const deleteBtn = document.getElementById("delete-task-btn");
const closeModalBtn = document.getElementById("close-modal-btn");

// Toggle modal
function toggleModal(show) {
  modal.classList.toggle("hidden", !show);
  if (!show) {
    form.reset();
    selectedEvent = null;
  }
}

// Load events from Firebase
async function loadEvents() {
  const snapshot = await getDocs(eventsCollection);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      start: data.start,
      end: data.end,
      extendedProps: {
        category: data.category
      },
      classNames: [`fc-event-${data.category}`]
    };
  });
}

// Save (add or edit)
form.onsubmit = async e => {
  e.preventDefault();
  const eventData = {
    title: titleInput.value,
    start: startInput.value,
    end: endInput.value,
    category: categoryInput.value
  };

  if (selectedEvent) {
    await updateDoc(doc(eventsCollection, selectedEvent.id), eventData);
  } else {
    await addDoc(eventsCollection, eventData);
  }

  toggleModal(false);
  calendar.refetchEvents();
};

// Delete
deleteBtn.onclick = async () => {
  if (selectedEvent) {
    await deleteDoc(doc(eventsCollection, selectedEvent.id));
    toggleModal(false);
    calendar.refetchEvents();
  }
};

// Modal cancel
closeModalBtn.onclick = () => toggleModal(false);

// Theme toggle
document.getElementById("toggle-theme").onclick = () => {
  document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
};

// Calendar init
document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    selectable: true,
    editable: false,
    height: "auto",
    events: loadEvents,
    dateClick: info => {
      startInput.value = info.dateStr + "T00:00";
      endInput.value = info.dateStr + "T01:00";
      toggleModal(true);
    },
    eventClick: info => {
      selectedEvent = info.event;
      titleInput.value = info.event.title;
      startInput.value = info.event.start.toISOString().slice(0, 16);
      endInput.value = info.event.end?.toISOString().slice(0, 16) || "";
      categoryInput.value = info.event.extendedProps.category;
      toggleModal(true);
    }
  });

  calendar.render();
});
