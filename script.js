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

const STORAGE_KEY = "habitTrackerData";
const colorClasses = ["white", "green", "red"];

let tasks = [];
let categories = [];
let currentCategoryId = null;
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

const categoriesScreen = document.getElementById("categories-screen");
const categoryScreen = document.getElementById("category-screen");
const calendarScreen = document.getElementById("calendar-screen");
const categoryList = document.getElementById("category-list");
const newCategoryInput = document.getElementById("new-category");
const addCategoryBtn = document.getElementById("add-category-btn");
const categoryScreenTitle = document.getElementById("category-screen-title");
const backCategoriesBtn = document.getElementById("back-categories-btn");
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

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Añade únicamente metadatos de categorías. No modifica nombres ni borra días registrados.
function prepareCategoryStructure() {
  if (!Array.isArray(tasks)) tasks = [];
  if (!Array.isArray(categories)) categories = [];

  let legacyCategory = categories.find(c => c && (c.id === "legacy_all" || c.id === "uncategorized"));

  if (!legacyCategory) {
    legacyCategory = { id: "legacy_all", name: "Mis hábitos" };
    categories.unshift(legacyCategory);
  } else {
    const oldId = legacyCategory.id;
    legacyCategory.id = "legacy_all";
    legacyCategory.name = "Mis hábitos";

    if (oldId !== "legacy_all") {
      tasks.forEach(task => {
        if (task.categoryId === oldId) task.categoryId = "legacy_all";
      });
    }
  }

  tasks.forEach(task => {
    if (!task.days || typeof task.days !== "object") task.days = {};
    const categoryExists = categories.some(c => c && c.id === task.categoryId);
    if (!task.categoryId || !categoryExists) task.categoryId = "legacy_all";
  });

  const seen = new Set();
  categories = categories.filter(category => {
    if (!category || !category.id || seen.has(category.id)) return false;
    seen.add(category.id);
    return true;
  });
}

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: getDefaultTasks(), categories: [] };

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { tasks: parsed, categories: [] };

    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : getDefaultTasks(),
      categories: Array.isArray(parsed.categories) ? parsed.categories : []
    };
  } catch {
    return { tasks: getDefaultTasks(), categories: [] };
  }
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, categories }));
}

function userDocRef(uid) {
  return doc(db, "users", uid);
}

async function saveData() {
  prepareCategoryStructure();
  saveLocalData();
  renderCurrentView();

  if (!currentUser || isApplyingRemoteData) return;

  syncStatus.textContent = "☁️ Guardando…";
  try {
    await setDoc(
      userDocRef(currentUser.uid),
      { tasks, categories, updatedAt: Date.now() },
      { merge: true }
    );
    syncStatus.textContent = "☁️ Sincronizado";
  } catch (error) {
    console.error("Error guardando en Firestore:", error);
    syncStatus.textContent = `⚠️ Sin sincronizar (${error.code || "error"})`;
  }
}

async function initializeUserData(user) {
  const ref = userDocRef(user.uid);
  let snapshot;

  try {
    snapshot = await getDoc(ref);
  } catch (error) {
    console.error("Error leyendo Firestore:", error);
    const local = loadLocalData();
    tasks = local.tasks;
    categories = local.categories;
    prepareCategoryStructure();
    saveLocalData();
    showCategories();
    syncStatus.textContent = `⚠️ No se pudo leer Firebase (${error.code || "error"})`;
    return;
  }

  if (snapshot.exists() && Array.isArray(snapshot.data().tasks)) {
    const data = snapshot.data();

    // La nube manda: conserva exactamente los hábitos y sus historiales ya registrados.
    tasks = data.tasks;
    categories = Array.isArray(data.categories) ? data.categories : [];
    prepareCategoryStructure();
    saveLocalData();
    showCategories();
  } else {
    const local = loadLocalData();
    tasks = local.tasks;
    categories = local.categories;
    prepareCategoryStructure();
    saveLocalData();
    showCategories();

    // Solo crea el documento si la cuenta todavía no tenía datos en Firebase.
    try {
      await setDoc(ref, { tasks, categories, updatedAt: Date.now() }, { merge: true });
    } catch (error) {
      console.error("Error creando datos iniciales:", error);
      syncStatus.textContent = `⚠️ Sin sincronizar (${error.code || "error"})`;
    }
  }

  if (unsubscribeData) unsubscribeData();
  unsubscribeData = onSnapshot(
    ref,
    liveSnapshot => {
      const data = liveSnapshot.data();
      if (!data || !Array.isArray(data.tasks)) return;

      isApplyingRemoteData = true;
      tasks = data.tasks;
      categories = Array.isArray(data.categories) ? data.categories : [];
      prepareCategoryStructure();
      saveLocalData();
      renderCurrentView();
      syncStatus.textContent = "☁️ Sincronizado";
      isApplyingRemoteData = false;
    },
    error => {
      console.error("Error escuchando Firestore:", error);
      syncStatus.textContent = `⚠️ Sincronización bloqueada (${error.code || "error"})`;
    }
  );
}

function showAuthError(error) {
  const messages = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/operation-not-allowed": "Activa Correo electrónico/Contraseña en Firebase Authentication."
  };

  authMessage.textContent = messages[error?.code || ""] || `Ha ocurrido un error (${error?.code || "desconocido"}).`;
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

onAuthStateChanged(auth, async user => {
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
  syncStatus.textContent = "☁️ Cargando tus datos…";

  await initializeUserData(user);
});

function hideAllScreens() {
  categoriesScreen.style.display = "none";
  categoryScreen.style.display = "none";
  calendarScreen.style.display = "none";
}

function showCategories() {
  currentCategoryId = null;
  currentTaskIndex = null;
  hideAllScreens();
  categoriesScreen.style.display = "block";
  renderCategories();
}

function showCategory(categoryId) {
  currentCategoryId = categoryId;
  currentTaskIndex = null;
  hideAllScreens();
  categoryScreen.style.display = "block";
  renderCategory();
}

function renderCurrentView() {
  if (calendarScreen.style.display !== "none" && currentTaskIndex !== null) {
    if (tasks[currentTaskIndex]) {
      calendarTitle.textContent = tasks[currentTaskIndex].name;
      renderCalendar();
    }
    return;
  }

  if (categoryScreen.style.display !== "none" && currentCategoryId) {
    renderCategory();
    return;
  }

  renderCategories();
}

function renderCategories() {
  categoryList.innerHTML = "";

  categories.forEach(category => {
    const row = document.createElement("div");
    row.classList.add("category-row");

    const main = document.createElement("button");
    main.classList.add("category-main-btn");
    const count = tasks.filter(task => task.categoryId === category.id).length;
    main.innerHTML = `<span>${escapeHtml(category.name)}</span><small>${count} ${count === 1 ? "hábito" : "hábitos"}</small>`;
    main.addEventListener("click", () => showCategory(category.id));

    const edit = document.createElement("button");
    edit.classList.add("category-mini-btn");
    edit.textContent = "✏️";
    edit.title = "Renombrar categoría";
    edit.addEventListener("click", () => {
      const value = prompt("Nombre de la categoría:", category.name);
      if (value && value.trim()) {
        category.name = value.trim();
        saveData();
      }
    });

    const del = document.createElement("button");
    del.classList.add("category-mini-btn", "danger-soft");
    del.textContent = "🗑️";
    del.title = "Eliminar categoría";
    del.disabled = categories.length === 1;
    del.addEventListener("click", () => {
      const categoryTasks = tasks.filter(task => task.categoryId === category.id);
      if (categoryTasks.length > 0) {
        alert("Esta categoría contiene hábitos. Muévelos primero a otra categoría para que no se pierda nada.");
        return;
      }

      if (confirm(`¿Eliminar la categoría "${category.name}"?`)) {
        categories = categories.filter(c => c.id !== category.id);
        saveData();
      }
    });

    row.append(main, edit, del);
    categoryList.appendChild(row);
  });
}

function renderCategory() {
  const category = categories.find(c => c.id === currentCategoryId);
  if (!category) {
    showCategories();
    return;
  }

  categoryScreenTitle.textContent = category.name;
  taskList.innerHTML = "";

  const items = tasks
    .map((task, index) => ({ task, index }))
    .filter(item => item.task.categoryId === currentCategoryId);

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.classList.add("empty-state");
    empty.textContent = "Todavía no hay hábitos en esta categoría.";
    taskList.appendChild(empty);
    return;
  }

  items.forEach((item, position) => {
    const li = document.createElement("li");

    const moveControls = document.createElement("div");
    moveControls.classList.add("move-controls");

    const up = document.createElement("button");
    const down = document.createElement("button");
    up.textContent = "▲";
    down.textContent = "▼";
    up.classList.add("move-btn");
    down.classList.add("move-btn");
    up.disabled = position === 0;
    down.disabled = position === items.length - 1;
    up.addEventListener("click", () => swapTasks(item.index, items[position - 1]?.index));
    down.addEventListener("click", () => swapTasks(item.index, items[position + 1]?.index));
    moveControls.append(up, down);

    const main = document.createElement("button");
    main.classList.add("task-btn");
    main.textContent = item.task.name;
    main.addEventListener("click", () => showCalendar(item.index));

    const moveCategory = document.createElement("button");
    moveCategory.classList.add("category-move-btn");
    moveCategory.textContent = "📁";
    moveCategory.title = "Mover a otra categoría";
    moveCategory.addEventListener("click", () => moveTaskToAnotherCategory(item.task));

    const edit = document.createElement("button");
    edit.classList.add("edit-btn");
    edit.textContent = "✏️";
    edit.addEventListener("click", () => {
      const value = prompt("Editar hábito:", item.task.name);
      if (value && value.trim()) {
        item.task.name = value.trim();
        saveData();
      }
    });

    const del = document.createElement("button");
    del.classList.add("delete-btn");
    del.textContent = "🗑️";
    del.addEventListener("click", () => {
      if (confirm(`¿Eliminar hábito "${item.task.name}"? También se eliminará su historial.`)) {
        tasks.splice(item.index, 1);
        saveData();
      }
    });

    li.append(moveControls, main, moveCategory, edit, del);
    taskList.appendChild(li);
  });
}

function swapTasks(a, b) {
  if (a === undefined || b === undefined) return;
  [tasks[a], tasks[b]] = [tasks[b], tasks[a]];
  saveData();
}

function moveTaskToAnotherCategory(task) {
  if (categories.length < 2) {
    alert("Crea otra categoría primero.");
    return;
  }

  const options = categories.map((category, i) => `${i + 1}. ${category.name}`).join("\n");
  const answer = prompt(`Mover "${task.name}" a:\n\n${options}\n\nEscribe el número:`);
  const index = Number(answer) - 1;

  if (Number.isInteger(index) && categories[index]) {
    task.categoryId = categories[index].id;
    saveData();
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[character]));
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Copia el formato antiguo de febrero al nuevo sin borrar las claves antiguas.
function migrateLegacyFebruaryData(task) {
  if (!task.days || task._legacyMigrated) return;

  const legacyEntries = Object.entries(task.days).filter(([key]) => /^\d{1,2}$/.test(key));
  legacyEntries.forEach(([day, color]) => {
    const key = dateKey(2026, 1, Number(day));
    if (!task.days[key]) task.days[key] = color;
  });

  task._legacyMigrated = true;
}

function showCalendar(taskIndex) {
  currentTaskIndex = taskIndex;
  currentDate = new Date();
  currentDate.setDate(1);

  const task = tasks[taskIndex];
  migrateLegacyFebruaryData(task);

  hideAllScreens();
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

function addCategory() {
  const name = newCategoryInput.value.trim();
  if (!name) return;

  categories.push({ id: makeId("cat"), name });
  newCategoryInput.value = "";
  saveData();
}

function addTask() {
  const name = newTaskInput.value.trim();
  if (!name || !currentCategoryId) return;

  tasks.push({ name, days: {}, categoryId: currentCategoryId });
  newTaskInput.value = "";
  saveData();
}

addCategoryBtn.addEventListener("click", addCategory);
newCategoryInput.addEventListener("keydown", event => {
  if (event.key === "Enter") addCategory();
});

addBtn.addEventListener("click", addTask);
newTaskInput.addEventListener("keydown", event => {
  if (event.key === "Enter") addTask();
});

backCategoriesBtn.addEventListener("click", showCategories);
backBtn.addEventListener("click", () => showCategory(currentCategoryId));

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
