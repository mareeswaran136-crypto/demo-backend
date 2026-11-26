const mongoose = require("mongoose");
const Aircraft = require("../models/Aircraft");
const { AVAILABILITY_STATUSES } = require("../models/Aircraft");
const OperationalActivityLog = require("../models/OperationalActivityLog");

const findAircraftRecord = async (id) => {
    if (mongoose.Types.ObjectId.isValid(id)) {
        return Aircraft.findById(id);
    }
    return Aircraft.findOne({ registration: id.toUpperCase().trim() });
};

const logFleetActivity = async ({ action, entityId, summary, previousStatus = null, newStatus = null, staff }) => {
    await OperationalActivityLog.create({
        action,
        entityType: "Aircraft",
        entityId,
        summary,
        previousStatus,
        newStatus,
        performedBy: staff ? staff._id : null,
        staffName: staff ? staff.fullName : "OCC System",
        department: staff ? staff.department : "OCC"
    });
};

// GET /api/fleet/stats/summary
exports.getFleetSummary = async (req, res) => {
    try {
        const [agg] = await Aircraft.aggregate([
            { $match: { isActive: { $ne: false } } },
            {
                $group: {
                    _id: null,
                    totalAircraft: { $sum: 1 },
                    activeCount: {
                        $sum: { $cond: [{ $eq: ["$availabilityStatus", "Active"] }, 1, 0] }
                    },
                    standbyCount: {
                        $sum: { $cond: [{ $eq: ["$availabilityStatus", "Standby"] }, 1, 0] }
                    },
                    maintenanceCount: {
                        $sum: { $cond: [{ $eq: ["$availabilityStatus", "In Maintenance"] }, 1, 0] }
                    },
                    avgHealth: { $avg: "$fleetHealthScore" }
                }
            }
        ]);

        const s = agg || {
            totalAircraft: 0,
            activeCount: 0,
            standbyCount: 0,
            maintenanceCount: 0,
            avgHealth: 100
        };

        const utilizationPercent =
            s.totalAircraft > 0
                ? Number(((s.activeCount / s.totalAircraft) * 100).toFixed(1))
                : 0;
        const fleetReadinessPercent =
            s.totalAircraft > 0
                ? Number((((s.activeCount + s.standbyCount) / s.totalAircraft) * 100).toFixed(1))
                : 100;

        return res.status(200).json({
            summary: {
                totalAircraft: s.totalAircraft,
                activeCount: s.activeCount,
                standbyCount: s.standbyCount,
                maintenanceCount: s.maintenanceCount,
                utilizationPercent,
                fleetReadinessPercent,
                avgHealth: Number((s.avgHealth || 0).toFixed(1))
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch fleet summary.",
            error: error.message
        });
    }
};

// GET /api/fleet
exports.getAllFleet = async (req, res) => {
    try {
        const { model, status, search } = req.query;
        const query = { isActive: { $ne: false } };

        if (model && model !== "All Models" && model !== "All") {
            query.modelCode = new RegExp(`^${model.trim()}$`, "i");
        }

        if (status && status !== "All") {
            query.availabilityStatus = status.trim();
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), "i");
            query.$or = [
                { registration: regex },
                { model: regex },
                { modelCode: regex },
                { engineType: regex },
                { "assignedRoute.origin": regex },
                { "assignedRoute.destination": regex },
                { "assignedRoute.flightNumber": regex }
            ];
        }

        const fleet = await Aircraft.find(query).sort({ registration: 1 });
        return res.status(200).json({
            count: fleet.length,
            fleet
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch fleet directory.",
            error: error.message
        });
    }
};

// GET /api/fleet/:id
exports.getFleetById = async (req, res) => {
    try {
        const aircraft = await findAircraftRecord(req.params.id);
        if (!aircraft) {
            return res.status(404).json({ message: "Aircraft not found." });
        }
        return res.status(200).json({ aircraft });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch aircraft details.",
            error: error.message
        });
    }
};

// POST /api/fleet
exports.createFleet = async (req, res) => {
    try {
        const registration = (req.body.registration || req.body.registrationNumber || "").toUpperCase().trim();
        const {
            msn,
            deliveryYear,
            model,
            modelCode,
            engineType,
            capacity,
            cabinBreakdown,
            availabilityStatus,
            maintenanceStatus,
            assignedRoute,
            fleetHealthScore
        } = req.body;

        if (!registration || !model) {
            return res.status(400).json({
                message: "registration (or registrationNumber) and model are required."
            });
        }

        const existing = await Aircraft.findOne({ registration });
        if (existing) {
            return res.status(409).json({
                message: "An aircraft with this registration already exists."
            });
        }

        const resolvedAvailability = AVAILABILITY_STATUSES.includes(availabilityStatus)
            ? availabilityStatus
            : "Active";

        const aircraft = await Aircraft.create({
            registration,
            msn,
            deliveryYear,
            model,
            modelCode: modelCode || model.split(" ")[0],
            engineType,
            capacity,
            cabinBreakdown,
            availabilityStatus: resolvedAvailability,
            status: resolvedAvailability === "In Maintenance" ? "Maintenance" : "Active",
            maintenanceStatus,
            assignedRoute,
            fleetHealthScore,
            isActive: true
        });

        await logFleetActivity({
            action: "AIRCRAFT_CREATED",
            entityId: aircraft._id,
            summary: `Added aircraft ${aircraft.registration} (${aircraft.model})`,
            newStatus: aircraft.availabilityStatus,
            staff: req.staff
        });

        return res.status(201).json({
            message: "Aircraft created successfully.",
            aircraft
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to create aircraft.",
            error: error.message
        });
    }
};

// PUT /api/fleet/:id
exports.updateFleet = async (req, res) => {
    try {
        const aircraft = await findAircraftRecord(req.params.id);
        if (!aircraft) {
            return res.status(404).json({ message: "Aircraft not found." });
        }

        const updatable = [
            "msn",
            "deliveryYear",
            "model",
            "modelCode",
            "engineType",
            "capacity",
            "cabinBreakdown",
            "assignedRoute",
            "fleetHealthScore",
            "isActive"
        ];

        for (const field of updatable) {
            if (req.body[field] !== undefined) {
                aircraft[field] = req.body[field];
            }
        }

        await aircraft.save();

        await logFleetActivity({
            action: "AIRCRAFT_UPDATED",
            entityId: aircraft._id,
            summary: `Updated specifications for aircraft ${aircraft.registration}`,
            staff: req.staff
        });

        return res.status(200).json({
            message: "Aircraft updated successfully.",
            aircraft
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update aircraft.",
            error: error.message
        });
    }
};

// PATCH /api/fleet/:id/availability
exports.updateAvailability = async (req, res) => {
    try {
        const { availabilityStatus } = req.body;
        if (!availabilityStatus || !AVAILABILITY_STATUSES.includes(availabilityStatus)) {
            return res.status(400).json({
                message: `Invalid availabilityStatus. Allowed values: ${AVAILABILITY_STATUSES.join(", ")}`
            });
        }

        const aircraft = await findAircraftRecord(req.params.id);
        if (!aircraft) {
            return res.status(404).json({ message: "Aircraft not found." });
        }

        if (
            availabilityStatus === "Active" &&
            aircraft.maintenanceStatus &&
            aircraft.maintenanceStatus.isCleared === false
        ) {
            return res.status(400).json({
                message: "Cannot set aircraft to Active without maintenance clearance."
            });
        }

        const previousStatus = aircraft.availabilityStatus;
        aircraft.availabilityStatus = availabilityStatus;
        aircraft.status = availabilityStatus === "In Maintenance" ? "Maintenance" : "Active";

        await aircraft.save();

        await logFleetActivity({
            action: "AIRCRAFT_AVAILABILITY_UPDATED",
            entityId: aircraft._id,
            summary: `Aircraft ${aircraft.registration} availability changed from ${previousStatus} to ${availabilityStatus}`,
            previousStatus,
            newStatus: availabilityStatus,
            staff: req.staff
        });

        return res.status(200).json({
            message: "Aircraft availability updated successfully.",
            aircraft
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update aircraft availability.",
            error: error.message
        });
    }
};

// PATCH /api/fleet/:id/maintenance
exports.updateMaintenance = async (req, res) => {
    try {
        const aircraft = await findAircraftRecord(req.params.id);
        if (!aircraft) {
            return res.status(404).json({ message: "Aircraft not found." });
        }

        const { label, nextCheckSummary, isCleared } = req.body;
        aircraft.maintenanceStatus = {
            label: label !== undefined ? label : aircraft.maintenanceStatus?.label || "A-Check Cleared",
            nextCheckSummary:
                nextCheckSummary !== undefined
                    ? nextCheckSummary
                    : aircraft.maintenanceStatus?.nextCheckSummary || "",
            isCleared:
                isCleared !== undefined
                    ? Boolean(isCleared)
                    : aircraft.maintenanceStatus?.isCleared ?? true
        };

        if (aircraft.maintenanceStatus.isCleared === false) {
            aircraft.availabilityStatus = "In Maintenance";
            aircraft.status = "Maintenance";
        }

        await aircraft.save();

        await logFleetActivity({
            action: "AIRCRAFT_MAINTENANCE_UPDATED",
            entityId: aircraft._id,
            summary: `Updated maintenance for ${aircraft.registration}: ${aircraft.maintenanceStatus.label}`,
            newStatus: aircraft.availabilityStatus,
            staff: req.staff
        });

        return res.status(200).json({
            message: "Aircraft maintenance status updated successfully.",
            aircraft
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update maintenance status.",
            error: error.message
        });
    }
};

// DELETE /api/fleet/:id
exports.deleteFleet = async (req, res) => {
    try {
        const aircraft = await findAircraftRecord(req.params.id);
        if (!aircraft) {
            return res.status(404).json({ message: "Aircraft not found." });
        }

        aircraft.isActive = false;
        await aircraft.save();

        await logFleetActivity({
            action: "AIRCRAFT_DEACTIVATED",
            entityId: aircraft._id,
            summary: `Deactivated aircraft ${aircraft.registration}`,
            staff: req.staff
        });

        return res.status(200).json({
            message: "Aircraft deactivated successfully."
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to deactivate aircraft.",
            error: error.message
        });
    }
};
