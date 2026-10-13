-- Data is loaded by backend/src/database.py (zones first, then trips)
-- Queries to check that the load worked

SELECT COUNT(*) FROM trips;
SELECT z.Borough, COUNT(*) AS trips, ROUND(AVG(t.total_amount), 2) AS avg_fare
FROM trips t JOIN zones z ON t.PULocationID = z.LocationID
GROUP BY z.Borough ORDER BY trips DESC;

SELECT pickup_hour, COUNT(*) AS trips FROM trips GROUP BY pickup_hour ORDER BY pickup_hour;

SELECT is_rush_hour, ROUND(AVG(avg_speed_mph), 2) AS avg_speed FROM trips GROUP BY is_rush_hour;

SELECT z.Zone, COUNT(*) AS pickups
FROM trips t JOIN zones z ON t.PULocationID = z.LocationID
GROUP BY z.Zone ORDER BY pickups DESC LIMIT 5;