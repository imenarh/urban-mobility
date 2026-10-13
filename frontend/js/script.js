// ===== Urban Mobility Data Explorer - script.js =====
// Part 1: settings, shared state and fake test data

const API_BASE = "http://localhost:5000/api"; // ask Member 2 for the real address
const USE_MOCK = true;                        // true = fake data, false = real backend
const PAGE_SIZE = 20;                         // trips shown per table page

// ---------- Shared state ----------
// Everything the dashboard needs to remember between clicks
const state = {
    filters: {},               // the values from the filter form
    sortBy: "pickup_datetime", // column the table is sorted by
    order: "desc",             // "asc" or "desc"
    page: 1                    // current table page
};

// Shortcut: $("stat-fare") instead of document.getElementById("stat-fare")
const $ = (id) => document.getElementById(id);

// Asks the backend for data and returns it as a JavaScript object
async function getJSON(path, params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE}${path}?${query}`);
    if (!response.ok) throw new Error(`API error ${response.status}`);
    return response.json();
}

// ---------- Fake data (used while USE_MOCK is true) ----------
const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

const ZONES = [
    { id: 1, zone: "Midtown Center", borough: "Manhattan" },
    { id: 2, zone: "Upper East Side", borough: "Manhattan" },
    { id: 3, zone: "East Village", borough: "Manhattan" },
    { id: 4, zone: "Williamsburg", borough: "Brooklyn" },
    { id: 5, zone: "Downtown Brooklyn", borough: "Brooklyn" },
    { id: 6, zone: "JFK Airport", borough: "Queens" },
    { id: 7, zone: "LaGuardia Airport", borough: "Queens" },
    { id: 8, zone: "Astoria", borough: "Queens" },
    { id: 9, zone: "South Bronx", borough: "Bronx" },
    { id: 10, zone: "St. George", borough: "Staten Island" }
];

// Picks a random item from a list
function pickRandom(list) {
      return list[Math.floor(Math.random() * list.length)];
}

// Builds a list of made-up trips with the same fields the real API will return
function makeMockTrips(count) {
    const trips = [];
    for (let i = 0; i < count; i++) {
        const pickup = pickRandom(ZONES);
        const dropoff = pickRandom(ZONES);
        const distance = +(Math.random() * 12 + 0.5).toFixed(1);
        const duration = Math.round(distance * 3 + Math.random() * 10 + 3);
        const fare = +(3 + distance * 2.8 + Math.random() * 3).toFixed(2);
        const when = new Date(2025, 0, 1 + Math.floor(Math.random() * 31),
                            Math.floor(Math.random() * 24),
                            Math.floor(Math.random() * 60));
        trips.push({
            id: i + 1,
            pickup_datetime: when.toISOString(),
            pickup_zone: pickup.zone,
            pickup_borough: pickup.borough,
            dropoff_zone: dropoff.zone,
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