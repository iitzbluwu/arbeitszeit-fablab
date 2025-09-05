// script.js

/**
 * Komplett neue Clear-Button-Logik:
 * 1) Das entsprechende dateKey wird aus dem Objekt gelöscht (`delete ...`).
 * 2) Dann reloaden wir den Hauptkalender und Mini-Kalender.
 * 3) Übersicht updaten.
 * 4) Aus dem Speicher entfernen wir den Eintrag und speichern neu.
 * 
 * Außerdem: Bessere Dark Mode Farben für Inputs und Tabellen.
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

let darkModeEnabled = false;

const gespeicherteDaten = {
    monate: {},
    jahresGesamt: 0
};

document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    setupMiniMonthDropdown();
    setupDarkModeToggle();
    loadLastSelectedMonth();
    berechneStunden();
});

/* Persistenz-Funktionen */
function loadFromLocalStorage() {
    const saved = localStorage.getItem('arbeitszeitData');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                Object.assign(gespeicherteDaten, parsed);
            }
        } catch (e) {
            console.warn("Konnte lokale Daten nicht laden:", e);
        }
    }
}

function saveToLocalStorage() {
    localStorage.setItem('arbeitszeitData', JSON.stringify(gespeicherteDaten));
}

/* Letzten Monat laden */
function loadLastSelectedMonth() {
    const savedMonthIndex = parseInt(localStorage.getItem('currentMonthIndex') || "0");
    generateCalendar(savedMonthIndex);
    buildMiniCalendar(savedMonthIndex);
    updateSummary(savedMonthIndex);
}

/* Dropdown Setup */
function setupMiniMonthDropdown() {
    const dropdownMenu = document.getElementById('miniMonthDropdownMenu');
    dropdownMenu.innerHTML = '';

    MONATE.forEach((m, index) => {
        const menuItem = document.createElement('a');
        menuItem.href = "#";
        menuItem.className = "dropdown-item";
        menuItem.innerText = m.name;
        menuItem.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem('currentMonthIndex', index);
            generateCalendar(index);
            buildMiniCalendar(index);
            updateSummary(index);
            document.getElementById('miniMonthDropdownLabel').textContent = m.name;
        });
        dropdownMenu.appendChild(menuItem);
    });
    document.getElementById('miniMonthDropdownLabel').textContent = MONATE[0].name;
}

function getCurrentMonthIndex() {
    return parseInt(localStorage.getItem('currentMonthIndex') || "0");
}

/* Haupkalender generieren */
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
    let aktuelleISOwoche = getISOWeekNumber(new Date(2025, gewählterMonat, 1));
    let currentWeek = aktuelleISOwoche;

    for (let tag = 1; tag <= tageImMonat; tag++) {
        const datum = new Date(2025, gewählterMonat, tag);
        const wochentagName = datum.toLocaleDateString('de-DE', { weekday: 'long' });
        const dateKey = `${String(tag).padStart(2,'0')}.${String(gewählterMonat+1).padStart(2,'0')}.2025`;

        if (!gespeicherteDaten.monate[gewählterMonat][dateKey]) {
            gespeicherteDaten.monate[gewählterMonat][dateKey] = { stunden: 0, notizen: '' };
        }
        const dayData = gespeicherteDaten.monate[gewählterMonat][dateKey];

        if (datum.getDay() === 1 || tag === 1) {
            if (currentWeekRows.length > 0) {
                attachWeekTooltip(currentWeekRows, currentWeek, gewählterMonat);
            }
            currentWeekRows = [];
            currentWeek = getISOWeekNumber(datum);

            const weekRow = document.createElement('tr');
            weekRow.classList.add('week-header-row');
            weekRow.innerHTML = `<td colspan="6" class="week-header" data-kw="${currentWeek}">Kalenderwoche ${currentWeek}</td>`;
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

        // KW-Abschluss bei Sonntag
        if (datum.getDay() === 0 && tag < tageImMonat) {
            attachWeekTooltip(currentWeekRows, currentWeek, gewählterMonat);
            currentWeekRows = [];
            currentWeek = getISOWeekNumber(new Date(2025, gewählterMonat, tag + 1));
        }
    }

    if (currentWeekRows.length > 0) {
        attachWeekTooltip(currentWeekRows, currentWeek, gewählterMonat);
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
}

/* KW-Stunden tooltip */
function attachWeekTooltip(weekRows, kw, gewählterMonat) {
    let sumWeekHours = 0;
    weekRows.forEach(row => {
        const dateCell = row.cells[2];
        if (!dateCell) return;
        const dateKey = dateCell.textContent.trim();
        sumWeekHours += gespeicherteDaten.monate[gewählterMonat][dateKey]?.stunden || 0;
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
    initTooltips();
}

/* Neue Clear-Button-Logik */
function clearDayData(monatIndex, dateKey) {
    if (gespeicherteDaten.monate[monatIndex][dateKey]) {
        delete gespeicherteDaten.monate[monatIndex][dateKey];
    }
    // Alles neu laden
    saveCurrentMonthData(monatIndex);
    updateSummary(monatIndex);
    buildMiniCalendar(monatIndex);
    generateCalendar(monatIndex);
}

/* Mini-Kalender */
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
    thead.innerHTML = `
      <tr>
        <th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const ersterTag = new Date(jahr, gewählterMonat, 1);
    let startWochentag = ersterTag.getDay();
    if (startWochentag === 0) startWochentag = 7;

    let row = document.createElement('tr');
    for (let i = 1; i < startWochentag; i++) {
        const emptyCell = document.createElement('td');
        row.appendChild(emptyCell);
    }

    for (let tag = 1; tag <= tageImMonat; tag++) {
        const cell = document.createElement('td');
        cell.innerHTML = tag;
        const dateKey = `${String(tag).padStart(2,'0')}.${String(gewählterMonat+1).padStart(2,'0')}.2025`;
        const dayData = gespeicherteDaten.monate[gewählterMonat][dateKey] || {stunden:0, notizen:''};
        const tagesStunden = dayData.stunden;

        if (tagesStunden > 0) {
            const intensity = Math.min(1, tagesStunden / 8);
            cell.style.backgroundColor = `rgba(129, 199, 132, ${0.2 + 0.8*intensity})`;
            cell.style.color = '#fff';
            cell.setAttribute('data-toggle', 'tooltip');
            cell.setAttribute('data-placement', 'top');
            cell.title = `Arbeitsstunden: ${tagesStunden.toFixed(2)}`;
        }

        cell.addEventListener('click', () => {
            scrollToDay(tag);
        });
        row.appendChild(cell);

        const currentDate = new Date(jahr, gewählterMonat, tag);
        if (currentDate.getDay() === 0) {
            tbody.appendChild(row);
            row = document.createElement('tr');
        }
    }

    if (row.childNodes.length > 0) {
        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    miniCalendarDiv.appendChild(table);
    initTooltips();
}

function initTooltips() {
    $(function() {
      $('[data-toggle="tooltip"]').tooltip();
    });
}

/* Zu bestimmtem Tag scrollen */
function scrollToDay(tag) {
    const tagString = tag.toString().padStart(2, '0');
    const currentMonth = getCurrentMonthIndex();
    const dateKeyPrefix = `${tagString}.${String(currentMonth+1).padStart(2,'0')}.2025`;

    const calendarRows = document.querySelectorAll('#calendar tbody tr');
    calendarRows.forEach(row => {
        const dateCell = row.cells[2];
        if (dateCell && dateCell.textContent.startsWith(dateKeyPrefix)) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.backgroundColor = '#fff9c4';
            setTimeout(() => {
                row.style.backgroundColor = '';
            }, 2000);
        }
    });
}

/* Speichern */
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

/* Jahresgesamtsumme */
function updateYearlyTotal() {
    let summe = 0;
    for (const monKey in gespeicherteDaten.monate) {
        const monData = gespeicherteDaten.monate[monKey];
        for (const dateKey in monData) {
            summe += monData[dateKey].stunden || 0;
        }
    }
    gespeicherteDaten.jahresGesamt = summe;
    saveToLocalStorage();
}

/* KW hervorheben */
function highlightCurrentWeek(tbody, gewählterMonat) {
    const aktuellesDatum = new Date();
    if (aktuellesDatum.getFullYear() === 2025 && aktuellesDatum.getMonth() === gewählterMonat) {
        const dayString = aktuellesDatum.getDate().toString().padStart(2, '0');
        const dateKeyPrefix = `${dayString}.${String(gewählterMonat+1).padStart(2,'0')}.2025`;
        const todayRow = [...tbody.rows].find(row => row.cells[2]?.textContent?.startsWith(dateKeyPrefix));
        if (todayRow) {
            const weekRow = todayRow.previousElementSibling;
            if (weekRow && weekRow.classList.contains('week-header-row')) {
                weekRow.classList.add('current-week');
            }
        }
    }
}

/* ISO-Wochenberechnung */
function getISOWeekNumber(date) {
    const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = (tempDate.getUTCDay() + 6) % 7;
    tempDate.setUTCDate(tempDate.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 4));
    const firstThuDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThuDayNum + 3);
    return 1 + Math.round((tempDate - firstThursday) / (7 * 24 * 3600 * 1000));
}

/* EventListener Eingaben */
function berechneStunden() {
    document.body.addEventListener('input', (event) => {
        if (!event.target.classList.contains('time-input') && !event.target.classList.contains('notes-input')) return;

        const currentMonth = getCurrentMonthIndex();
        saveCurrentMonthData(currentMonth);
        updateSummary(currentMonth);
        buildMiniCalendar(currentMonth);
    });
}

/* Update Übersicht */
function updateSummary(currentMonth) {
    if (!gespeicherteDaten.monate[currentMonth]) {
        gespeicherteDaten.monate[currentMonth] = {};
    }

    let monatsStunden = 0;
    for (const dateKey in gespeicherteDaten.monate[currentMonth]) {
        monatsStunden += gespeicherteDaten.monate[currentMonth][dateKey].stunden || 0;
    }

    let jahresStunden = 0;
    for (const monKey in gespeicherteDaten.monate) {
        for (const dayKey in gespeicherteDaten.monate[monKey]) {
            jahresStunden += gespeicherteDaten.monate[monKey][dayKey].stunden || 0;
        }
    }
    gespeicherteDaten.jahresGesamt = jahresStunden;

    document.getElementById('monthlyHours').textContent = monatsStunden.toFixed(2);
    document.getElementById('yearlyHours').textContent = jahresStunden.toFixed(2);

    const verbleibend = MONATLICHE_SOLL_STUNDEN - monatsStunden;
    document.getElementById('remainingHours').textContent = verbleibend.toFixed(2);
    document.getElementById('earnings').textContent = `€${(monatsStunden * STUNDENLOHN).toFixed(2)}`;

    const remainEl = document.getElementById('remainingHours');
    remainEl.classList.toggle('text-success', verbleibend >= 0);
    remainEl.classList.toggle('text-danger', verbleibend < 0);

    const progressBar = document.getElementById('progressBar');
    let progressPercent = (monatsStunden / MONATLICHE_SOLL_STUNDEN) * 100;
    progressPercent = Math.max(0, Math.min(100, progressPercent));
    progressBar.style.width = `${progressPercent.toFixed(0)}%`;
    progressBar.textContent = `${progressPercent.toFixed(0)}%`;

    saveToLocalStorage();
}

/* Dark Mode Button */
function setupDarkModeToggle() {
    const btn = document.getElementById('toggleDarkModeBtn');
    btn.addEventListener('click', () => {
        darkModeEnabled = !darkModeEnabled;
        document.body.classList.toggle('dark-mode', darkModeEnabled);
        btn.textContent = darkModeEnabled ? 'Light Mode' : 'Dark Mode';
    });
}
