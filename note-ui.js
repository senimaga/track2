const noteInput = document.getElementById("habit-note");
const saveNoteButton = document.getElementById("save-note-btn");
const editNoteButton = document.getElementById("edit-note-btn");
const noteDisplay = document.getElementById("habit-note-display");

function refreshNoteDisplay() {
  const value = noteInput?.value?.trim() || "";
  if (noteDisplay) noteDisplay.textContent = value || "Sin nota";
}

editNoteButton?.addEventListener("click", () => {
  const current = noteInput?.value || "";
  const updated = prompt("Editar nota:", current);
  if (updated === null || !noteInput) return;

  noteInput.value = updated.trim();
  saveNoteButton?.click();
  refreshNoteDisplay();
});

saveNoteButton?.addEventListener("click", () => {
  setTimeout(refreshNoteDisplay, 0);
});

const observer = new MutationObserver(() => refreshNoteDisplay());
const calendarScreen = document.getElementById("calendar-screen");
if (calendarScreen) {
  observer.observe(calendarScreen, { attributes: true, attributeFilter: ["style"] });
}

window.addEventListener("load", refreshNoteDisplay);
