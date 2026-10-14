// Urban Mobility Data Explorer: script.js

// 1. SETTINGS
const API_BASE = "http://localhost:5000/api"; // backend address
const PAGE_SIZE = 20;                         // trips per table page

const TEAL = "#0f8b8d";
const YELLOW = "#f2a900";

// What the dashboard currently shows
const state = {
  filters: {},
  sortBy: "pickup_datetime",
  order: "desc",
  page: 1
};

// Shortcut for document.getElementById
const $ = (id) => document.getElementById(id);

// 2. GETTING DATA

// Sends a request to the backend and returns the answer
async function getJSON(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE}${path}?${query}`);
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

// The backend uses different filter names from the form. This translates them.
function toApiParams(f) {
  const names = {
    date_from: "start_date", date_to: "end_date",
    distance_min: "min_distance", distance_max: "max_distance",
    fare_min: "min_fare", fare_max: "max_fare"
  };
  const params = {};
  for (const key in f) params[names[key] || key] = f[key];
  return params;
}

// Table sorting: dashboard name -> database column name
const SORT_COLUMNS = {
  pickup_datetime: "tpep_pickup_datetime",
  fare_amount: "total_amount",
  trip_distance: "trip_distance",
  trip_duration_min: "trip_duration_mins"
};

// Renames one backend trip to the names the dashboard uses
function fromApiTrip(t) {
  return {
    pickup_datetime: t.tpep_pickup_datetime.replace(" ", "T"),
    pickup_zone: t.PUZone,
    pickup_borough: t.PUBorough,
    dropoff_zone: t.DOZone,
    dropoff_borough: t.DOBorough,
    trip_distance: t.trip_distance,
    trip_duration_min: t.trip_duration_mins,
    fare_amount: t.total_amount,
    tip_amount: t.tip_amount,
    avg_speed_mph: t.avg_speed_mph,
    fare_per_mile: t.fare_per_mile,
    is_rush_hour: t.is_rush_hour
  };
}

// Overall statistics for the whole dataset. They do not change with the
// filters, so we ask the backend once and keep the answer.
let overall = null;
async function getOverallStats() {
  if (!overall) overall = await getJSON("/stats");
  return overall;
}

// One page of trips for the table, already sorted
// We ask for one extra trip to find out whether a next page exists.
async function getTrips() {
  const rows = await getJSON("/trips", {
    ...toApiParams(state.filters),
    sort_by: SORT_COLUMNS[state.sortBy],
    order: state.order,
    limit: PAGE_SIZE + 1,
    offset: (state.page - 1) * PAGE_SIZE
  });
  return {
    trips: rows.slice(0, PAGE_SIZE).map(fromApiTrip),
    hasNext: rows.length > PAGE_SIZE
  };
}

// Up to 300 matching trips for the scatter chart
async function getSampleTrips() {
  const rows = await getJSON("/trips", { ...toApiParams(state.filters), limit: 300 });
  return rows.map(fromApiTrip);
}

// 3. FILTERS

// Reads the form and keeps only the boxes that were filled in
function readFilters() {
  const filters = {};
  for (const [name, value] of new FormData($("filter-form")).entries()) {
    if (value !== "") filters[name] = value;
  }
  return filters;
}

// Turns a date or a number into a number so two values can be compared
function toNumber(value) {
  return isNaN(value) ? new Date(value).getTime() : Number(value);
}

// Checks that every "min" is not bigger than its "max". Returns an error message or "".
function checkFilters(f) {
  const pairs = [
    ["date_from", "date_to", "The start date must be before the end date."],
    ["distance_min", "distance_max", "The minimum distance is bigger than the maximum."],
    ["fare_min", "fare_max", "The minimum fare is bigger than the maximum."]
  ];
  for (const [low, high, message] of pairs) {
    if (f[low] && f[high] && toNumber(f[low]) > toNumber(f[high])) return message;
  }
  return "";
}

// When "Apply filters" is clicked
function applyFilters(event) {
  event.preventDefault(); // stops the page from reloading
  const filters = readFilters();
  const error = checkFilters(filters);
  $("filter-error").textContent = error;
  $("filter-error").hidden = error === "";
  if (error) return;
  state.filters = filters;
  state.page = 1;
  refreshDashboard();
}

// When "Clear" is clicked
function clearFilters() {
  state.filters = {};
  state.page = 1;
  $("filter-error").hidden = true;
  refreshDashboard();
}

// 4. SHOWING NUMBERS AND TEXT

function money(value) {
  return "$" + Number(value).toFixed(2);
}

function formatDate(text) {
  return new Date(text).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

// Fills the five summary cards
function showSummary(s) {
  $("stat-trips").textContent = Number(s.total_trips).toLocaleString();
  $("stat-fare").textContent = money(s.average_fare);
  $("stat-distance").textContent = Number(s.average_distance).toFixed(1) + " mi";
  $("stat-duration").textContent = Math.round(s.average_duration) + " min";
  $("stat-speed").textContent = Number(s.average_speed).toFixed(1) + " mph";
}

// Adds one cell to a table row
function addCell(row, text, className = "") {
  const cell = row.insertCell();
  cell.textContent = text;
  cell.className = className;
}

// Fills the trips table
function showTable(trips) {
  const body = $("trips-body");
  body.innerHTML = "";
  if (trips.length === 0) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No trips match these filters.</td></tr>';
    return;
  }
  for (const trip of trips) {
    const row = body.insertRow();
    addCell(row, formatDate(trip.pickup_datetime));
    addCell(row, trip.pickup_zone);
    addCell(row, trip.dropoff_zone);
    addCell(row, Number(trip.trip_distance).toFixed(1), "num");
    addCell(row, Math.round(trip.trip_duration_min), "num");
    addCell(row, money(trip.fare_amount), "num");

    const button = document.createElement("button");
    button.textContent = "View";
    button.className = "btn-secondary";
    button.addEventListener("click", () => showDetails(trip));
    row.insertCell().appendChild(button);
  }
}


async function showRanking() {
    const list = $("ranking-list");

    try {
        const rankings = await getJSON("/ranking");

        list.innerHTML = "";

        for (const location of rankings) {
            const item = document.createElement("li");

            item.textContent =
                `${location.zone ?? "Unknown zone"} (${Number(location.trip_count).toLocaleString()} trips)`;

            list.appendChild(item);
        }

        if (rankings.length === 0) {
            list.innerHTML = "<li>No ranking data available</li>";
        }
    } catch (error) {
        list.innerHTML = "<li>Could not load rankings</li>";
        console.error(error);
    }
}


// "Page 1" and the Previous / Next buttons
function showPagination(hasNext) {
  $("page-info").textContent = `Page ${state.page}`;
  $("prev-page").disabled = state.page <= 1;
  $("next-page").disabled = !hasNext;
}

// Opens the popup with all the details of one trip
function showDetails(trip) {
  const list = $("trip-detail");
  list.innerHTML = "";
  const fields = [
    ["Pickup time", formatDate(trip.pickup_datetime)],
    ["Pickup", `${trip.pickup_zone} (${trip.pickup_borough})`],
    ["Dropoff", `${trip.dropoff_zone} (${trip.dropoff_borough})`],
    ["Distance", Number(trip.trip_distance).toFixed(1) + " mi"],
    ["Duration", Math.round(trip.trip_duration_min) + " min"],
    ["Total fare", money(trip.fare_amount)],
    ["Tip", money(trip.tip_amount)],
    ["Average speed", Number(trip.avg_speed_mph).toFixed(1) + " mph"],
    ["Fare per mile", money(trip.fare_per_mile)],
    ["Rush hour", trip.is_rush_hour ? "Yes" : "No"]
  ];
  for (const [label, value] of fields) {
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    list.append(term, detail);
  }
  $("trip-dialog").showModal();
}

// 5. CHARTS
const charts = {}; // remembers each chart so it can be replaced

// Draws a chart, removing the old one first
function drawChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}

// Overall share of trips starting in each borough
function showBoroughChart(boroughs) {
  drawChart("chart-borough", {
    type: "doughnut",
    data: {
      labels: boroughs.map((b) => b.borough),
      datasets: [{
        data: boroughs.map((b) => b.trip_count),
        backgroundColor: [TEAL, "#14213d", YELLOW, "#5a6478", "#9bb8c9", "#c9d1e0", "#7C5CBF"]
      }]
    },
    options: { plugins: { legend: { position: "bottom" } } }
  });
}

// Each dot is one trip
function showScatterChart(trips) {
  drawChart("chart-scatter", {
    type: "scatter",
    data: {
      datasets: [{
        data: trips.map((t) => ({ x: Number(t.trip_distance), y: Number(t.fare_amount) })),
        backgroundColor: TEAL
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Distance (miles)" } },
        y: { title: { display: true, text: "Total fare ($)" } }
      }
    }
  });
}

// 6. UPDATING EVERYTHING
// Gets fresh data and redraws the whole dashboard
async function refreshDashboard() {
  $("data-status").textContent = "Loading data...";
  try {
    const [stats, tripData, sample] = await Promise.all([
      getOverallStats(), getTrips(), getSampleTrips()
    ]);
    showSummary(stats.summary);
    showBoroughChart(stats.borough_distribution);
    showTable(tripData.trips);
    showPagination(tripData.hasNext);
    showScatterChart(sample);
    showRanking()
    $("data-status").textContent =
      `Connected: ${Number(stats.summary.total_trips).toLocaleString()} trips in the dataset`;
  } catch (error) {
    $("data-status").textContent = "Could not load data. Is the backend running?";
    console.error(error);
  }
}

// Sorting dropdowns
function updateSort() {
  state.sortBy = $("sort-by").value;
  state.order = $("sort-order").value;
  state.page = 1;
  refreshDashboard();
}

// 7. START
$("filter-form").addEventListener("submit", applyFilters);
$("filter-form").addEventListener("reset", clearFilters);
$("sort-by").addEventListener("change", updateSort);
$("sort-order").addEventListener("change", updateSort);
$("prev-page").addEventListener("click", () => { state.page--; refreshDashboard(); });
$("next-page").addEventListener("click", () => { state.page++; refreshDashboard(); });

// Clicking a column heading sorts by it (click again to flip the direction)
for (const heading of document.querySelectorAll("th[data-sort]")) {
  heading.addEventListener("click", () => {
    const sameColumn = $("sort-by").value === heading.dataset.sort;
    const wasDescending = $("sort-order").value === "desc";
    $("sort-by").value = heading.dataset.sort;
    $("sort-order").value = sameColumn && wasDescending ? "asc" : "desc";
    updateSort();
  });
}

async function start() {
  try {
    // Fill the borough dropdown with the real borough names from the database
    const stats = await getOverallStats();
    for (const row of stats.borough_distribution) {
      $("borough").add(new Option(row.borough, row.borough));
    }
  } catch (error) {
    console.error(error); // refreshDashboard shows the error message
  }
  refreshDashboard();
}
start();
