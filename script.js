import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXSkAdrsXF3pzZUgp8O0YTgCfZqhD3Saw",
  authDomain: "habit-tracker-ines.firebaseapp.com",
  projectId: "habit-tracker-ines",
  storageBucket: "habit-tracker-ines.firebasestorage.app",
  messagingSenderId: "203337575827",
  appId: "1:203337575827:web:3fa2e3f84245643c060c66"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const colorClasses = ["white", "green", "red"];
const STORAGE_KEY = "habitTrackerData";
let tasks = [];
let currentTaskIndex = null;
let currentDate = new Date();
let currentUser = null;
let unsubscribeData = null;
let isApplyingRemoteData = false;

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout-btn");
const authMessage = document.getElementById("auth-message");
const userEmail = document.getElementById("user-email");
const syncStatus = document.getElementById("sync-status");

const habitsScreen = document.getElementById("habits-screen");
const calendarScreen = document.getElementById("calendar-screen");
const taskList = document.getElementById("task-list");
const addBtn = document.getElementById("add-btn");
const newTaskInput = document.getElementById("new-task");
const calendar = document.getElementById("calendar");
const calendarTitle = document.getElementById("calendar-title");
const monthName = document.getElementById("month-name");
const backBtn = document.getElementById("back-btn");
const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");
const todayBtn = document.getElementById("today-btn");

const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric"
});

function getDefaultTasks() {
  return [
    { name: "Tomarse pastilla", days: {} },
    { name: "Lavarse dientes", days: {} },
    { name: "Hacer ejercicio", days: {} }
  ];
}

function loadLocalTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultTasks();
  } catch {
    return getDefaultTasks();
  }
}

function saveLocalTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function userDocRef(uid) {
  return doc(db, "users", uid);
}

async function saveData() {
  saveLocalTasks();
  renderTasks();

  if (!currentUser || isApplyingRemoteData) return;

  syncStatus.textContent = "☁️ Guardando…";
  try {
    await setDoc(userDocRef(currentUser.uid), {
      tasks,
      updatedAt: Date.now()
    }, { merge: true });
    syncStatus.textContent = "☁️ Sincronizado";
  } catch (error) {
    console.error(error);
    syncStatus.textContent = "⚠️ Sin sincronizar";
  }
}

async function initializeUserData(user) {
  const ref = userDocRef(user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists() || !Array.isArray(snapshot.data().tasks)) {
    tasks = loadLocalTasks();
    await setDoc(ref, { tasks, updatedAt: Date.now() }, { merge: true });
  } else {
    tasks = snapshot.data().tasks;
    saveLocalTasks();
  }

  renderTasks();

  if (unsubscribeData) unsubscribeData();
  unsubscribeData = onSnapshot(ref, (liveSnapshot) => {
    const data = liveSnapshot.data();
    if (!data || !Array.isArray(data.tasks)) return;

    isApplyingRemoteData = true;
    tasks = data.tasks;
    saveLocalTasks();
    renderTasks();
    if (currentTaskIndex !== null && tasks[currentTaskIndex]) {
      calendarTitle.textContent = tasks[currentTaskIndex].name;
      renderCalendar();
    }
    syncStatus.textContent = "☁️ Sincronizado";
    isApplyingRemoteData = false;
  }, (error) => {
    console.error(error);
    syncStatus.textContent = "⚠️ Error de sincronización";
  });
}

function showAuthError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/operation-not-allowed": "Activa Email/Password en Firebase Authentication.",
    "permission-denied": "Revisa las reglas de seguridad de Firestore."
  };
  authMessage.textContent = messages[code] || "Ha ocurrido un error. Revisa Firebase y vuelve a intentarlo.";
}

loginBtn.addEventListener("click", async () => {
  authMessage.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value);
  } catch (error) {
    showAuthError(error);
  }
});

signupBtn.addEventListener("click", async () => {
  authMessage.textContent = "";
  try {
    await createUserWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value);
  } catch (error) {
    showAuthError(error);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    if (unsubscribeData) {
      unsubscribeData();
      unsubscribeData = null;
    }
    authScreen.style.display = "block";
    appShell.style.display = "none";
    return;
  }

  authScreen.style.display = "none";
  appShell.style.display = "block";
  userEmail.textContent = user.email || "";
  syncStatus.textContent = "☁️ Conectando…";

  try {
    await initializeUserData(user);
  } catch (error) {
    console.error(error);
    syncStatus.textContent = "⚠️ Revisa Firestore";
  }
});

function moveTask(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= tasks.length) return;
  const [task] = tasks.splice(fromIndex, 1);
  tasks.splice(toIndex, 0, task);
  saveData();
}

function renderTasks() {
  taskList.innerHTML = "";

  tasks.forEach((task, index) => {
    const li = document.createElement("li");

    const moveControls = document.createElement("div");
    moveControls.classList.add("move-controls");

    const moveUpBtn = document.createElement("button");
    moveUpBtn.textContent = "▲";
    moveUpBtn.classList.add("move-btn");
    moveUpBtn.disabled = index === 0;
    moveUpBtn.addEventListener("click", () => moveTask(index, index - 1));

    const moveDownBtn = document.createElement("button");
    moveDownBtn.textContent = "▼";
    moveDownBtn.classList.add("move-btn");
    moveDownBtn.disabled = index === tasks.length - 1;
    moveDownBtn.addEventListener("click", () => moveTask(index, index + 1));

    moveControls.append(moveUpBtn, moveDownBtn);

    const btn = document.createElement("button");
    btn.classList.add("task-btn");
    btn.textContent = task.name;
    btn.addEventListener("click", () => showCalendar(index));

    const editBtn = document.createElement("button");
    editBtn.textContent = "✏️";
    editBtn.classList.add("edit-btn");
    editBtn.addEventListener("click", () => {
      const newName = prompt("Editar hábito:", task.name);
      if (newName && newName.trim()) {
        task.name = newName.trim();
        saveData();
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.addEventListener("click", () => {
      if (confirm(`¿Eliminar hábito "${task.name}"?`)) {
        tasks.splice(index, 1);
        saveData();
      }
    });

    li.append(moveControls, btn, editBtn, deleteBtn);
    taskList.appendChild(li);
  });
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function migrateLegacyFebruaryData(task) {
  if (!task.days || task._legacyMigrated) return;
  const legacyEntries = Object.entries(task.days).filter(([key]) => /^\d{1,2}$/.test(key));

  legacyEntries.forEach(([day, color]) => {
    const key = dateKey(2026, 1, Number(day));
    if (!task.days[key]) task.days[key] = color;
    delete task.days[day];
  });

  task._legacyMigrated = true;
}

function showCalendar(taskIndex) {
  currentTaskIndex = taskIndex;
  currentDate = new Date();
  currentDate.setDate(1);

  const task = tasks[taskIndex];
  migrateLegacyFebruaryData(task);
  saveData();

  habitsScreen.style.display = "none";
  calendarScreen.style.display = "block";
  calendarTitle.textContent = task.name;
  renderCalendar();
}

function renderCalendar() {
  if (currentTaskIndex === null || !tasks[currentTaskIndex]) return;

  const task = tasks[currentTaskIndex];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  monthName.textContent = monthFormatter.format(currentDate).replace(/^./, c => c.toUpperCase());
  calendar.innerHTML = "";

  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  for (let i = 0; i < firstDay; i++) {
    calendar.appendChild(document.createElement("div"));
  }

  const today = new Date();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("day");

    const key = dateKey(year, month, day);
    const color = task.days[key] || "white";
    dayDiv.classList.add(color);
    dayDiv.textContent = day;

    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      dayDiv.classList.add("today");
    }

    dayDiv.addEventListener("click", () => {
      const currentColor = colorClasses.find(c => dayDiv.classList.contains(c)) || "white";
      const nextColor = colorClasses[(colorClasses.indexOf(currentColor) + 1) % colorClasses.length];
      dayDiv.classList.remove(...colorClasses);
      dayDiv.classList.add(nextColor);
      task.days[key] = nextColor;
      saveData();
    });

    calendar.appendChild(dayDiv);
  }
}

prevMonthBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

todayBtn.addEventListener("click", () => {
  currentDate = new Date();
  currentDate.setDate(1);
  renderCalendar();
});

backBtn.addEventListener("click", () => {
  calendarScreen.style.display = "none";
  habitsScreen.style.display = "block";
  currentTaskIndex = null;
});

addBtn.addEventListener("click", addTask);
newTaskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addTask();
});

function addTask() {
  const name = newTaskInput.value.trim();
  if (!name) return;
  tasks.push({ name, days: {} });
  newTaskInput.value = "";
  saveData();
}
