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
let categories = [];
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
const addBtn = document.getElementById("add-btn");
const newTaskInput = document.getElementById("new-task");
const newTaskCategory = document.getElementById("new-task-category");
const addCategoryBtn = document.getElementById("add-category-btn");
const categoriesContainer = document.getElementById("categories-container");
const calendar = document.getElementById("calendar");
const calendarTitle = document.getElementById("calendar-title");
const monthName = document.getElementById("month-name");
const backBtn = document.getElementById("back-btn");
const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");
const todayBtn = document.getElementById("today-btn");

const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });

function getDefaultTasks() {
  return [
    { name: "Tomarse pastilla", days: {}, categoryId: "uncategorized" },
    { name: "Lavarse dientes", days: {}, categoryId: "uncategorized" },
    { name: "Hacer ejercicio", days: {}, categoryId: "uncategorized" }
  ];
}

function getDefaultCategories() {
  return [{ id: "uncategorized", name: "Sin categoría" }];
}

function normalizeData() {
  if (!Array.isArray(categories) || categories.length === 0) categories = getDefaultCategories();
  if (!categories.some(c => c.id === "uncategorized")) categories.unshift({ id: "uncategorized", name: "Sin categoría" });
  tasks.forEach(task => {
    if (!task.categoryId || !categories.some(c => c.id === task.categoryId)) task.categoryId = "uncategorized";
  });
}

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: getDefaultTasks(), categories: getDefaultCategories() };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { tasks: parsed, categories: getDefaultCategories() };
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : getDefaultTasks(),
      categories: Array.isArray(parsed.categories) ? parsed.categories : getDefaultCategories()
    };
  } catch {
    return { tasks: getDefaultTasks(), categories: getDefaultCategories() };
  }
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, categories }));
}

function userDocRef(uid) { return doc(db, "users", uid); }

async function saveData() {
  normalizeData();
  saveLocalData();
  renderHome();

  if (!currentUser || isApplyingRemoteData) return;

  syncStatus.textContent = "☁️ Guardando…";
  try {
    await setDoc(userDocRef(currentUser.uid), { tasks, categories, updatedAt: Date.now() }, { merge: true });
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
    const local = loadLocalData();
    tasks = local.tasks;
    categories = local.categories;
    normalizeData();
    await setDoc(ref, { tasks, categories, updatedAt: Date.now() }, { merge: true });
  } else {
    const data = snapshot.data();
    tasks = data.tasks;
    categories = Array.isArray(data.categories) ? data.categories : getDefaultCategories();
    normalizeData();
    saveLocalData();
  }

  renderHome();

  if (unsubscribeData) unsubscribeData();
  unsubscribeData = onSnapshot(ref, (liveSnapshot) => {
    const data = liveSnapshot.data();
    if (!data || !Array.isArray(data.tasks)) return;

    isApplyingRemoteData = true;
    tasks = data.tasks;
    categories = Array.isArray(data.categories) ? data.categories : getDefaultCategories();
    normalizeData();
    saveLocalData();
    renderHome();
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
  const messages = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/operation-not-allowed": "Activa Email/Password en Firebase Authentication.",
    "permission-denied": "Revisa las reglas de seguridad de Firestore."
  };
  authMessage.textContent = messages[error?.code || ""] || "Ha ocurrido un error. Revisa Firebase y vuelve a intentarlo.";
}

loginBtn.addEventListener("click", async () => {
  authMessage.textContent = "";
  try { await signInWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value); }
  catch (error) { showAuthError(error); }
});

signupBtn.addEventListener("click", async () => {
  authMessage.textContent = "";
  try { await createUserWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value); }
  catch (error) { showAuthError(error); }
});

logoutBtn.addEventListener("click", async () => { await signOut(auth); });

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    if (unsubscribeData) { unsubscribeData(); unsubscribeData = null; }
    authScreen.style.display = "block";
    appShell.style.display = "none";
    return;
  }

  authScreen.style.display = "none";
  appShell.style.display = "block";
  userEmail.textContent = user.email || "";
  syncStatus.textContent = "☁️ Conectando…";

  try { await initializeUserData(user); }
  catch (error) {
    console.error(error);
    syncStatus.textContent = "⚠️ Revisa Firestore";
  }
});

function renderHome() {
  normalizeData();
  renderCategorySelect();
  renderCategories();
}

function renderCategorySelect() {
  const previous = newTaskCategory.value;
  newTaskCategory.innerHTML = "";
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    newTaskCategory.appendChild(option);
  });
  if (categories.some(c => c.id === previous)) newTaskCategory.value = previous;
}

function renderCategories() {
  categoriesContainer.innerHTML = "";

  categories.forEach(category => {
    const block = document.createElement("section");
    block.classList.add("category-block");

    const header = document.createElement("div");
    header.classList.add("category-header");

    const title = document.createElement("div");
    title.classList.add("category-title");
    title.textContent = category.name;

    const actions = document.createElement("div");
    actions.classList.add("category-actions");

    if (category.id !== "uncategorized") {
      const editCategoryBtn = document.createElement("button");
      editCategoryBtn.classList.add("category-action-btn");
      editCategoryBtn.textContent = "✏️";
      editCategoryBtn.title = "Renombrar categoría";
      editCategoryBtn.addEventListener("click", () => {
        const name = prompt("Nombre de la categoría:", category.name);
        if (name && name.trim()) { category.name = name.trim(); saveData(); }
      });

      const deleteCategoryBtn = document.createElement("button");
      deleteCategoryBtn.classList.add("category-action-btn");
      deleteCategoryBtn.textContent = "🗑️";
      deleteCategoryBtn.title = "Eliminar categoría";
      deleteCategoryBtn.addEventListener("click", () => {
        if (!confirm(`¿Eliminar la categoría "${category.name}"? Los hábitos pasarán a "Sin categoría".`)) return;
        tasks.forEach(task => { if (task.categoryId === category.id) task.categoryId = "uncategorized"; });
        categories = categories.filter(c => c.id !== category.id);
        saveData();
      });

      actions.append(editCategoryBtn, deleteCategoryBtn);
    }

    header.append(title, actions);
    block.appendChild(header);

    const list = document.createElement("ul");
    list.classList.add("category-list");

    const taskIndices = tasks.map((task, index) => ({ task, index })).filter(item => item.task.categoryId === category.id);

    if (taskIndices.length === 0) {
      const empty = document.createElement("div");
      empty.classList.add("empty-category");
      empty.textContent = "No hay hábitos en esta categoría";
      block.appendChild(empty);
    } else {
      taskIndices.forEach((item, position) => list.appendChild(createTaskRow(item.task, item.index, taskIndices, position)));
      block.appendChild(list);
    }

    categoriesContainer.appendChild(block);
  });
}

function createTaskRow(task, index, categoryTasks, position) {
  const li = document.createElement("li");

  const moveControls = document.createElement("div");
  moveControls.classList.add("move-controls");
  const up = document.createElement("button");
  const down = document.createElement("button");
  up.textContent = "▲"; down.textContent = "▼";
  up.classList.add("move-btn"); down.classList.add("move-btn");
  up.disabled = position === 0;
  down.disabled = position === categoryTasks.length - 1;
  up.addEventListener("click", () => moveTaskWithinCategory(categoryTasks[position].index, categoryTasks[position - 1]?.index));
  down.addEventListener("click", () => moveTaskWithinCategory(categoryTasks[position].index, categoryTasks[position + 1]?.index));
  moveControls.append(up, down);

  const btn = document.createElement("button");
  btn.classList.add("task-btn");
  btn.textContent = task.name;
  btn.addEventListener("click", () => showCalendar(index));

  const categoryBtn = document.createElement("button");
  categoryBtn.textContent = "📁";
  categoryBtn.classList.add("category-move-btn");
  categoryBtn.title = "Mover a otra categoría";
  categoryBtn.addEventListener("click", () => moveTaskToCategory(task));

  const editBtn = document.createElement("button");
  editBtn.textContent = "✏️";
  editBtn.classList.add("edit-btn");
  editBtn.addEventListener("click", () => {
    const newName = prompt("Editar hábito:", task.name);
    if (newName && newName.trim()) { task.name = newName.trim(); saveData(); }
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "🗑️";
  deleteBtn.classList.add("delete-btn");
  deleteBtn.addEventListener("click", () => {
    if (confirm(`¿Eliminar hábito "${task.name}"?`)) { tasks.splice(index, 1); saveData(); }
  });

  li.append(moveControls, btn, categoryBtn, editBtn, deleteBtn);
  return li;
}

function moveTaskWithinCategory(fromIndex, toIndex) {
  if (toIndex === undefined || toIndex < 0 || toIndex >= tasks.length) return;
  const [task] = tasks.splice(fromIndex, 1);
  tasks.splice(toIndex, 0, task);
  saveData();
}

function moveTaskToCategory(task) {
  const choices = categories.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
  const currentIndex = categories.findIndex(c => c.id === task.categoryId);
  const answer = prompt(`Mover "${task.name}" a:\n\n${choices}\n\nEscribe el número:`, String(currentIndex + 1));
  const selected = Number(answer) - 1;
  if (Number.isInteger(selected) && categories[selected]) {
    task.categoryId = categories[selected].id;
    saveData();
  }
}

addCategoryBtn.addEventListener("click", () => {
  const name = prompt("Nombre de la nueva categoría:");
  if (!name || !name.trim()) return;
  categories.push({ id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: name.trim() });
  saveData();
});

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
  for (let i = 0; i < firstDay; i++) calendar.appendChild(document.createElement("div"));
  const today = new Date();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("day");
    const key = dateKey(year, month, day);
    const color = task.days[key] || "white";
    dayDiv.classList.add(color);
    dayDiv.textContent = day;
    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) dayDiv.classList.add("today");
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

prevMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
nextMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
todayBtn.addEventListener("click", () => { currentDate = new Date(); currentDate.setDate(1); renderCalendar(); });
backBtn.addEventListener("click", () => { calendarScreen.style.display = "none"; habitsScreen.style.display = "block"; currentTaskIndex = null; });

addBtn.addEventListener("click", addTask);
newTaskInput.addEventListener("keydown", event => { if (event.key === "Enter") addTask(); });

function addTask() {
  const name = newTaskInput.value.trim();
  if (!name) return;
  tasks.push({ name, days: {}, categoryId: newTaskCategory.value || "uncategorized" });
  newTaskInput.value = "";
  saveData();
}
