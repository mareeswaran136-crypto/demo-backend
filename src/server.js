const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const staffRoutes = require("./routes/staffRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const flightRoutes = require("./routes/flightRoutes");
const routeRoutes = require("./routes/routeRoutes");
const operationsRoutes = require("./routes/operationsRoutes");
const aircraftRoutes = require("./routes/aircraftRoutes");
const crewRoutes = require("./routes/crewRoutes");
const fleetRoutes = require("./routes/fleetRoutes");
const liveOpsRoutes = require("./routes/liveOpsRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

connectDB();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true
    })
);

app.use(express.json());

app.get("/", (req, res) => {
    res.send("SAVÉRA Common Backend Running Successfully!");
});

app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "savera-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/flights", flightRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/operations", operationsRoutes);
app.use("/api/aircraft", aircraftRoutes);
app.use("/api/crew", crewRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/live-ops", liveOpsRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/analytics", analyticsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`SAVÉRA Backend running on port ${PORT}`);
});
