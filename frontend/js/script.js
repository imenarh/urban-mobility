// ===== Urban Mobility Data Explorer: script.js =====

// ===== 1. SETTINGS =====
const API_BASE = "http://localhost:5000/api"; // backend address
const USE_MOCK = true;                        // true = fake data, false = real backend
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

// ===== 2. FAKE DATA (only used while USE_MOCK is true) =====
const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

const ZONES = [
  { zone: "Midtown Center", borough: "Manhattan", lat: 40.7549, lng: -73.984 },
  { zone: "Upper East Side", borough: "Manhattan", lat: 40.7736, lng: -73.9566 },
  { zone: "East Village", borough: "Manhattan", lat: 40.7265, lng: -73.9815 },
  { zone: "Williamsburg", borough: "Brooklyn", lat: 40.7081, lng: -73.9571 },
  { zone: "Downtown Brooklyn", borough: "Brooklyn", lat: 40.6928, lng: -73.9903 },
  { zone: "JFK Airport", borough: "Queens", lat: 40.6413, lng: -73.7781 },
  { zone: "LaGuardia Airport", borough: "Queens", lat: 40.7769, lng: -73.874 },
  { zone: "Astoria", borough: "Queens", lat: 40.7644, lng: -73.9235 },
  { zone: "South Bronx", borough: "Bronx", lat: 40.8176, lng: -73.9182 },
  { zone: "St. George", borough: "Staten Island", lat: 40.6437, lng: -74.0735 }
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Makes up trips with the same field names the dashboard uses
function makeMockTrips(count) {
  const trips = [];
  for (let i = 0; i < count; i++) {
    const pickup = pickRandom(ZONES);
    const distance = +(Math.random() * 12 + 0.5).toFixed(1);
    const duration = Math.round(distance * 3 + Math.random() * 10 + 3);
    const fare = +(3 + distance * 2.8 + Math.random() * 3).toFixed(2);
    const when = new Date(2025, 0, 1 + Math.floor(Math.random() * 31),
                          Math.floor(Math.random() * 24),
                          Math.floor(Math.random() * 60));
    trips.push({
      pickup_datetime: when.toISOString(),
      pickup_zone: pickup.zone,
      pickup_borough: pickup.borough,
      dropoff_zone: pickRandom(ZONES).zone,
      trip_distance: distance,
      trip_duration_min: duration,
      fare_amount: fare,
      tip_amount: +(fare * Math.random() * 0.25).toFixed(2),
      avg_speed_mph: +(distance / (duration / 60)).toFixed(1)
    });
  }
  return trips;
}

const MOCK_TRIPS = USE_MOCK ? makeMockTrips(400) : [];

// Keeps only the fake trips that match the filters
function filterMockTrips(f) {
  return MOCK_TRIPS.filter((trip) => {
    const time = new Date(trip.pickup_datetime);
    if (f.date_from && time < new Date(f.date_from)) return false;
    if (f.date_to && time > new Date(f.date_to + "T23:59:59")) return false;
    if (f.hour_from && time.getHours() < Number(f.hour_from)) return false;
    if (f.hour_to && time.getHours() > Number(f.hour_to)) return false;
    if (f.borough && trip.pickup_borough !== f.borough) return false;
    if (f.zone && trip.pickup_zone !== f.zone) return false;
    if (f.distance_min && trip.trip_distance < Number(f.distance_min)) return false;
    if (f.distance_max && trip.trip_distance > Number(f.distance_max)) return false;
    if (f.fare_min && trip.fare_amount < Number(f.fare_min)) return false;
    if (f.fare_max && trip.fare_amount > Number(f.fare_max)) return false;
    return true;
  });
}

// Average of one field across a list of trips
function average(trips, field) {
  if (trips.length === 0) return 0;
  let sum = 0;
  for (const trip of trips) sum += trip[field];
  return sum / trips.length;
}

// ===== 3. GETTING DATA =====
// Each function returns fake data or asks the backend, depending on USE_MOCK.

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
    fare_min: "min_fare", fare_max: "max_fare",
    zone: "location_id"
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
  trip_duration_min: "trip_duration_mins",
  avg_speed_mph: "avg_speed_mph"
};

// Renames one backend trip to the names the dashboard uses
function fromApiTrip(t) {
  return {
    pickup_datetime: t.tpep_pickup_datetime.replace(" ", "T"),
    pickup_zone: t.PUZone,
    pickup_borough: t.PUBorough,
    dropoff_zone: t.DOZone,
    trip_distance: t.trip_distance,
    trip_duration_min: t.trip_duration_mins,
    fare_amount: t.total_amount,
    tip_amount: t.tip_amount,
    avg_speed_mph: t.avg_speed_mph
  };
}

// List of zones for the dropdowns
async function getZones() {
  if (USE_MOCK) return ZONES;
  return getJSON("/zones"); // [{id, zone, borough}]
}

// Totals for the summary cards
async function getSummary() {
  if (!USE_MOCK) {
    const s = (await getJSON("/stats", toApiParams(state.filters))).summary;
    return {
      trips: s.total_trips,
      avg_fare: s.average_fare,
      avg_distance: s.average_distance,
      avg_duration: s.average_duration,
      avg_speed: s.average_speed,
      avg_tip: s.average_tip
    };
  }
  const trips = filterMockTrips(state.filters);
  return {
    trips: trips.length,
    avg_fare: average(trips, "fare_amount"),
    avg_distance: average(trips, "trip_distance"),
    avg_duration: average(trips, "trip_duration_min"),
    avg_speed: average(trips, "avg_speed_mph"),
    avg_tip: average(trips, "tip_amount")
  };
}

// One page of trips for the table, already sorted
async function getTrips() {
  if (!USE_MOCK) {
    const rows = await getJSON("/trips", {
      ...toApiParams(state.filters),
      sort_by: SORT_COLUMNS[state.sortBy],
      order: state.order,
      limit: PAGE_SIZE,
      offset: (state.page - 1) * PAGE_SIZE
    });
    return { trips: rows.map(fromApiTrip) };
  }
  const trips = filterMockTrips(state.filters);
  const key = state.sortBy;
  trips.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0));
  if (state.order === "desc") trips.reverse();
  const start = (state.page - 1) * PAGE_SIZE;
  return { trips: trips.slice(start, start + PAGE_SIZE) };
}

// Up to 300 trips for the scatter chart
async function getSampleTrips() {
  if (!USE_MOCK) {
    const rows = await getJSON("/trips", { ...toApiParams(state.filters), limit: 300 });
    return rows.map(fromApiTrip);
  }
  return filterMockTrips(state.filters).slice(0, 300);
}

// Trips and average speed for each hour (0 to 23)
async function getHourly() {
  if (!USE_MOCK) {
    const rows = await getJSON("/stats/hourly", toApiParams(state.filters));
    // fill in hours with no trips so the chart always shows 24 bars
    return Array.from({ length: 24 }, (_, hour) =>
      rows.find((r) => r.hour === hour) || { hour, trips: 0, avg_speed: 0 });
  }
  const trips = filterMockTrips(state.filters);
  const result = [];
  for (let hour = 0; hour < 24; hour++) {
    const inHour = trips.filter((t) => new Date(t.pickup_datetime).getHours() === hour);
    result.push({ hour, trips: inHour.length, avg_speed: average(inHour, "avg_speed_mph") });
  }
  return result;
}

// Number of trips per borough
async function getBoroughs() {
  if (!USE_MOCK) {
    const data = await getJSON("/stats", toApiParams(state.filters));
    return data.borough_distribution.map((b) => ({ borough: b.borough, trips: b.trip_count }));
  }
  const trips = filterMockTrips(state.filters);
  return BOROUGHS.map((borough) => ({
    borough,
    trips: trips.filter((t) => t.pickup_borough === borough).length
  }));
}

// Number of trips per zone (used by the ranking and the map)
async function getZoneStats() {
  if (!USE_MOCK) return getJSON("/stats/zones", toApiParams(state.filters));
  const trips = filterMockTrips(state.filters);
  return ZONES.map((z) => ({
    ...z,
    trips: trips.filter((t) => t.pickup_zone === z.zone).length
  }));
}

// ===== 4. FILTERS =====

// Adds the borough and zone options to the dropdowns
async function setupDropdowns() {
  const zones = await getZones();
  const boroughs = [...new Set(zones.map((z) => z.borough))];
  for (const borough of boroughs) $("borough").add(new Option(borough, borough));
  // fake data filters by zone name, the real backend filters by zone ID
  for (const z of zones) $("zone").add(new Option(z.zone, USE_MOCK ? z.zone : z.id));
}

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
    ["hour_from", "hour_to", "The first hour must be before the last hour."],
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

// ===== 5. SHOWING NUMBERS AND TEXT =====

function money(value) {
  return "$" + Number(value).toFixed(2);
}

function formatDate(text) {
  return new Date(text).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

// Fills the six summary cards
function showSummary(s) {
  $("stat-trips").textContent = Number(s.trips).toLocaleString();
  $("stat-fare").textContent = money(s.avg_fare);
  $("stat-distance").textContent = Number(s.avg_distance).toFixed(1) + " mi";
  $("stat-duration").textContent = Math.round(s.avg_duration) + " min";
  $("stat-speed").textContent = Number(s.avg_speed).toFixed(1) + " mph";
  $("stat-tip").textContent = money(s.avg_tip);
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

// "Page 1 of 20" and the Previous / Next buttons
function showPagination(total) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  $("page-info").textContent = `Page ${state.page} of ${pages}`;
  $("prev-page").disabled = state.page <= 1;
  $("next-page").disabled = state.page >= pages;
}

// Opens the popup with all the details of one trip
function showDetails(trip) {
  const list = $("trip-detail");
  list.innerHTML = "";
  const fields = [
    ["Pickup time", formatDate(trip.pickup_datetime)],
    ["Pickup zone", trip.pickup_zone],
    ["Pickup borough", trip.pickup_borough],
    ["Dropoff zone", trip.dropoff_zone],
    ["Distance", trip.trip_distance + " mi"],
    ["Duration", Math.round(trip.trip_duration_min) + " min"],
    ["Fare", money(trip.fare_amount)],
    ["Tip", money(trip.tip_amount)],
    ["Average speed", trip.avg_speed_mph + " mph"]
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

// ===== 6. CHARTS AND RANKING =====
const charts = {}; // remembers each chart so it can be replaced

// Draws a chart, removing the old one first
function drawChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}

// Bars = trips, line = average speed
function showHourlyChart(hours) {
  drawChart("chart-hourly", {
    type: "bar",
    data: {
      labels: hours.map((h) => h.hour + ":00"),
      datasets: [
        { type: "bar", label: "Trips", data: hours.map((h) => h.trips), backgroundColor: TEAL, yAxisID: "y" },
        { type: "line", label: "Average speed (mph)", data: hours.map((h) => h.avg_speed), borderColor: YELLOW, yAxisID: "y2" }
      ]
    },
    options: {
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Trips" } },
        y2: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: "Speed (mph)" } }
      }
    }
  });
}

function showBoroughChart(boroughs) {
  drawChart("chart-borough", {
    type: "doughnut",
    data: {
      labels: boroughs.map((b) => b.borough),
      datasets: [{ data: boroughs.map((b) => b.trips), backgroundColor: [TEAL, "#14213d", YELLOW, "#5a6478", "#9bb8c9"] }]
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
        y: { title: { display: true, text: "Fare ($)" } }
      }
    }
  });
}

// Lists the 5 zones with the most trips
function showTopZones(zones) {
  const top = [...zones].sort((a, b) => b.trips - a.trips).slice(0, 5);
  const list = $("top-zones");
  list.innerHTML = "";
  for (const z of top) {
    const item = document.createElement("li");
    item.textContent = `${z.zone} (${z.borough}): ${Number(z.trips).toLocaleString()} trips`;
    list.append(item);
  }
}

// ===== 7. MAP =====
let map;
let circles; // the group of circles on the map

function setupMap() {
  map = L.map("zone-map").setView([40.73, -73.95], 10);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  circles = L.layerGroup().addTo(map);
}

// Draws one circle per zone: bigger circle = more pickups
function showMap(zones) {
  circles.clearLayers();
  const most = Math.max(1, ...zones.map((z) => z.trips));
  for (const z of zones) {
    if (z.lat === undefined) continue; // real zones have no map position yet
    L.circleMarker([z.lat, z.lng], {
      radius: 6 + 24 * (z.trips / most),
      color: TEAL,
      fillOpacity: 0.5
    })
      .bindTooltip(`${z.zone}: ${Number(z.trips).toLocaleString()} trips`)
      .on("click", () => {
        $("zone").value = USE_MOCK ? z.zone : z.id; // pick this zone in the filter
        $("filter-form").requestSubmit();           // and apply the filters
      })
      .addTo(circles);
  }
}

// ===== 8. UPDATING EVERYTHING =====
// Gets fresh data and redraws the whole dashboard
async function refreshDashboard() {
  $("data-status").textContent = "Loading data...";
  try {
    const [summary, tripData, hourly, boroughs, zones, sample] = await Promise.all([
      getSummary(), getTrips(), getHourly(), getBoroughs(), getZoneStats(), getSampleTrips()
    ]);
    showSummary(summary);
    showTable(tripData.trips);
    showPagination(summary.trips);
    showHourlyChart(hourly);
    showBoroughChart(boroughs);
    showScatterChart(sample);
    showTopZones(zones);
    showMap(zones);
    $("data-status").textContent =
      `Showing ${Number(summary.trips).toLocaleString()} trips` + (USE_MOCK ? " (fake data)" : "");
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

// ===== 9. START =====
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
  setupMap();
  await setupDropdowns();
  refreshDashboard();
}
start();