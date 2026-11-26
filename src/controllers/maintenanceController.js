const MaintenanceLog = require("../models/MaintenanceLog");
const { MAINTENANCE_STATUSES } = require("../models/MaintenanceLog");
const Aircraft = require("../models/Aircraft");
const Staff = require("../models/Staff");
const OperationalActivityLog = require("../models/OperationalActivityLog");

const ENGINEER_FIELDS = "staffId fullName badgeId designation department";

const logMaintenanceActivity = async ({ action, entityId, summary, previousStatus = null, newStatus = null, staff }) => {
    await OperationalActivityLog.create({
        action,
        entityType: "Aircraft",
        entityId,
        summary,
        previousStatus,
        newStatus,
        performedBy: staff ? staff._id : null,
        staffName: staff ? staff.fullName : "OCC System",
        department: staff ? staff.department : "Engineering"
    });
};

// GET /api/maintenance/stats/summary
exports.getMaintenanceSummary = async (req, res) => {
    try {
        const [inProgressAirframes, aCheckCleared, pendingCalibrations, openAudits] =
            await Promise.all([
                MaintenanceLog.distinct("aircraftId", { status: "IN PROGRESS" }),
                Aircraft.countDocuments({
                    isActive: { $ne: false },
                    "maintenanceStatus.isCleared": true
                }),
                MaintenanceLog.countDocuments({
                    category: "Avionics Calibration",
                    status: { $ne: "COMPLETED" }
                }),
                MaintenanceLog.countDocuments({
                    category: "Audit",
                    status: { $ne: "COMPLETED" }
                })
            ]);

        return res.status(200).json({
            summary: {
                airframesInHangar: inProgressAirframes.length,
                aCheckCleared,
                pendingCalibrations,
                regulatoryAudits: {
                    status: openAudits === 0 ? "DGCA Compliant" : "Audit Review",
                    openFindings: openAudits
                }
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch maintenance KPI summary.",
            error: error.message
        });
    }
};

// GET /api/maintenance
exports.getAllMaintenance = async (req, res) => {
    try {
        const { status, search } = req.query;
        const query = {};

        if (status && status.toUpperCase() !== "ALL") {
            query.status = status.toUpperCase().trim();
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), "i");
            const matchingEngineers = await Staff.find({ fullName: regex }).select("_id");
            const engineerIds = matchingEngineers.map((e) => e._id);

            query.$or = [
                { registrationNumber: regex },
                { aircraftModel: regex },
                { taskTitle: regex },
                { checkCode: regex },
                { hangarBay: regex },
                ...(engineerIds.length > 0 ? [{ assignedEngineer: { $in: engineerIds } }] : [])
            ];
        }

        const logs = await MaintenanceLog.find(query)
            .populate("assignedEngineer", ENGINEER_FIELDS)
            .populate("signedOffBy", ENGINEER_FIELDS)
            .sort({ createdAt: -1 });

        return res.status(200).json({
            count: logs.length,
            logs
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch maintenance logs.",
            error: error.message
        });
    }
};

// GET /api/maintenance/:id
exports.getMaintenanceById = async (req, res) => {
    try {
        const log = await MaintenanceLog.findById(req.params.id)
            .populate("assignedEngineer", ENGINEER_FIELDS)
            .populate("signedOffBy", ENGINEER_FIELDS);

        if (!log) {
            return res.status(404).json({ message: "Maintenance log not found." });
        }

        return res.status(200).json({ log });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch maintenance log.",
            error: error.message
        });
    }
};

// POST /api/maintenance
exports.createMaintenance = async (req, res) => {
    try {
        const {
            aircraftId,
            taskTitle,
            checkCode,
            category,
            hangarBay,
            assignedEngineer,
            estimatedReturnToService,
            status
        } = req.body;

        if (!aircraftId || !taskTitle || !checkCode || !estimatedReturnToService) {
            return res.status(400).json({
                message: "aircraftId, taskTitle, checkCode, and estimatedReturnToService are required."
            });
        }

        const aircraft = await Aircraft.findById(aircraftId);
        if (!aircraft) {
            return res.status(404).json({ message: "Selected aircraft not found." });
        }

        if (assignedEngineer) {
            const engineer = await Staff.findById(assignedEngineer);
            if (!engineer || !engineer.isActive) {
                return res.status(400).json({ message: "Assigned engineer is invalid or inactive." });
            }
        }

        const resolvedStatus = MAINTENANCE_STATUSES.includes((status || "").toUpperCase())
            ? status.toUpperCase()
            : "SCHEDULED";

        const log = await MaintenanceLog.create({
            aircraftId: aircraft._id,
            registrationNumber: aircraft.registration,
            aircraftModel: aircraft.model,
            taskTitle,
            checkCode,
            category: category || "A-Check",
            hangarBay: hangarBay || "Hangar Bay 1",
            assignedEngineer: assignedEngineer || null,
            estimatedReturnToService,
            status: resolvedStatus
        });

        if (resolvedStatus === "IN PROGRESS") {
            aircraft.availabilityStatus = "In Maintenance";
            aircraft.status = "Maintenance";
            aircraft.maintenanceStatus = {
                label: `${checkCode} In Progress`,
                nextCheckSummary: hangarBay || "Hangar Bay 1",
                isCleared: false
            };
            await aircraft.save();
        }

        await logMaintenanceActivity({
            action: "MAINTENANCE_CREATED",
            entityId: log._id,
            summary: `Created ${checkCode} task for ${aircraft.registration}: ${taskTitle}`,
            newStatus: resolvedStatus,
            staff: req.staff
        });

        const populated = await MaintenanceLog.findById(log._id)
            .populate("assignedEngineer", ENGINEER_FIELDS)
            .populate("signedOffBy", ENGINEER_FIELDS);

        return res.status(201).json({
            message: "Maintenance task created successfully.",
            log: populated
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to create maintenance task.",
            error: error.message
        });
    }
};

// PUT /api/maintenance/:id
exports.updateMaintenance = async (req, res) => {
    try {
        const log = await MaintenanceLog.findById(req.params.id);
        if (!log) {
            return res.status(404).json({ message: "Maintenance log not found." });
        }

        const updatable = [
            "taskTitle",
            "checkCode",
            "category",
            "hangarBay",
            "assignedEngineer",
            "estimatedReturnToService",
            "status"
        ];

        for (const field of updatable) {
            if (req.body[field] !== undefined) {
                log[field] = req.body[field];
            }
        }

        await log.save();

        const populated = await MaintenanceLog.findById(log._id)
            .populate("assignedEngineer", ENGINEER_FIELDS)
            .populate("signedOffBy", ENGINEER_FIELDS);

        return res.status(200).json({
            message: "Maintenance task updated successfully.",
            log: populated
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update maintenance task.",
            error: error.message
        });
    }
};

// PATCH /api/maintenance/:id/sign-off
exports.signOffMaintenance = async (req, res) => {
    try {
        const log = await MaintenanceLog.findById(req.params.id);
        if (!log) {
            return res.status(404).json({ message: "Maintenance log not found." });
        }

        const previousStatus = log.status;
        log.status = "COMPLETED";
        log.signedOffBy = req.staff ? req.staff._id : null;
        log.signedOffAt = new Date();
        log.signOffRemarks = req.body.remarks || req.body.signOffRemarks || "Airworthiness released by AME.";
        await log.save();

        const remainingActive = await MaintenanceLog.countDocuments({
            aircraftId: log.aircraftId,
            status: "IN PROGRESS"
        });

        if (remainingActive === 0) {
            await Aircraft.findByIdAndUpdate(log.aircraftId, {
                $set: {
                    availabilityStatus: "Standby",
                    status: "Active",
                    maintenanceStatus: {
                        label: "A-Check Cleared",
                        nextCheckSummary: "Next check in 500 FH",
                        isCleared: true
                    }
                }
            });
        }

        await logMaintenanceActivity({
            action: "MAINTENANCE_SIGNED_OFF",
            entityId: log._id,
            summary: `Signed off ${log.checkCode} for ${log.registrationNumber}`,
            previousStatus,
            newStatus: "COMPLETED",
            staff: req.staff
        });

        const populated = await MaintenanceLog.findById(log._id)
            .populate("assignedEngineer", ENGINEER_FIELDS)
            .populate("signedOffBy", ENGINEER_FIELDS);

        return res.status(200).json({
            message: "Maintenance task signed off and airworthiness released.",
            log: populated
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to sign off maintenance task.",
            error: error.message
        });
    }
};

// DELETE /api/maintenance/:id
exports.deleteMaintenance = async (req, res) => {
    try {
        const log = await MaintenanceLog.findByIdAndDelete(req.params.id);
        if (!log) {
            return res.status(404).json({ message: "Maintenance log not found." });
        }

        await logMaintenanceActivity({
            action: "MAINTENANCE_DELETED",
            entityId: log._id,
            summary: `Deleted maintenance task ${log.checkCode} for ${log.registrationNumber}`,
            previousStatus: log.status,
            staff: req.staff
        });

        return res.status(200).json({
            message: "Maintenance task deleted successfully."
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to delete maintenance task.",
            error: error.message
        });
    }
};
