import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// EmailJS config
const emailServiceID = "service_lidtnkg";
const emailTemplateID = "template_mlcsugm";
const emailPublicKey = "WdCnxoSXOUiBXq9og";

emailjs.init(emailPublicKey);

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
  if(html.dataset.theme === 'dark') {
    html.dataset.theme = 'light';
    localStorage.setItem('theme', 'light');
  } else {
    html.dataset.theme = 'dark';
    localStorage.setItem('theme', 'dark');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  if(savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }
});

// Open modal helpers
function openModal() {
  modal.classList.remove('hidden');
  modalOverlay.classList.remove('hidden');
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
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    selectable: true,
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    dateClick: info => {
      // Open modal for adding a task on clicked date
      openModal();
      dueDateInput.value = info.dateStr;
      document.getElementById('modal-title').textContent = 'Add Task';
      deleteBtn.classList.add('hidden');
      editingTaskId = null;
    },
    eventClick: info => {
      // Open modal for editing a task
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

// Listen for tasks in Firestore and update calendar events
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

// Add or update task in Firestore
async function saveTask(data) {
  if (editingTaskId) {
    const taskRef = doc(db, 'tasks', editingTaskId);
    await updateDoc(taskRef, data);
  } else {
    await addDoc(collection(db, 'tasks'), data);
  }
  
  // Send email reminder if email provided
  if (data.email) {
    emailjs.send(emailServiceID, emailTemplateID, {
      to_email: data.email,
      task_name: data.task,
      task_due: data.dueDate
    }).then(() => {
      console.log('Reminder email sent.');
    }).catch((err) => {
      console.error('EmailJS error:', err);
    });
  }
}

// Delete task
async function deleteTask(id) {
  if (!id) return;
  await deleteDoc(doc(db, 'tasks', id));
  closeModal();
}

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
  if (editingTaskId) {
    if (confirm('Delete this task?')) {
      await deleteTask(editingTaskId);
    }
  }
});

closeModalBtn.addEventListener('click', () => {
  closeModal();
});

modalOverlay.addEventListener('click', () => {
  closeModal();
});

// Initialize calendar and start listening to tasks
initCalendar();
subscribeToTasks();
