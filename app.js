// Final JS with Firebase, EmailJS, color coding by category, task control

// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEMOiOm_ksNO57NYp2sNh5va0y6Y40kR0",
  authDomain: "personal-reminder-app.firebaseapp.com",
  projectId: "personal-reminder-app",
  storageBucket: "personal-reminder-app.appspot.com",
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

const taskForm = document.getElementById("task-form");
const taskList = document.getElementById("task-list");
const themeToggle = document.getElementById("theme-toggle");

themeToggle.addEventListener("click", () => {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", html.dataset.theme);
});

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
});

// Add task
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const task = document.getElementById("task-input").value;
  const category = document.getElementById("category").value;
  const dueDate = document.getElementById("due-date").value;
  const email = document.getElementById("email-input").value;

  const docRef = await addDoc(collection(db, "tasks"), {
    task,
    category,
    dueDate,
    email,
    completed: false
  });

  if (email) {
    sendEmailReminder(email, task, dueDate);
  }

  taskForm.reset();
});

function renderTask(id, data) {
  const li = document.createElement("li");
  li.className = `task-item ${data.category} ${data.completed ? 'completed' : ''}`;
  li.innerHTML = `
    <span>${data.task} — ${data.dueDate}</span>
    <div>
      <button onclick="toggleComplete('${id}', ${data.completed})">✔</button>
      <button onclick="deleteTask('${id}')">🗑</button>
    </div>
  `;
  taskList.appendChild(li);
}

// Real-time updates
onSnapshot(collection(db, "tasks"), (snapshot) => {
  taskList.innerHTML = "";
  snapshot.forEach((doc) => {
    renderTask(doc.id, doc.data());
  });
});

window.deleteTask = async (id) => {
  await deleteDoc(doc(db, "tasks", id));
};

window.toggleComplete = async (id, current) => {
  await updateDoc(doc(db, "tasks", id), { completed: !current });
};

// EmailJS reminder function
function sendEmailReminder(toEmail, task, dueDate) {
  emailjs.send(emailServiceID, emailTemplateID, {
    to_email: toEmail,
    task_name: task,
    task_due: dueDate
  }, emailPublicKey).then(() => {
    console.log("Reminder email sent.");
  }).catch(err => {
    console.error("Failed to send email:", err);
  });
}
