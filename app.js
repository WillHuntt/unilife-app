// ES module imports for FullCalendar and EmailJS
import { Calendar } from "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/+esm";
import * as emailjs from "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// EmailJS setup
const emailServiceID = "service_lidtnkg";
const emailTemplateID = "template_mlcsugm";
const emailPublicKey = "WdCnxoSXOUiBXq9og";
emailjs.init(emailPublicKey);

// DOM Elements
const calendarEl = document.getElementById('calendar');
const modal = document.getElementById('task-modal');
const modalOverlay = document.getElementById('modal-overlay');
const taskForm = document.getElementById('task-form');
const deleteBtn = document.getElementById('delete-task-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

const taskInput = document.getElementById('task-input');
const categorySelect = document.getElementById('category');
const dueDateInput = document.getElementById('due-date');
const emailInput = document.getElementById('email-input');
const taskIdInput = document.getElementById('task-id');

const themeToggle = document.getElementById('theme-toggle');

let calendar;
let editingTaskId = null;

// Theme toggle
themeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  if (html.dataset.theme === 'dark') {
    html.dataset.theme = 'light';
    localStorage.setItem('theme', 'light');
  } else {
    html.dataset.theme = 'dark';
    localStorage.setItem('theme', 'dark');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }
});

// Modal helpers
function openModal() {
  modal.classList.remove('hidden');
  modalOverlay.classList.remove('hidden');
  taskInput.focus();
  // Set min date to today to prevent past dates
  dueDateInput.min = new Date().toISOString().split('T')[0];
}

function closeModal() {
  modal.classList.add('hidden');
  modalOverlay.classList.add('hidden');
  taskForm.reset();
  deleteBtn.classList.add('hidden');
  taskIdInput.value = '';
  editingTaskId = null;
}

// Initialize FullCalendar
function initCalendar() {
  calendar = new Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    selectable: true,
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    dateClick: info => {
      openModal();
      dueDateInput.value = info.dateStr;
      document.getElementById('modal-title').textContent = 'Add Task';
      deleteBtn.classList.add('hidden');
      editingTaskId = null;
    },
    eventClick: info => {
      const task = info.event.extendedProps.fullData;
      openModal();
      taskInput.value = task.task;
      categorySelect.value = task.category;
      dueDateInput.value = task.dueDate;
      emailInput.value = task.email || '';
      taskIdInput.value = info.event.id;
      editingTaskId = info.event.id;
      document.getElementById('modal-title').textContent = 'Edit Task';
      deleteBtn.classList.remove('hidden');
    },
    events: []
  });

  calendar.render();
}

// Subscribe to Firestore task updates
function subscribeToTasks() {
  const tasksCol = collection(db, 'tasks');
  onSnapshot(tasksCol, snapshot => {
    const events = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      events.push({
        id: docSnap.id,
        title: data.task + (data.completed ? ' ✅' : ''),
        start: data.dueDate,
        allDay: true,
        classNames: [`fc-event-${data.category}`],
        extendedProps: {
          fullData: data
        }
      });
    });
    calendar.removeAllEvents();
    calendar.addEventSource(events);
  });
}

// Save task to Firestore (add or update)
async function saveTask(data) {
  try {
    if (editingTaskId) {
      const taskRef = doc(db, 'tasks', editingTaskId);
      await updateDoc(taskRef, data);
      alert('Task updated successfully.');
    } else {
      await addDoc(collection(db, 'tasks'), data);
      alert('Task added successfully.');
    }

    // Send email reminder if email is given and valid format
    if (data.email && validateEmail(data.email)) {
      await emailjs.send(emailServiceID, emailTemplateID, {
        to_email: data.email,
        task_name: data.task,
        task_due: data.dueDate
      });
      alert('Reminder email sent.');
    }
  } catch (err) {
    console.error('Error saving task:', err);
    alert('An error occurred while saving the task.');
  }
}

// Delete task from Firestore
async function deleteTask(id) {
  if (!id) return;
  try {
    await deleteDoc(doc(db, 'tasks', id));
    closeModal();
    alert('Task deleted successfully.');
  } catch (err) {
    console.error('Error deleting task:', err);
    alert('An error occurred while deleting the task.');
  }
}

// Simple email format validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Event listeners
taskForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    task: taskInput.value.trim(),
    category: categorySelect.value,
    dueDate: dueDateInput.value,
    email: emailInput.value.trim(),
    completed: false
  };
  await saveTask(data);
  closeModal();
});

deleteBtn.addEventListener('click', async () => {
  if (editingTaskId && confirm('Delete this task?')) {
    await deleteTask(editingTaskId);
  }
});

closeModalBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

// Start app
initCalendar();
subscribeToTasks();
