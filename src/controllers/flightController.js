const { Flight, FLIGHT_STATUSES } = require("../models/Flight");
const Staff = require("../models/Staff");
const OperationalActivityLog = require("../models/OperationalActivityLog");

const CREW_FIELDS = "staffId fullName officialEmail department badgeId designation operationalShift";
const AIRCRAFT_FIELDS = "registration model status fleetHealthScore";
const ROUTE_FIELDS = "routeCode plannedRoute routeStatus airspaceSyncStatus optimizationStatus";

const logActivity = async ({
    action,
    entityId,
    summary,
    previousStatus = null,
    newStatus = null,
    staff
}) => {
    await OperationalActivityLog.create({
        action,
        entityType: "Flight",
        entityId,
        summary,
        previousStatus,
        newStatus,
        performedBy: staff ? staff._id : null,
        staffName: staff ? staff.fullName : "OCC System",
        department: staff ? staff.department : "OCC"
    });
};

const validateCrewIds = async (crewMembers) => {
    if (!Array.isArray(crewMembers) || crewMembers.length === 0) return [];
    const validStaff = await Staff.find({
        _id: { $in: crewMembers },
        isActive: true
    }).select("_id");

    if (validStaff.length !== crewMembers.length) {
        throw new Error("One or more assigned crew members are invalid or inactive.");
    }
    return validStaff.map((s) => s._id);
};

// GET /api/flights
exports.getFlights = async (req, res) => {
    try {
        const { search, status, filter: filterGroup, airline, origin, destination, route, date } = req.query;
        const query = {};

        if (filterGroup) {
            const fg = filterGroup.toLowerCase().trim();
            if (fg === "in_flight" || fg === "en_route") {
                query.flightStatus = { $in: ["In Flight", "In Transit", "Departed"] };
            } else if (fg === "on_time" || fg === "scheduled") {
                query.flightStatus = { $in: ["On Time", "Scheduled", "Boarding"] };
            } else if (fg === "delayed" || fg === "holds") {
                query.flightStatus = { $in: ["Delayed", "Hold"] };
            }
        } else if (status && status !== "All") {
            query.flightStatus = status.trim();
        }

        if (airline && airline !== "All") {
            query.airline = new RegExp(`^${airline.trim()}$`, "i");
        }
        if (origin) query.origin = origin.trim().toUpperCase();
        if (destination) query.destination = destination.trim().toUpperCase();
        if (route) query.route = route;
        if (date) {
            const start = new Date(date);
            if (!Number.isNaN(start.getTime())) {
                const end = new Date(start);
                end.setUTCDate(end.getUTCDate() + 1);
                query.scheduledDeparture = { $gte: start, $lt: end };
            }
        }

        if (search) {
            const regex = new RegExp(search.trim(), "i");
            const matchingCrew = await Staff.find({
                $or: [{ fullName: regex }, { staffId: regex }]
            }).select("_id");
            const crewIds = matchingCrew.map((c) => c._id);

            query.$or = [
                { flightNumber: regex },
                { origin: regex },
                { destination: regex },
                { airline: regex },
                { gate: regex },
                ...(crewIds.length > 0 ? [{ crewMembers: { $in: crewIds } }] : [])
            ];
        }

        const flights = await Flight.find(query)
            .populate("aircraft", AIRCRAFT_FIELDS)
            .populate("route", ROUTE_FIELDS)
            .populate("crewMembers", CREW_FIELDS)
            .sort({ scheduledDeparture: 1 });

        return res.status(200).json({
            count: flights.length,
            flights
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch flights.",
            error: error.message
        });
    }
};

// GET /api/flights/search
exports.searchFlights = async (req, res) => {
    req.query.search = req.query.q || req.query.search || "";
    return exports.getFlights(req, res);
};

// GET /api/flights/filters/counts
exports.getFilterCounts = async (req, res) => {
    try {
        const [agg] = await Flight.aggregate([
            {
                $group: {
                    _id: null,
                    all: { $sum: 1 },
                    inFlight: {
                        $sum: {
                            $cond: [{ $in: ["$flightStatus", ["In Flight", "In Transit", "Departed"]] }, 1, 0]
                        }
                    },
                    onTime: {
                        $sum: {
                            $cond: [{ $in: ["$flightStatus", ["On Time", "Scheduled", "Boarding"]] }, 1, 0]
                        }
                    },
                    delayed: {
                        $sum: {
                            $cond: [{ $in: ["$flightStatus", ["Delayed", "Hold"]] }, 1, 0]
                        }
                    },
                    arrived: {
                        $sum: { $cond: [{ $eq: ["$flightStatus", "Arrived"] }, 1, 0] }
                    },
                    cancelled: {
                        $sum: { $cond: [{ $eq: ["$flightStatus", "Cancelled"] }, 1, 0] }
                    }
                }
            }
        ]);

        const counts = agg || {
            all: 0,
            inFlight: 0,
            onTime: 0,
            delayed: 0,
            arrived: 0,
            cancelled: 0
        };
        delete counts._id;

        return res.status(200).json({ counts });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to calculate filter counts.",
            error: error.message
        });
    }
};

// GET /api/flights/:id
exports.getFlightById = async (req, res) => {
    try {
        const flight = await Flight.findById(req.params.id)
            .populate("aircraft", AIRCRAFT_FIELDS)
            .populate("route", ROUTE_FIELDS)
            .populate("crewMembers", CREW_FIELDS);

        if (!flight) {
            return res.status(404).json({ message: "Flight not found." });
        }

        return res.status(200).json({ flight });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch flight.",
            error: error.message
        });
    }
};

// POST /api/flights
exports.createFlight = async (req, res) => {
    try {
        const {
            flightNumber,
            flightDate,
            airline,
            origin,
            destination,
            scheduledDeparture,
            scheduledArrival,
            flightStatus,
            status,
            crewMembers,
            aircraft,
            aircraftId,
            route,
            gate,
            operationalStatus
        } = req.body;

        if (!flightNumber || !origin || !destination || !scheduledDeparture || !scheduledArrival) {
            return res.status(400).json({
                message: "flightNumber, origin, destination, scheduledDeparture, and scheduledArrival are required."
            });
        }

        const existing = await Flight.findOne({ flightNumber: flightNumber.toUpperCase().trim() });
        if (existing) {
            return res.status(409).json({
                message: "A flight with this flightNumber already exists."
            });
        }

        let validatedCrew = [];
        if (crewMembers && crewMembers.length > 0) {
            try {
                validatedCrew = await validateCrewIds(crewMembers);
            } catch (err) {
                return res.status(400).json({ message: err.message });
            }
        }

        const flight = await Flight.create({
            flightNumber,
            flightDate: flightDate || scheduledDeparture,
            airline,
            origin,
            destination,
            scheduledDeparture,
            scheduledArrival,
            flightStatus: flightStatus || status || "Scheduled",
            crewMembers: validatedCrew,
            aircraft: aircraft || aircraftId || null,
            route: route || null,
            gate,
            operationalStatus
        });

        await logActivity({
            action: "FLIGHT_CREATED",
            entityId: flight._id,
            summary: `Scheduled flight ${flight.flightNumber} (${flight.origin} -> ${flight.destination})`,
            newStatus: flight.flightStatus,
            staff: req.staff
        });

        const populated = await Flight.findById(flight._id)
            .populate("aircraft", AIRCRAFT_FIELDS)
            .populate("route", ROUTE_FIELDS)
            .populate("crewMembers", CREW_FIELDS);

        return res.status(201).json({
            message: "Flight scheduled successfully.",
            flight: populated
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to schedule flight.",
            error: error.message
        });
    }
};

// PUT /api/flights/:id
exports.updateFlight = async (req, res) => {
    try {
        const flight = await Flight.findById(req.params.id);
        if (!flight) {
            return res.status(404).json({ message: "Flight not found." });
        }

        if (req.body.crewMembers !== undefined) {
            try {
                flight.crewMembers = await validateCrewIds(req.body.crewMembers);
            } catch (err) {
                return res.status(400).json({ message: err.message });
            }
        }

        const updatable = [
            "flightDate",
            "airline",
            "origin",
            "destination",
            "scheduledDeparture",
            "scheduledArrival",
            "actualDeparture",
            "actualArrival",
            "flightStatus",
            "aircraft",
            "route",
            "gate",
            "operationalStatus"
        ];

        for (const field of updatable) {
            if (req.body[field] !== undefined) {
                flight[field] = req.body[field];
            }
        }

        await flight.save();

        await logActivity({
            action: "FLIGHT_UPDATED",
            entityId: flight._id,
            summary: `Updated details for flight ${flight.flightNumber}`,
            newStatus: flight.flightStatus,
            staff: req.staff
        });

        const populated = await Flight.findById(flight._id)
            .populate("aircraft", AIRCRAFT_FIELDS)
            .populate("route", ROUTE_FIELDS)
            .populate("crewMembers", CREW_FIELDS);

        return res.status(200).json({
            message: "Flight updated successfully.",
            flight: populated
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update flight.",
            error: error.message
        });
    }
};

// PATCH /api/flights/:id/status
exports.updateFlightStatus = async (req, res) => {
    try {
        const nextStatus = req.body.flightStatus || req.body.status;
        const { operationalStatus } = req.body;

        if (!nextStatus || !FLIGHT_STATUSES.includes(nextStatus)) {
            return res.status(400).json({
                message: `Invalid flightStatus. Allowed values: ${FLIGHT_STATUSES.join(", ")}`
            });
        }

        const flight = await Flight.findById(req.params.id);
        if (!flight) {
            return res.status(404).json({ message: "Flight not found." });
        }

        const previousStatus = flight.flightStatus;
        flight.flightStatus = nextStatus;

        if (operationalStatus) {
            flight.operationalStatus = operationalStatus;
        } else if (["Delayed", "Hold", "Cancelled"].includes(nextStatus)) {
            flight.operationalStatus = "Attention";
        } else {
            flight.operationalStatus = "Normal";
        }

        if (["Departed", "In Flight", "In Transit"].includes(nextStatus) && !flight.actualDeparture) {
            flight.actualDeparture = new Date();
        }
        if (nextStatus === "Arrived" && !flight.actualArrival) {
            flight.actualArrival = new Date();
        }

        await flight.save();

        await logActivity({
            action: "FLIGHT_STATUS_UPDATED",
            entityId: flight._id,
            summary: `Flight ${flight.flightNumber} status changed from ${previousStatus} to ${nextStatus}`,
            previousStatus,
            newStatus: nextStatus,
            staff: req.staff
        });

        const populated = await Flight.findById(flight._id)
            .populate("aircraft", AIRCRAFT_FIELDS)
            .populate("route", ROUTE_FIELDS)
            .populate("crewMembers", CREW_FIELDS);

        return res.status(200).json({
            message: "Flight status updated successfully.",
            flight: populated
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update flight status.",
            error: error.message
        });
    }
};

// DELETE /api/flights/:id
exports.deleteFlight = async (req, res) => {
    try {
        const flight = await Flight.findByIdAndDelete(req.params.id);
        if (!flight) {
            return res.status(404).json({ message: "Flight not found." });
        }

        await logActivity({
            action: "FLIGHT_DELETED",
            entityId: flight._id,
            summary: `Deleted flight ${flight.flightNumber} (${flight.origin} -> ${flight.destination})`,
            previousStatus: flight.flightStatus,
            staff: req.staff
        });

        return res.status(200).json({
            message: "Flight deleted successfully."
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to delete flight.",
            error: error.message
        });
    }
};
