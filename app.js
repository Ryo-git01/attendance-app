const STORAGE_KEY = "attendanceAppData_v1";
const STATE_KEY = "attendanceAppState_v1";

let data = loadData();
let state = loadState();
let selectedMonthKey = getMonthKey(new Date());
let isEditing = false;

const homeScreen = document.getElementById("homeScreen");
const attendanceScreen = document.getElementById("attendanceScreen");
const clockInBtn = document.getElementById("clockInBtn");
const clockOutBtn = document.getElementById("clockOutBtn");
const stampDisplay = document.getElementById("stampDisplay");
const attendanceBtn = document.getElementById("attendanceBtn");
const backBtn = document.getElementById("backBtn");
const monthTabs = document.getElementById("monthTabs");
const attendanceBody = document.getElementById("attendanceBody");
const emptyMessage = document.getElementById("emptyMessage");
const editBtn = document.getElementById("editBtn");

const breakModal = document.getElementById("breakModal");
const breakInput = document.getElementById("breakInput");
const registerBtn = document.getElementById("registerBtn");

cleanupOldMonths();
restoreAttendanceState();
renderHomeState();

clockInBtn.addEventListener("click", handleClockIn);
clockOutBtn.addEventListener("click", handleClockOut);
attendanceBtn.addEventListener("click", openAttendance);
backBtn.addEventListener("click", closeAttendance);
registerBtn.addEventListener("click", registerClockOut);
editBtn.addEventListener("click", toggleEditMode);

breakModal.querySelector(".modal-backdrop").addEventListener("click", closeBreakModal);

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : { pendingClockIn: null };
  } catch {
    return { pendingClockIn: null };
  }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getTodayRecord() {
  const dateKey = state.pendingClockIn?.date || getDateKey();
  return data[dateKey] || null;
}

function handleClockIn() {
  if (state.pendingClockIn) return;

  const now = new Date();
  const dateKey = getDateKey(now);
  const time = formatTime(now);

  data[dateKey] = {
    date: dateKey,
    clockIn: time,
    clockOut: null,
    breakMinutes: null
  };

  state.pendingClockIn = {
    date: dateKey,
    clockIn: time
  };

  saveData();
  saveState();
  cleanupOldMonths();
  renderHomeState();
  showStamp(time);
}

function handleClockOut() {
  if (!state.pendingClockIn) return;

  breakInput.value = "0";
  openBreakModal();
}

function openBreakModal() {
  breakModal.classList.add("show");
  breakModal.setAttribute("aria-hidden", "false");

  // iOS Safariではプログラムによるキーボード表示が制限されることがあるため、
  // 入力欄へフォーカスだけ行い、ユーザーがすぐ数字を入力できる状態にする。
  requestAnimationFrame(() => {
    breakInput.focus();
    breakInput.select();
  });
}

function closeBreakModal() {
  breakModal.classList.remove("show");
  breakModal.setAttribute("aria-hidden", "true");
}

function registerClockOut() {
  if (!state.pendingClockIn) return;

  const minutes = Number(breakInput.value);

  if (!Number.isInteger(minutes) || minutes < 0) {
    breakInput.focus();
    return;
  }

  const now = new Date();
  const dateKey = state.pendingClockIn.date;
  const record = data[dateKey];

  if (!record) {
    closeBreakModal();
    state.pendingClockIn = null;
    saveState();
    renderHomeState();
    return;
  }

  record.clockOut = formatTime(now);
  record.breakMinutes = minutes;

  saveData();

  state.pendingClockIn = null;
  saveState();

  closeBreakModal();
  renderHomeState();
  showStamp(record.clockOut);
}

function showStamp(time) {
  stampDisplay.textContent = time;
  stampDisplay.classList.add("show");

  window.clearTimeout(showStamp.timer);
  showStamp.timer = window.setTimeout(() => {
    stampDisplay.classList.remove("show");
  }, 1000);
}

function renderHomeState() {
  const hasPending = Boolean(state.pendingClockIn);

  clockInBtn.disabled = hasPending;
  clockOutBtn.disabled = !hasPending;
}

function openAttendance() {
  isEditing = false;
  selectedMonthKey = getMonthKey(new Date());

  homeScreen.classList.remove("active");
  attendanceScreen.classList.add("active");

  renderAttendance();
}

function closeAttendance() {
  isEditing = false;
  attendanceScreen.classList.remove("active");
  homeScreen.classList.add("active");
  renderHomeState();
}

function getMonthKeys() {
  const current = new Date();
  const keys = [];

  for (let offset = 2; offset >= 0; offset--) {
    const d = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    keys.push(getMonthKey(d));
  }

  return keys;
}


function restoreAttendanceState() {
  const pending = state.pendingClockIn;

  if (!pending) return;

  const record = data[pending.date];

  // 保留中の出勤情報と実データが一致しない場合は状態をリセット
  if (
    !pending.date ||
    !pending.clockIn ||
    !record ||
    record.clockIn !== pending.clockIn ||
    record.clockOut
  ) {
    state.pendingClockIn = null;
    saveState();
  }
}

function cleanupOldMonths() {
  const validMonths = new Set(getMonthKeys());

  Object.keys(data).forEach(dateKey => {
    const monthKey = dateKey.slice(0, 7);
    if (!validMonths.has(monthKey)) {
      delete data[dateKey];
    }
  });

  saveData();

  // 保留中の出勤も3ヶ月範囲外なら削除
  if (state.pendingClockIn) {
    const pendingMonth = state.pendingClockIn.date.slice(0, 7);
    if (!validMonths.has(pendingMonth)) {
      state.pendingClockIn = null;
      saveState();
    }
  }
}

function renderMonthTabs() {
  monthTabs.innerHTML = "";

  getMonthKeys().forEach(key => {
    const date = parseMonthKey(key);
    const button = document.createElement("button");
    button.className = "month-tab";
    button.textContent = `${date.getMonth() + 1}月`;

    if (key === selectedMonthKey) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      selectedMonthKey = key;
      isEditing = false;
      renderAttendance();
    });

    monthTabs.appendChild(button);
  });
}

function renderAttendance() {
  cleanupOldMonths();
  renderMonthTabs();
  renderRows();

  editBtn.textContent = isEditing ? "完了" : "編集";
}

function getRecordsForMonth(monthKey) {
  return Object.values(data)
    .filter(record => record.date.startsWith(monthKey))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function renderRows() {
  attendanceBody.innerHTML = "";

  const records = getRecordsForMonth(selectedMonthKey);
  emptyMessage.classList.toggle("show", records.length === 0);

  records.forEach(record => {
    const tr = document.createElement("tr");

    const dateTd = document.createElement("td");
    dateTd.textContent = formatDateLabel(record.date);
    tr.appendChild(dateTd);

    if (isEditing) {
      tr.appendChild(createTimeEditCell(record, "clockIn"));
      tr.appendChild(createTimeEditCell(record, "clockOut"));
      tr.appendChild(createBreakEditCell(record));
    } else {
      tr.appendChild(createTextCell(record.clockIn || "—"));
      tr.appendChild(createTextCell(record.clockOut || "—"));
      tr.appendChild(createTextCell(record.breakMinutes == null ? "—" : `${record.breakMinutes}分`));
    }

    const actualTd = document.createElement("td");
    actualTd.dataset.actual = "true";
    actualTd.textContent = calculateActual(record);
    tr.appendChild(actualTd);

    attendanceBody.appendChild(tr);
  });
}

function createTextCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function createTimeEditCell(record, field) {
  const td = document.createElement("td");
  td.className = "editable-cell";

  const input = document.createElement("input");
  input.className = "editable-input";
  input.type = "time";
  input.value = record[field] || "";

  input.addEventListener("change", () => {
    record[field] = input.value || null;
    saveData();
    updateActualForRow(trFromCell(td), record);
  });

  input.addEventListener("input", () => {
    record[field] = input.value || null;
    updateActualForRow(trFromCell(td), record);
  });

  td.appendChild(input);
  return td;
}

function createBreakEditCell(record) {
  const td = document.createElement("td");
  td.className = "editable-cell";

  const input = document.createElement("input");
  input.className = "editable-input break-edit-input";
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "0";
  input.step = "1";
  input.value = record.breakMinutes ?? 0;

  const update = () => {
    const value = Number(input.value);
    if (Number.isInteger(value) && value >= 0) {
      record.breakMinutes = value;
      saveData();
      updateActualForRow(trFromCell(td), record);
    }
  };

  input.addEventListener("input", update);
  input.addEventListener("change", update);

  td.appendChild(input);
  return td;
}

function trFromCell(cell) {
  return cell.closest("tr");
}

function updateActualForRow(tr, record) {
  if (!tr) return;
  const actualCell = tr.querySelector('[data-actual="true"]');
  if (actualCell) {
    actualCell.textContent = calculateActual(record);
  }
}

function timeToMinutes(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateActual(record) {
  const start = timeToMinutes(record.clockIn);
  const end = timeToMinutes(record.clockOut);
  const breakMinutes = Number(record.breakMinutes);

  if (start == null || end == null || !Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return "—";
  }

  const actual = end - start - breakMinutes;

  if (actual < 0) {
    return "—";
  }

  const hours = Math.floor(actual / 60);
  const minutes = actual % 60;

  return `${hours}:${pad(minutes)}`;
}

function formatDateLabel(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${month}/${day}`;
}

function toggleEditMode() {
  isEditing = !isEditing;
  renderAttendance();
}
