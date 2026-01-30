const colorClasses = ["white", "green", "red"];
let tasks = [];

const habitsScreen = document.getElementById("habits-screen");
const calendarScreen = document.getElementById("calendar-screen");

const taskList = document.getElementById("task-list");
const addBtn = document.getElementById("add-btn");
const newTaskInput = document.getElementById("new-task");

const calendar = document.getElementById("calendar");
const calendarTitle = document.getElementById("calendar-title");
const backBtn = document.getElementById("back-btn");

const STORAGE_KEY = "habitTrackerData";

// Cargar datos
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

// Guardar datos
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Renderizar lista de hábitos
function renderTasks() {
  taskList.innerHTML = "";
  tasks.forEach((task, index) => {
    const li = document.createElement("li");

    const btn = document.createElement("button");
    btn.classList.add("task-btn");
    btn.textContent = task.name;
    btn.addEventListener("click", () => showCalendar(index));

    // Botón editar uniforme
    const editBtn = document.createElement("button");
    editBtn.textContent = "✏️";
    editBtn.classList.add("edit-btn");
    editBtn.addEventListener("click", () => {
      const newName = prompt("Editar hábito:", task.name);
      if (newName) {
        task.name = newName;
        saveData();
        renderTasks();
      }
    });

    // Botón eliminar uniforme
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

// Mostrar calendario de febrero 2026 con alineación correcta
function showCalendar(taskIndex) {
  habitsScreen.style.display = "none";
  calendarScreen.style.display = "block";

  const task = tasks[taskIndex];
  calendarTitle.textContent = task.name;
  calendar.innerHTML = "";

  const daysInMonth = 28;
  const firstDay = 6; // Domingo=6, lunes=0

  // Días vacíos al inicio para alinear el 1 debajo de "D"
  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement("div");
    calendar.appendChild(emptyDiv);
  }

  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("day");
    const color = task.days[day] || "white";
    dayDiv.classList.add(color);
    dayDiv.textContent = day;

    dayDiv.addEventListener("click", () => {
      const currentIndex = colorClasses.indexOf(dayDiv.classList[1]);
      const nextIndex = (currentIndex + 1) % colorClasses.length;
      dayDiv.classList.remove(colorClasses[currentIndex]);
      dayDiv.classList.add(colorClasses[nextIndex]);
      task.days[day] = colorClasses[nextIndex];
      saveData();
    });

    calendar.appendChild(dayDiv);
  }
}

// Volver a hábitos
backBtn.addEventListener("click", () => {
  calendarScreen.style.display = "none";
  habitsScreen.style.display = "block";
});

// Añadir hábito
addBtn.addEventListener("click", () => {
  const name = newTaskInput.value.trim();
  if (name) {
    tasks.push({ name, days: {} });
    newTaskInput.value = "";
    saveData();
    renderTasks();
  }
});

// Inicializar
loadData();
renderTasks();
