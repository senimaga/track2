const colorClasses = ["white", "green", "red"];
let tasks = [];
let currentTaskIndex = null;
let currentDate = new Date();

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

const STORAGE_KEY = "habitTrackerData";
const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric"
});

function loadData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    tasks = JSON.parse(data);
  } else {
    tasks = [
      { name: "Tomarse pastilla", days: {} },
      { name: "Lavarse dientes", days: {} },
      { name: "Hacer ejercicio", days: {} },
    ];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function renderTasks() {
  taskList.innerHTML = "";

  tasks.forEach((task, index) => {
    const li = document.createElement("li");

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
        renderTasks();
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.addEventListener("click", () => {
      if (confirm(`¿Eliminar hábito "${task.name}"?`)) {
        tasks.splice(index, 1);
        saveData();
        renderTasks();
      }
    });

    li.appendChild(btn);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
  });
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function migrateLegacyFebruaryData(task) {
  if (!task.days || task._legacyMigrated) return;

  const legacyEntries = Object.entries(task.days).filter(([key]) => /^\d{1,2}$/.test(key));
  if (legacyEntries.length === 0) {
    task._legacyMigrated = true;
    return;
  }

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
  if (currentTaskIndex === null) return;

  const task = tasks[currentTaskIndex];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  monthName.textContent = monthFormatter.format(currentDate).replace(/^./, c => c.toUpperCase());
  calendar.innerHTML = "";

  // JS: domingo=0. Lo convertimos a lunes=0 ... domingo=6.
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;

  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.classList.add("empty-day");
    calendar.appendChild(emptyDiv);
  }

  const today = new Date();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("day");

    const key = dateKey(year, month, day);
    const color = task.days[key] || "white";
    dayDiv.classList.add(color);
    dayDiv.textContent = day;

    const isToday =
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    if (isToday) dayDiv.classList.add("today");

    dayDiv.addEventListener("click", () => {
      const currentColor = colorClasses.find(c => dayDiv.classList.contains(c)) || "white";
      const currentIndex = colorClasses.indexOf(currentColor);
      const nextColor = colorClasses[(currentIndex + 1) % colorClasses.length];

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
  renderTasks();
}

loadData();
renderTasks();
