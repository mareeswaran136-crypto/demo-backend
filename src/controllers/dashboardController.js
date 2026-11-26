const { Flight } = require("../models/Flight");
const Aircraft = require("../models/Aircraft");
const Route = require("../models/Route");
const Staff = require("../models/Staff");
const MaintenanceLog = require("../models/MaintenanceLog");
const OperationalActivityLog = require("../models/OperationalActivityLog");

const buildDateFilter = (period, startDate, endDate) => {
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            return { $gte: start, $lte: end };
        }
    }
    if (!period || period === "all") return null;

    const now = new Date();
    const start = new Date(now);
    const p = period.toLowerCase().trim();
    if (p === "today" || p === "day" || p === "daily") {
        start.setUTCHours(0, 0, 0, 0);
    } else if (p === "week" || p === "weekly" || p === "7d") {
        start.setUTCDate(start.getUTCDate() - 7);
    } else if (p === "month" || p === "monthly" || p === "30d") {
        start.setUTCDate(start.getUTCDate() - 30);
    } else {
        return null;
    }
    return { $gte: start, $lte: now };
};

const calculateKpisFromDb = async (dateRange) => {
    const flightMatch = dateRange ? { scheduledDeparture: dateRange } : {};

    const [flightAgg, aircraftAgg, crewAgg, routeAgg, maintenanceInHangar] = await Promise.all([
        Flight.aggregate([
            { $match: flightMatch },
            {
                $group: {
                    _id: null,
                    totalFlights: { $sum: 1 },
                    activeFlights: {
                        $sum: {
                            $cond: [
                                { $in: ["$flightStatus", ["Scheduled", "Boarding", "Departed", "In Flight", "In Transit", "Delayed"]] },
                                1,
                                0
                            ]
                        }
                    },
                    boardingFlights: { $sum: { $cond: [{ $eq: ["$flightStatus", "Boarding"] }, 1, 0] } },
                    departedFlights: { $sum: { $cond: [{ $eq: ["$flightStatus", "Departed"] }, 1, 0] } },
                    inFlight: { $sum: { $cond: [{ $in: ["$flightStatus", ["In Flight", "In Transit"]] }, 1, 0] } },
                    nonCancelled: { $sum: { $cond: [{ $ne: ["$flightStatus", "Cancelled"] }, 1, 0] } },
                    onTimeFlights: {
                        $sum: {
                            $cond: [
                                { $and: [{ $ne: ["$flightStatus", "Cancelled"] }, { $ne: ["$flightStatus", "Delayed"] }] },
                                1,
                                0
                            ]
                        }
                    },
                    delayedFlights: { $sum: { $cond: [{ $eq: ["$flightStatus", "Delayed"] }, 1, 0] } }
                }
            }
        ]),
        Aircraft.aggregate([
            { $match: { isActive: { $ne: false } } },
            {
                $group: {
                    _id: null,
                    totalAircraft: { $sum: 1 },
                    activeAircraft: { $sum: { $cond: [{ $eq: ["$availabilityStatus", "Active"] }, 1, 0] } },
                    standbyAircraft: { $sum: { $cond: [{ $eq: ["$availabilityStatus", "Standby"] }, 1, 0] } },
                    maintenanceAircraft: { $sum: { $cond: [{ $eq: ["$availabilityStatus", "In Maintenance"] }, 1, 0] } },
                    assignedAircraft: {
                        $sum: {
                            $cond: [
                                { $and: [{ $ne: ["$assignedRoute.flightNumber", ""] }, { $ne: ["$assignedRoute.flightNumber", null] }] },
                                1,
                                0
                            ]
                        }
                    },
                    avgFleetHealth: { $avg: "$fleetHealthScore" }
                }
            }
        ]),
        Staff.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: null,
                    totalCrew: { $sum: 1 },
                    crewOnDuty: { $sum: { $cond: [{ $eq: ["$dutyStatus", "On Duty"] }, 1, 0] } },
                    standbyCrew: { $sum: { $cond: [{ $eq: ["$dutyStatus", "Standby"] }, 1, 0] } },
                    restCrew: { $sum: { $cond: [{ $eq: ["$dutyStatus", "Rest Period"] }, 1, 0] } },
                    assignedCrew: { $sum: { $cond: [{ $ne: ["$assignedFlight", null] }, 1, 0] } }
                }
            }
        ]),
        Route.aggregate([
            {
                $group: {
                    _id: null,
                    totalRoutes: { $sum: 1 },
                    optimalRoutes: { $sum: { $cond: [{ $eq: ["$routeStatus", "Optimal"] }, 1, 0] } }
                }
            }
        ]),
        MaintenanceLog.countDocuments({ status: "IN PROGRESS" })
    ]);

    const f = flightAgg[0] || {
        totalFlights: 0,
        activeFlights: 0,
        boardingFlights: 0,
        departedFlights: 0,
        inFlight: 0,
        nonCancelled: 0,
        onTimeFlights: 0,
        delayedFlights: 0
    };
    const a = aircraftAgg[0] || {
        totalAircraft: 0,
        activeAircraft: 0,
        standbyAircraft: 0,
        maintenanceAircraft: 0,
        assignedAircraft: 0,
        avgFleetHealth: 100
    };
    const c = crewAgg[0] || {
        totalCrew: 0,
        crewOnDuty: 0,
        standbyCrew: 0,
        restCrew: 0,
        assignedCrew: 0
    };
    const r = routeAgg[0] || { totalRoutes: 0, optimalRoutes: 0 };

    const onTimePercentage =
        f.nonCancelled > 0 ? Number(((f.onTimeFlights / f.nonCancelled) * 100).toFixed(1)) : 100;
    const fleetUtilizationPercentage =
        a.totalAircraft > 0 ? Number(((a.activeAircraft / a.totalAircraft) * 100).toFixed(1)) : 0;

    return {
        // Legacy flat fields preserved for backward compatibility
        totalActiveFlights: f.activeFlights,
        totalFlights: f.totalFlights,
        delayedFlights: f.delayedFlights,
        onTimePerformance: onTimePercentage,
        operationalEfficiency: Number(
            ((onTimePercentage + (r.totalRoutes > 0 ? (r.optimalRoutes / r.totalRoutes) * 100 : 100)) / 2).toFixed(1)
        ),
        fleetPerformance: Number((a.avgFleetHealth || 0).toFixed(1)),
        activeAircraft: a.activeAircraft,
        totalAircraft: a.totalAircraft,
        // Structured KPI cards
        activeFlights: {
            total: f.activeFlights,
            boarding: f.boardingFlights,
            departed: f.departedFlights,
            inFlight: f.inFlight
        },
        onTimePerformanceCard: {
            percentage: onTimePercentage,
            onTimeFlights: f.onTimeFlights,
            delayedFlights: f.delayedFlights
        },
        crewOnDuty: {
            totalCrew: c.totalCrew,
            onDuty: c.crewOnDuty,
            available: c.standbyCrew,
            assigned: c.assignedCrew,
            standby: c.standbyCrew,
            restPeriod: c.restCrew
        },
        fleetUtilization: {
            totalAircraft: a.totalAircraft,
            active: a.activeAircraft,
            available: a.standbyAircraft,
            assigned: a.assignedAircraft,
            underMaintenance: Math.max(a.maintenanceAircraft, maintenanceInHangar > 0 ? 1 : 0),
            utilizationPercentage: fleetUtilizationPercentage
        },
        routeSummary: r
    };
};

// GET /api/dashboard/kpis
exports.getKpis = async (req, res) => {
    try {
        const dateRange = buildDateFilter(req.query.period, req.query.startDate, req.query.endDate);
        const kpis = await calculateKpisFromDb(dateRange);
        return res.status(200).json({ success: true, kpis });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to calculate dashboard KPIs.",
            error: error.message
        });
    }
};

// GET /api/dashboard/operations
exports.getOperations = async (req, res) => {
    try {
        const [routes, aircraft, recentActivity] = await Promise.all([
            Route.find().sort({ updatedAt: -1 }),
            Aircraft.find({ isActive: { $ne: false } }).sort({ registration: 1 }),
            OperationalActivityLog.find().sort({ createdAt: -1 }).limit(15)
        ]);

        return res.status(200).json({
            success: true,
            routes,
            aircraft,
            recentActivity
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard operations data.",
            error: error.message
        });
    }
};

// GET /api/dashboard/overview?period=today|week|month&startDate=...&endDate=...
exports.getOverview = async (req, res) => {
    try {
        const dateRange = buildDateFilter(req.query.period, req.query.startDate, req.query.endDate);
        const flightMatch = dateRange ? { scheduledDeparture: dateRange } : {};

        const [
            kpis,
            recentFlights,
            delayedFlights,
            statusAgg,
            activityAgg,
            routes,
            recentActivity
        ] = await Promise.all([
            calculateKpisFromDb(dateRange),
            Flight.find(flightMatch)
                .populate("aircraft", "registration model availabilityStatus fleetHealthScore")
                .populate("route", "routeCode plannedRoute routeStatus airspaceSyncStatus optimizationStatus")
                .sort({ scheduledDeparture: 1 })
                .limit(20),
            Flight.find({
                ...flightMatch,
                $or: [{ flightStatus: "Delayed" }, { delayMinutes: { $gt: 0 } }]
            })
                .populate("aircraft", "registration model")
                .sort({ delayMinutes: -1, scheduledDeparture: 1 }),
            Flight.aggregate([
                { $match: flightMatch },
                { $group: { _id: "$flightStatus", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Flight.aggregate([
                { $match: flightMatch },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledDeparture" } },
                        flights: { $sum: 1 },
                        delayed: { $sum: { $cond: [{ $eq: ["$flightStatus", "Delayed"] }, 1, 0] } }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Route.find().sort({ updatedAt: -1 }),
            OperationalActivityLog.find().sort({ createdAt: -1 }).limit(10)
        ]);

        const flightStatusOverview = statusAgg.map((s) => ({
            status: s._id,
            count: s.count
        }));

        const flightActivity = activityAgg.map((a) => ({
            date: a._id,
            flights: a.flights,
            delayed: a.delayed
        }));

        const data = {
            kpis,
            flightStatusOverview,
            flightActivity,
            recentFlights,
            delayedFlights,
            aircraftOverview: kpis.fleetUtilization,
            crewOverview: kpis.crewOnDuty,
            routeOverview: {
                totalRoutes: kpis.routeSummary.totalRoutes,
                optimalRoutes: kpis.routeSummary.optimalRoutes,
                routes
            },
            flightRipple: {
                isSimulated: true,
                fuelSaved: { value: kpis.totalFlights * 1450, unit: "USD (Demo)" },
                timeSaved: { value: kpis.routeSummary.optimalRoutes * 12, unit: "mins (Demo)" },
                optimizedRoutes: kpis.routeSummary.optimalRoutes,
                routeInsights: routes.slice(0, 5)
            }
        };

        return res.status(200).json({
            success: true,
            message: "Dashboard data retrieved successfully",
            data,
            // Legacy top-level keys preserved for backward compatibility
            kpis,
            flights: recentFlights,
            routes,
            recentActivity
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard overview.",
            error: error.message
        });
    }
};
