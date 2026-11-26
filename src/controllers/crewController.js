const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Staff = require("../models/Staff");
const { CREW_ROLES, DUTY_STATUSES } = require("../models/Staff");
const { Flight } = require("../models/Flight");
const OperationalActivityLog = require("../models/OperationalActivityLog");

const FLIGHT_POPULATE = "flightNumber origin destination flightStatus scheduledDeparture scheduledArrival gate";

const normalizeRoleFilter = (roleParam) => {
    if (!roleParam || roleParam === "All") return null;
    const map = {
        captains: "Captain",
        captain: "Captain",
        "first officers": "First Officer",
        "first officer": "First Officer",
        "cabin senior": "Cabin Senior",
        "cabin crew": "Cabin Crew"
    };
    return map[roleParam.toLowerCase().trim()] || roleParam.trim();
};

const normalizeDutyFilter = (dutyParam) => {
    if (!dutyParam || dutyParam === "All") return null;
    const map = {
        "on duty": "On Duty",
        standby: "Standby",
        rest: "Rest Period",
        "rest period": "Rest Period"
    };
    return map[dutyParam.toLowerCase().trim()] || dutyParam.trim();
};

const findCrewRecord = async (id) => {
    if (mongoose.Types.ObjectId.isValid(id)) {
        return Staff.findById(id);
    }
    const upper = id.toUpperCase().trim();
    return Staff.findOne({ $or: [{ crewId: upper }, { staffId: upper }] });
};

const logCrewActivity = async ({ action, entityId, summary, previousStatus = null, newStatus = null, staff }) => {
    await OperationalActivityLog.create({
        action,
        entityType: "System",
        entityId,
        summary,
        previousStatus,
        newStatus,
        performedBy: staff ? staff._id : null,
        staffName: staff ? staff.fullName : "OCC System",
        department: staff ? staff.department : "OCC"
    });
};

// GET /api/crew/stats/summary
exports.getCrewSummary = async (req, res) => {
    try {
        const [agg] = await Staff.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: null,
                    totalCrew: { $sum: 1 },
                    activeOnDuty: {
                        $sum: { $cond: [{ $eq: ["$dutyStatus", "On Duty"] }, 1, 0] }
                    },
                    standbyReady: {
                        $sum: { $cond: [{ $eq: ["$dutyStatus", "Standby"] }, 1, 0] }
                    },
                    restPeriod: {
                        $sum: { $cond: [{ $eq: ["$dutyStatus", "Rest Period"] }, 1, 0] }
                    }
                }
            }
        ]);

        const summary = agg || {
            totalCrew: 0,
            activeOnDuty: 0,
            standbyReady: 0,
            restPeriod: 0
        };
        delete summary._id;

        return res.status(200).json({ summary });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch crew summary.",
            error: error.message
        });
    }
};

// GET /api/crew
exports.getAllCrew = async (req, res) => {
    try {
        const { role, dutyStatus, search } = req.query;
        const query = { isActive: true };

        const normalizedRole = normalizeRoleFilter(role);
        if (normalizedRole) {
            query.crewRole = normalizedRole;
        }

        const normalizedDuty = normalizeDutyFilter(dutyStatus);
        if (normalizedDuty) {
            query.dutyStatus = normalizedDuty;
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), "i");
            const matchingFlights = await Flight.find({ flightNumber: regex }).select("_id");
            const flightIds = matchingFlights.map((f) => f._id);

            query.$or = [
                { fullName: regex },
                { crewId: regex },
                { staffId: regex },
                { aircraftType: regex },
                ...(flightIds.length > 0 ? [{ assignedFlight: { $in: flightIds } }] : [])
            ];
        }

        const crew = await Staff.find(query)
            .populate("assignedFlight", FLIGHT_POPULATE)
            .sort({ fullName: 1 });

        return res.status(200).json({
            count: crew.length,
            crew
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch crew directory.",
            error: error.message
        });
    }
};

// GET /api/crew/:id
exports.getCrewById = async (req, res) => {
    try {
        const member = await findCrewRecord(req.params.id);
        if (!member) {
            return res.status(404).json({ message: "Crew member not found." });
        }

        await member.populate("assignedFlight", FLIGHT_POPULATE);
        return res.status(200).json({ crew: member });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch crew profile.",
            error: error.message
        });
    }
};

// POST /api/crew
exports.createCrew = async (req, res) => {
    try {
        const {
            crewId,
            staffId,
            fullName,
            officialEmail,
            phone,
            avatarUrl,
            crewRole,
            subRole,
            aircraftType,
            dutyStatus,
            flightHoursLogged,
            certifications,
            department,
            operationalShift,
            passcode,
            password
        } = req.body;

        const resolvedCrewId = (crewId || staffId || "").toUpperCase().trim();
        const resolvedStaffId = (staffId || crewId || "").toUpperCase().trim();

        if (!resolvedCrewId || !fullName || !officialEmail) {
            return res.status(400).json({
                message: "crewId (or staffId), fullName, and officialEmail are required."
            });
        }

        const existing = await Staff.findOne({
            $or: [
                { officialEmail: officialEmail.toLowerCase().trim() },
                { staffId: resolvedStaffId },
                { crewId: resolvedCrewId }
            ]
        });

        if (existing) {
            return res.status(409).json({
                message: "A crew/staff member with this crewId, staffId, or email already exists."
            });
        }

        const rawPass = passcode || password || `Savera@${Date.now()}`;
        const passwordHash = await bcrypt.hash(rawPass, 10);

        const member = await Staff.create({
            staffId: resolvedStaffId,
            crewId: resolvedCrewId,
            badgeId: resolvedCrewId,
            fullName,
            officialEmail,
            phone: phone || "",
            avatarUrl: avatarUrl || "",
            passwordHash,
            department: department || "Flight Operations",
            designation: subRole || crewRole || "Crew Member",
            crewRole: CREW_ROLES.includes(crewRole) ? crewRole : "Cabin Crew",
            subRole: subRole || "",
            aircraftType: aircraftType || "Boeing 787-9",
            dutyStatus: DUTY_STATUSES.includes(dutyStatus) ? dutyStatus : "Standby",
            flightHoursLogged: flightHoursLogged || 0,
            certifications: Array.isArray(certifications) ? certifications : [],
            operationalShift: operationalShift || "Day Shift (06:00 - 18:00 IST)",
            role: "staff",
            isActive: true
        });

        await logCrewActivity({
            action: "CREW_CREATED",
            entityId: member._id,
            summary: `Added crew member ${member.fullName} (${member.crewId})`,
            newStatus: member.dutyStatus,
            staff: req.staff
        });

        return res.status(201).json({
            message: "Crew member created successfully.",
            crew: member
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to create crew member.",
            error: error.message
        });
    }
};

// PUT /api/crew/:id
exports.updateCrew = async (req, res) => {
    try {
        const member = await findCrewRecord(req.params.id);
        if (!member) {
            return res.status(404).json({ message: "Crew member not found." });
        }

        const updatable = [
            "fullName",
            "avatarUrl",
            "phone",
            "crewRole",
            "subRole",
            "aircraftType",
            "availability",
            "flightHoursLogged",
            "certifications",
            "operationalShift",
            "isActive"
        ];

        for (const field of updatable) {
            if (req.body[field] !== undefined) {
                member[field] = req.body[field];
            }
        }

        await member.save();
        await member.populate("assignedFlight", FLIGHT_POPULATE);

        await logCrewActivity({
            action: "CREW_UPDATED",
            entityId: member._id,
            summary: `Updated crew profile for ${member.fullName} (${member.crewId || member.staffId})`,
            staff: req.staff
        });

        return res.status(200).json({
            message: "Crew member updated successfully.",
            crew: member
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update crew member.",
            error: error.message
        });
    }
};

// PATCH /api/crew/:id/duty-status
exports.updateDutyStatus = async (req, res) => {
    try {
        const { dutyStatus } = req.body;
        if (!dutyStatus || !DUTY_STATUSES.includes(dutyStatus)) {
            return res.status(400).json({
                message: `Invalid dutyStatus. Allowed values: ${DUTY_STATUSES.join(", ")}`
            });
        }

        const member = await findCrewRecord(req.params.id);
        if (!member) {
            return res.status(404).json({ message: "Crew member not found." });
        }

        const previousStatus = member.dutyStatus;
        member.dutyStatus = dutyStatus;
        member.availability = {
            ...(member.availability || {}),
            status: dutyStatus === "Rest Period" ? "Unavailable (Rest)" : dutyStatus === "On Duty" ? "Assigned" : "Available"
        };

        await member.save();
        await member.populate("assignedFlight", FLIGHT_POPULATE);

        await logCrewActivity({
            action: "CREW_DUTY_STATUS_UPDATED",
            entityId: member._id,
            summary: `${member.fullName} duty status changed from ${previousStatus} to ${dutyStatus}`,
            previousStatus,
            newStatus: dutyStatus,
            staff: req.staff
        });

        return res.status(200).json({
            message: "Crew duty status updated successfully.",
            crew: member
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update crew duty status.",
            error: error.message
        });
    }
};

// PATCH /api/crew/:id/assign-flight
exports.assignFlightToCrew = async (req, res) => {
    try {
        const { flightId } = req.body;
        const member = await findCrewRecord(req.params.id);
        if (!member) {
            return res.status(404).json({ message: "Crew member not found." });
        }

        if (flightId) {
            if (member.dutyStatus === "Rest Period") {
                return res.status(400).json({
                    message: "Cannot assign flight: crew member is currently in mandatory Rest Period."
                });
            }

            const flight = await Flight.findById(flightId);
            if (!flight) {
                return res.status(404).json({ message: "Target flight not found." });
            }

            if (member.assignedFlight && member.assignedFlight.toString() !== flight._id.toString()) {
                await Flight.findByIdAndUpdate(member.assignedFlight, {
                    $pull: { crewMembers: member._id }
                });
            }

            member.assignedFlight = flight._id;
            member.dutyStatus = "On Duty";
            await member.save();

            await Flight.findByIdAndUpdate(flight._id, {
                $addToSet: { crewMembers: member._id }
            });

            await logCrewActivity({
                action: "CREW_FLIGHT_ASSIGNED",
                entityId: member._id,
                summary: `Assigned ${member.fullName} to flight ${flight.flightNumber}`,
                newStatus: "On Duty",
                staff: req.staff
            });
        } else {
            if (member.assignedFlight) {
                await Flight.findByIdAndUpdate(member.assignedFlight, {
                    $pull: { crewMembers: member._id }
                });
            }
            member.assignedFlight = null;
            member.dutyStatus = "Standby";
            await member.save();

            await logCrewActivity({
                action: "CREW_FLIGHT_UNASSIGNED",
                entityId: member._id,
                summary: `Unassigned flight from ${member.fullName}`,
                newStatus: "Standby",
                staff: req.staff
            });
        }

        await member.populate("assignedFlight", FLIGHT_POPULATE);
        return res.status(200).json({
            message: flightId ? "Flight assigned to crew member." : "Flight unassigned from crew member.",
            crew: member
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update crew flight assignment.",
            error: error.message
        });
    }
};

// DELETE /api/crew/:id
exports.deleteCrew = async (req, res) => {
    try {
        const member = await findCrewRecord(req.params.id);
        if (!member) {
            return res.status(404).json({ message: "Crew member not found." });
        }

        member.isActive = false;
        await member.save();

        await logCrewActivity({
            action: "CREW_DEACTIVATED",
            entityId: member._id,
            summary: `Deactivated crew member ${member.fullName} (${member.crewId || member.staffId})`,
            staff: req.staff
        });

        return res.status(200).json({
            message: "Crew member deactivated successfully."
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to deactivate crew member.",
            error: error.message
        });
    }
};
