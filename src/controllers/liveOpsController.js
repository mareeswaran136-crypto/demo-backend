const { Flight } = require("../models/Flight");
const OperationalAlert = require("../models/OperationalAlert");
const OperationalActivityLog = require("../models/OperationalActivityLog");

// GET /api/live-ops/radar
exports.getRadar = async (req, res) => {
    try {
        const flights = await Flight.find({
            flightStatus: { $nin: ["Cancelled", "Arrived"] }
        })
            .populate("aircraft", "registration model")
            .sort({ scheduledDeparture: 1 });

        return res.status(200).json({
            count: flights.length,
            radar: flights
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch live radar telemetry.",
            error: error.message
        });
    }
};

// POST /api/live-ops/radar/sync
exports.syncRadar = async (req, res) => {
    try {
        const now = new Date();
        await Flight.updateMany(
            { flightStatus: { $nin: ["Cancelled", "Arrived"] } },
            { $set: { lastSyncedAt: now } }
        );

        await OperationalActivityLog.create({
            action: "RADAR_SYNCED",
            entityType: "System",
            summary: "Synchronized ADS-B radar telemetry across active sectors.",
            performedBy: req.staff ? req.staff._id : null,
            staffName: req.staff ? req.staff.fullName : "OCC System",
            department: req.staff ? req.staff.department : "OCC"
        });

        const flights = await Flight.find({
            flightStatus: { $nin: ["Cancelled", "Arrived"] }
        })
            .populate("aircraft", "registration model")
            .sort({ scheduledDeparture: 1 });

        return res.status(200).json({
            message: "ADS-B radar telemetry synchronized.",
            syncedAt: now,
            count: flights.length,
            radar: flights
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to synchronize ADS-B radar.",
            error: error.message
        });
    }
};

// GET /api/live-ops/alerts
exports.getAlerts = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 25, 100);
        const alerts = await OperationalAlert.find()
            .sort({ createdAt: -1 })
            .limit(limit);

        return res.status(200).json({
            count: alerts.length,
            alerts
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch operational alerts.",
            error: error.message
        });
    }
};

// POST /api/live-ops/alerts/broadcast
exports.broadcastAdvisory = async (req, res) => {
    try {
        const { title, message, category, severity, relatedFlightNumber } = req.body;
        if (!title) {
            return res.status(400).json({ message: "Advisory title is required." });
        }

        const alert = await OperationalAlert.create({
            title,
            message: message || "",
            category: category || "OCC Advisory",
            severity: severity || "info",
            relatedFlightNumber: relatedFlightNumber || "",
            createdBy: req.staff ? req.staff._id : null,
            staffName: req.staff ? req.staff.fullName : "OCC System"
        });

        await OperationalActivityLog.create({
            action: "OCC_ADVISORY_BROADCAST",
            entityType: "System",
            entityId: alert._id,
            summary: `Broadcast OCC Advisory: ${alert.title}`,
            performedBy: req.staff ? req.staff._id : null,
            staffName: req.staff ? req.staff.fullName : "OCC System",
            department: req.staff ? req.staff.department : "OCC"
        });

        return res.status(201).json({
            message: "OCC Advisory broadcast published.",
            alert
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to broadcast OCC advisory.",
            error: error.message
        });
    }
};

// GET /api/live-ops/delays
exports.getDelays = async (req, res) => {
    try {
        const delays = await Flight.find({
            $or: [{ flightStatus: "Delayed" }, { delayMinutes: { $gt: 0 } }]
        })
            .populate("aircraft", "registration model")
            .sort({ delayMinutes: -1, scheduledDeparture: 1 });

        return res.status(200).json({
            count: delays.length,
            delays
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch delayed flights.",
            error: error.message
        });
    }
};

// PATCH /api/live-ops/delays/:flightId/expedite
exports.expediteDelay = async (req, res) => {
    try {
        const flight = await Flight.findById(req.params.flightId);
        if (!flight) {
            return res.status(404).json({ message: "Flight not found." });
        }

        flight.groundPriorityExpedited = true;
        if (!flight.mitigationAction) {
            flight.mitigationAction = "Expedited ramp transfer & turnaround crew pre-positioned";
        }
        await flight.save();

        await OperationalAlert.create({
            title: `Ground Priority Expedited for ${flight.flightNumber}`,
            message: `Route ${flight.origin} -> ${flight.destination}. Action: ${flight.mitigationAction}`,
            category: "FlightRipple",
            severity: "warning",
            relatedFlightNumber: flight.flightNumber,
            createdBy: req.staff ? req.staff._id : null,
            staffName: req.staff ? req.staff.fullName : "OCC System"
        });

        await OperationalActivityLog.create({
            action: "GROUND_PRIORITY_EXPEDITED",
            entityType: "Flight",
            entityId: flight._id,
            summary: `Expedited ground priority for delayed flight ${flight.flightNumber}`,
            performedBy: req.staff ? req.staff._id : null,
            staffName: req.staff ? req.staff.fullName : "OCC System",
            department: req.staff ? req.staff.department : "OCC"
        });

        return res.status(200).json({
            message: "Ground priority expedited successfully.",
            flight
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to expedite ground priority.",
            error: error.message
        });
    }
};
