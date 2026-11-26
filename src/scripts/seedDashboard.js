require("dotenv").config();
const mongoose = require("mongoose");
const Aircraft = require("../models/Aircraft");
const Route = require("../models/Route");
const { Flight } = require("../models/Flight");
const OperationalActivityLog = require("../models/OperationalActivityLog");

const seedDashboard = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const aircraftData = [
        {
            registration: "VT-SVR1",
            model: "Boeing 787-9 Dreamliner",
            airline: "SAVÉRA",
            capacity: 280,
            status: "Active",
            fleetHealthScore: 98.5,
            isDemoData: true
        },
        {
            registration: "VT-SVR2",
            model: "Airbus A350-900",
            airline: "SAVÉRA",
            capacity: 300,
            status: "Active",
            fleetHealthScore: 97.2,
            isDemoData: true
        },
        {
            registration: "VT-SVR3",
            model: "Boeing 777-300ER",
            airline: "SAVÉRA",
            capacity: 340,
            status: "Active",
            fleetHealthScore: 95.8,
            isDemoData: true
        }
    ];

    const aircraftMap = {};
    for (const ac of aircraftData) {
        const doc = await Aircraft.findOneAndUpdate(
            { registration: ac.registration },
            { $set: ac },
            { upsert: true, new: true, runValidators: true }
        );
        aircraftMap[ac.registration] = doc._id;
    }

    const routeData = [
        {
            routeCode: "DEL-DXB",
            origin: "DEL",
            destination: "DXB",
            plannedRoute: "DEL -> KHI -> DXB",
            estimatedDeparture: "08:30 IST",
            estimatedArrival: "11:15 GST",
            routeStatus: "Optimal",
            airspaceSyncStatus: "Synchronized (Demo)",
            optimizationStatus: "Optimized",
            isDemoData: true
        },
        {
            routeCode: "BOM-LHR",
            origin: "BOM",
            destination: "LHR",
            plannedRoute: "BOM -> MCT -> IST -> LHR",
            estimatedDeparture: "13:45 IST",
            estimatedArrival: "18:30 GMT",
            routeStatus: "Optimal",
            airspaceSyncStatus: "Synchronized (Demo)",
            optimizationStatus: "Optimized",
            isDemoData: true
        },
        {
            routeCode: "BLR-SIN",
            origin: "BLR",
            destination: "SIN",
            plannedRoute: "BLR -> MAA -> SIN",
            estimatedDeparture: "21:00 IST",
            estimatedArrival: "04:05 SGT",
            routeStatus: "Congested",
            airspaceSyncStatus: "Advisory",
            optimizationStatus: "Optimizing",
            isDemoData: true
        }
    ];

    const routeMap = {};
    for (const rt of routeData) {
        const doc = await Route.findOneAndUpdate(
            { routeCode: rt.routeCode },
            { $set: rt },
            { upsert: true, new: true, runValidators: true }
        );
        routeMap[rt.routeCode] = doc._id;
    }

    const now = new Date();
    const hoursFromNow = (h) => new Date(now.getTime() + h * 3600 * 1000);

    const flightData = [
        {
            flightNumber: "SVR-101",
            airline: "SAVÉRA",
            origin: "DEL",
            destination: "DXB",
            scheduledDeparture: hoursFromNow(-1),
            scheduledArrival: hoursFromNow(2.5),
            actualDeparture: hoursFromNow(-1),
            flightStatus: "In Transit",
            aircraft: aircraftMap["VT-SVR1"],
            route: routeMap["DEL-DXB"],
            gate: "T3-G12",
            operationalStatus: "Normal",
            isDemoData: true
        },
        {
            flightNumber: "SVR-204",
            airline: "SAVÉRA",
            origin: "BOM",
            destination: "LHR",
            scheduledDeparture: hoursFromNow(1),
            scheduledArrival: hoursFromNow(10),
            flightStatus: "Boarding",
            aircraft: aircraftMap["VT-SVR2"],
            route: routeMap["BOM-LHR"],
            gate: "T2-G04",
            operationalStatus: "Normal",
            isDemoData: true
        },
        {
            flightNumber: "SVR-308",
            airline: "SAVÉRA",
            origin: "BLR",
            destination: "SIN",
            scheduledDeparture: hoursFromNow(3),
            scheduledArrival: hoursFromNow(7.5),
            flightStatus: "Delayed",
            aircraft: aircraftMap["VT-SVR3"],
            route: routeMap["BLR-SIN"],
            gate: "T1-G08",
            operationalStatus: "Attention",
            isDemoData: true
        }
    ];

    for (const fl of flightData) {
        await Flight.findOneAndUpdate(
            { flightNumber: fl.flightNumber },
            { $set: fl },
            { upsert: true, new: true, runValidators: true }
        );
    }

    const existingLogs = await OperationalActivityLog.countDocuments();
    if (existingLogs === 0) {
        await OperationalActivityLog.create({
            action: "SYSTEM_SEED",
            entityType: "System",
            summary: "Initialized demonstration flights, routes, and aircraft records.",
            staffName: "OCC System",
            department: "OCC"
        });
    }

    await mongoose.disconnect();
    console.log("Dashboard demonstration data seeded successfully.");
};

seedDashboard().catch((err) => {
    console.error("Dashboard seed failed:", err.message);
    process.exit(1);
});
