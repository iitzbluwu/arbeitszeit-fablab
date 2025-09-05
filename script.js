// script.js

/**
 * Arbeitszeiterfassung 2025 – GitHub Pages ready
 * - Persistenz: localStorage (schreiben in JSON-Dateien ist auf Pages nicht möglich)
 * - Optionales Seed: ./arbeitszeit.json wird einmalig geladen, falls kein localStorage existiert
 * - Bootstrap Tooltips aktiv (jQuery slim reicht, da kein AJAX genutzt wird)
 */

const MONATE = [
  { name: "Januar", tage: 31 },
  { name: "Februar", tage: 28 },
  { name: "März", tage: 31 },
  { name: "April", tage: 30 },
  { name: "Mai", tage: 31 },
  { name: "Juni", tage: 30 },
  { name: "Juli", tage: 31 },
  { name: "August", tage: 31 },
  { name: "September", tage: 30 },
  { name: "Oktober", tage: 31 },
  { name: "November", tage: 30 },
  { name: "Dezember", tage: 31 }
];

const MONATLICHE_SOLL_STUNDEN = 32;
const MONATLICHES_GEHALT = 444.30;
const STUNDENLOHN = MONATLICHES_GEHALT / MONATLICHE_SOLL_STUNDEN;

const LS_KEY = 'arbeitszeitData';
let darkModeEnabled = false;

// interner Zustand
const gespeicherteDaten = {
  monate: {},
  jahresGesamt: 0
};

/* ---------- Bootstrap Tooltips ---------- */
function initTooltips() {
  if (typeof $ === 'function' && typeof $.fn.tooltip === 'function') {
    $(function () { $('[data-toggle="tooltip"]').tooltip(); });
  }
}

/* ---------- Persistenz ---------- */
function loadFromLocalStorage() {
  const saved = localStorage.getItem(LS_KEY);
  if (!saved) return false;
  try {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      Object.assign(gespeicherteDaten, parsed);
      return true;
    }
  } catch (e) {
    console.warn('LocalStorage parse error:', e);
  }
  return false;
}

function saveToLocalStorage() {
  localStorage.setItem(LS_KEY, JSON.stringify(gespeicherteDaten));
}

async function loadSeedIfEmpty() {
  // Nur laden, wenn noch nichts im localStorage
  if (Object.keys(gespeicherteDaten.monate).length > 0) return;
  try {
    const res = await fetch('./arbeitszeit.json', { cache: 'no-store' });
    if (res.ok) {
      const seed = await res.json();
      if (seed && typeof seed === 'object') {
        // Erwartete Form: { monate: {}, jahresGesamt: 0 }
        gespeicherteDaten.monate = seed.monate ?? {};
        gespeicherteDaten.jahresGesamt = Number(seed.jahresGesamt) || 0;
        saveToLocalStorage();
      }
    }
  } catch (e) {
    // Kein Netz/kein Seed: ignorieren, wir arbeiten leer weiter
    console.info('Seed not loaded, continue with empty state.');
  }
}

/* ---------- Setup ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  const hadLocal = loadFromLocalStorage();
  if (!hadLocal) {
    await loadSeedIfEmpty();
  }

  setupMiniMonthDropdown();
  setupDarkModeToggle();
  setupLiveRecalc();

  // initialen Monat wählen: aus localStorage oder 0
  const monthIndex = getCurrentMonthIndex();
  generateCalendar(monthIndex);
  buildMiniCalendar(monthIndex);
  updateSummary(monthIndex);
  initTooltips();
});

/* ---------- UI Helfer ---------- */
function getCurrentMonthIndex() {
  return parseInt(localStorage.getItem('currentMonthIndex') || "0");
}

function setupMiniMonthDropdown() {
  const dropdownMenu = document.getElementById('miniMonthDropdownMenu');
  const label = document.getElementById('miniMonthDropdownLabel');
  dropdownMenu.innerHTML = '';

  MONATE.forEach((m, index) => {
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'dropdown-item';
    a.innerText = m.name;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.setItem('currentMonthIndex', index);
      generateCalendar(index);
      buildMiniCalendar(index);
      updateSummary(index);
      label.textContent = m.name;
      initTooltips();
    });
    dropdownMenu.appendChild(a);
  });

  const initial = getCurrentMonthIndex();
  label.textContent = MONATE[initial]?.name ?? MONATE[0].name;
}

/* ---------- Kalender ---------- */
function generateCalendar(gewählterMonat) {
  const kalenderDiv = document.getElementById('calendar');
  kalenderDiv.innerHTML = '';

  if (!gespeicherteDaten.monate[gewählterMonat]) {
    gespeicherteDaten.monate[gewählterMonat] = {};
  }

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 50px;">KW</th>
        <th style="width: 110px;">Wochentag</th>
        <th style="width: 90px;">Datum</th>
        <th style="width:120px;">Stunden</th>
        <th style="min-width:160px;">Notizen</th>
        <th style="width:50px;">Clear</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');

  let currentWeekRows = [];
  const tageImMonat = MONATE[gewählterMonat].tage;

  for (let tag = 1; tag <= tageImMonat; tag++) {
    const datum = new Date(2025, gewählterMonat, tag);
    const wochentagName = datum.toLocaleDateString('de-DE', { weekday: 'long' });
    const dateKey = `${String(tag).padStart(2,'0')}.${String(gewählterMonat+1).padStart(2,'0')}.2025`;

    if (!gespeicherteDaten.monate[gewählterMonat][dateKey]) {
      gespeicherteDaten.monate[gewählterMonat][dateKey] = { stunden: 0, notizen: '' };
    }
    const dayData = gespeicherteDaten.monate[gewählterMonat][dateKey];

    // Wochenkopf einfügen, wenn Montag oder Monatsanfang
    if (datum.getDay() === 1 || tag === 1) {
      if (currentWeekRows.length > 0) {
        attachWeekTooltip(currentWeekRows, gewählterMonat);
      }
      currentWeekRows = [];
      const weekRow = document.createElement('tr');
      weekRow.classList.add('week-header-row');
      const kwNum = getISOWeekNumber(datum);
      weekRow.innerHTML = `<td colspan="6" class="week-header" data-kw="${kwNum}">Kalenderwoche ${kwNum}</td>`;
      tbody.appendChild(weekRow);
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${getISOWeekNumber(datum)}</td>
      <td>${wochentagName}</td>
      <td>${dateKey}</td>
      <td>
        <input type="number" class="time-input" step="0.5" min="0" max="24" placeholder="0.0" value="${dayData.stunden}">
      </td>
      <td>
        <input type="text" class="notes-input" placeholder="Notizen" value="${dayData.notizen}">
      </td>
      <td>
        <button class="clear-btn" data-datekey="${dateKey}">X</button>
      </td>
    `;
    tbody.appendChild(row);
    currentWeekRows.push(row);

    // Wochenabschluss am Sonntag
    if (datum.getDay() === 0 && tag < tageImMonat) {
      attachWeekTooltip(currentWeekRows, gewählterMonat);
      currentWeekRows = [];
    }
  }

  if (currentWeekRows.length > 0) {
    attachWeekTooltip(currentWeekRows, gewählterMonat);
  }

  table.appendChild(tbody);
  const wrapper = document.createElement('div');
  wrapper.classList.add('calendar-table');
  wrapper.appendChild(table);
  kalenderDiv.appendChild(wrapper);

  highlightCurrentWeek(tbody, gewählterMonat);

  // Clear-Buttons
  tbody.querySelectorAll('.clear-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dateKey = btn.dataset.datekey;
      clearDayData(gewählterMonat, dateKey);
    });
  });

  initTooltips();
}

/* Summe je KW als Tooltip */
function attachWeekTooltip(weekRows, gewählterMonat) {
  let sumWeekHours = 0;
  weekRows.forEach(row => {
    const dateCell = row.cells[2];
    if (!dateCell) return;
    const dateKey = dateCell.textContent.trim();
    sumWeekHours += (gespeicherteDaten.monate[gewählterMonat][dateKey]?.stunden || 0);
  });
  const firstRow = weekRows[0];
  if (!firstRow) return;
  let kwRow = firstRow.previousElementSibling;
  while (kwRow && !kwRow.classList.contains('week-header-row')) {
    kwRow = kwRow.previousElementSibling;
  }
  if (kwRow) {
    const kwCell = kwRow.querySelector('.week-header');
    kwCell.setAttribute('data-toggle', 'tooltip');
    kwCell.setAttribute('title', `Summe dieser KW: ${sumWeekHours.toFixed(2)} h`);
  }
}

/* Tagesdaten löschen */
function clearDayData(monatIndex, dateKey) {
  if (gespeicherteDaten.monate[monatIndex][dateKey]) {
    delete gespeicherteDaten.monate[monatIndex][dateKey];
  }
  saveCurrentMonthData(monatIndex); // schreibt zurück, berechnet Jahr
  updateSummary(monatIndex);
  buildMiniCalendar(monatIndex);
  generateCalendar(monatIndex);
}

/* Mini-Kalender unten rechts */
function buildMiniCalendar(gewählterMonat) {
  const miniCalendarDiv = document.getElementById('miniCalendar');
  miniCalendarDiv.innerHTML = '';

  if (!gespeicherteDaten.monate[gewählterMonat]) {
    gespeicherteDaten.monate[gewählterMonat] = {};
  }

  const jahr = 2025;
  const tageImMonat = MONATE[gewählterMonat].tage;

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const ersterTag = new Date(jahr, gewählterMonat, 1);
  let startWochentag = ersterTag.getDay();
  if (startWochentag === 0) startWochentag = 7;

  let row = document.createElement('tr');
  for (let i = 1; i < startWochentag; i++) {
    row.appendChild(document.createElement('td'));
  }

  for (let tag = 1; tag <= tageImMonat; tag++) {
    const cell = document.createElement('td');
    cell.textContent = tag;
    const dateKey = `${String(tag).padStart(2,'0')}.${String(gewählterMonat+1).padStart(2,'0')}.2025`;
    const dayData = gespeicherteDaten.monate[gewählterMonat][dateKey] || { stunden: 0, notizen: '' };
    const tagesStunden = Number(dayData.stunden) || 0;

    if (tagesStunden > 0) {
      const intensity = Math.min(1, tagesStunden / 8);
      cell.style.backgroundColor = `rgba(129,199,132, ${0.2 + 0.8 * intensity})`;
      cell.style.color = '#fff';
      cell.setAttribute('data-toggle', 'tooltip');
      cell.setAttribute('data-placement', 'top');
      cell.title = `Arbeitsstunden: ${tagesStunden.toFixed(2)}`;
    }

    cell.addEventListener('click', () => { scrollToDay(tag); });
    row.appendChild(cell);

    const currentDate = new Date(jahr, gewählterMonat, tag);
    if (currentDate.getDay() === 0) {
      tbody.appendChild(row);
      row = document.createElement('tr');
    }
  }

  if (row.childNodes.length > 0) tbody.appendChild(row);

  table.appendChild(tbody);
  miniCalendarDiv.appendChild(table);
  initTooltips();
}

/* Scroll zum Tag in Hauptkalender */
function scrollToDay(tag) {
  const tagString = tag.toString().padStart(2, '0');
  const currentMonth = getCurrentMonthIndex();
  const dateKeyPrefix = `${tagString}.${String(currentMonth + 1).padStart(2, '0')}.2025`;

  const rows = document.querySelectorAll('#calendar tbody tr');
  rows.forEach(row => {
    const dateCell = row.cells[2];
    if (dateCell && dateCell.textContent.startsWith(dateKeyPrefix)) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.backgroundColor = '#fff9c4';
      setTimeout(() => { row.style.backgroundColor = ''; }, 2000);
    }
  });
}

/* Eingaben live verarbeiten */
function setupLiveRecalc() {
  document.body.addEventListener('input', (event) => {
    if (!event.target.classList.contains('time-input') &&
        !event.target.classList.contains('notes-input')) return;

    const currentMonth = getCurrentMonthIndex();
    saveCurrentMonthData(currentMonth);
    updateSummary(currentMonth);
    buildMiniCalendar(currentMonth);
  });
}

/* Monat speichern + Jahr neu berechnen */
function saveCurrentMonthData(currentMonth) {
  const rows = document.querySelectorAll('#calendar tbody tr');
  let totalHours = 0;

  rows.forEach(row => {
    const dateCell = row.cells[2];
    if (!dateCell) return;
    const dateKey = dateCell.textContent.trim();

    const hourInput = row.querySelector('.time-input');
    const notesInput = row.querySelector('.notes-input');
    if (!hourInput || !notesInput) return;

    const stunden = parseFloat(hourInput.value) || 0;
    const notizen = notesInput.value || '';

    gespeicherteDaten.monate[currentMonth][dateKey] = { stunden, notizen };
    totalHours += stunden;
  });

  updateYearlyTotal();
  saveToLocalStorage();
}

/* Jahresgesamt neu berechnen */
function updateYearlyTotal() {
  let summe = 0;
  for (const monKey in gespeicherteDaten.monate) {
    const monData = gespeicherteDaten.monate[monKey];
    for (const dateKey in monData) {
      summe += Number(monData[dateKey].stunden) || 0;
    }
  }
  gespeicherteDaten.jahresGesamt = summe;
  saveToLocalStorage();
}

/* Heutige KW hervorheben (nur wenn aktueller Monat = 2025/<mon>) */
function highlightCurrentWeek(tbody, gewählterMonat) {
  const heute = new Date();
  if (heute.getFullYear() === 2025 && heute.getMonth() === gewählterMonat) {
    const dayString = heute.getDate().toString().padStart(2, '0');
    const dateKeyPrefix = `${dayString}.${String(gewählterMonat + 1).padStart(2, '0')}.2025`;
    const todayRow = [...tbody.rows].find(r => r.cells[2]?.textContent?.startsWith(dateKeyPrefix));
    if (todayRow) {
      const weekRow = todayRow.previousElementSibling;
      if (weekRow && weekRow.classList.contains('week-header-row')) {
        weekRow.classList.add('current-week');
      }
    }
  }
}

/* ISO-Woche */
function getISOWeekNumber(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const firstThuDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThuDayNum + 3);
  return 1 + Math.round((tmp - firstThursday) / (7 * 24 * 3600 * 1000));
}

/* Übersicht aktualisieren */
function updateSummary(currentMonth) {
  if (!gespeicherteDaten.monate[currentMonth]) {
    gespeicherteDaten.monate[currentMonth] = {};
  }

  let monatsStunden = 0;
  for (const dateKey in gespeicherteDaten.monate[currentMonth]) {
    monatsStunden += Number(gespeicherteDaten.monate[currentMonth][dateKey].stunden) || 0;
  }

  let jahresStunden = 0;
  for (const monKey in gespeicherteDaten.monate) {
    for (const dayKey in gespeicherteDaten.monate[monKey]) {
      jahresStunden += Number(gespeicherteDaten.monate[monKey][dayKey].stunden) || 0;
    }
  }
  gespeicherteDaten.jahresGesamt = jahresStunden;

  // UI
  const mEl = document.getElementById('monthlyHours');
  const yEl = document.getElementById('yearlyHours');
  const rEl = document.getElementById('remainingHours');
  const eEl = document.getElementById('earnings');
  const pBar = document.getElementById('progressBar');

  if (mEl) mEl.textContent = monatsStunden.toFixed(2);
  if (yEl) yEl.textContent = jahresStunden.toFixed(2);

  const verbleibend = MONATLICHE_SOLL_STUNDEN - monatsStunden;
  if (rEl) {
    rEl.textContent = verbleibend.toFixed(2);
    rEl.classList.toggle('text-success', verbleibend >= 0);
    rEl.classList.toggle('text-danger', verbleibend < 0);
  }

  if (eEl) eEl.textContent = `€${(monatsStunden * STUNDENLOHN).toFixed(2)}`;

  let progressPercent = (monatsStunden / MONATLICHE_SOLL_STUNDEN) * 100;
  progressPercent = Math.max(0, Math.min(100, progressPercent));
  if (pBar) {
    pBar.style.width = `${progressPercent.toFixed(0)}%`;
    pBar.textContent = `${progressPercent.toFixed(0)}%`;
  }

  saveToLocalStorage();
}

/* Dark Mode */
function setupDarkModeToggle() {
  const btn = document.getElementById('toggleDarkModeBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    darkModeEnabled = !darkModeEnabled;
    document.body.classList.toggle('dark-mode', darkModeEnabled);
    btn.textContent = darkModeEnabled ? 'Light Mode' : 'Dark Mode';
  });
}
