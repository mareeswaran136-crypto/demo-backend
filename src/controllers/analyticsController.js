const AnalyticsSnapshot = require("../models/AnalyticsSnapshot");
const { PERIOD_KEYS } = require("../models/AnalyticsSnapshot");
const { Flight } = require("../models/Flight");
const Aircraft = require("../models/Aircraft");
const OperationalActivityLog = require("../models/OperationalActivityLog");

const PERIOD_MULTIPLIER = {
    today: 1,
    this_week: 7,
    this_month: 30,
    q4_2026: 90
};

const normalizePeriod = (raw) => {
    const key = (raw || "today").toLowerCase().trim().replace(/\s+/g, "_");
    return PERIOD_KEYS.includes(key) ? key : "today";
};

const getDateRange = (periodKey) => {
    const endDate = new Date();
    const startDate = new Date(endDate);
    const days = PERIOD_MULTIPLIER[periodKey] || 1;
    startDate.setUTCDate(startDate.getUTCDate() - days);
    return { startDate, endDate };
};

const computeAnalyticsForPeriod = async (periodKey) => {
    const multiplier = PERIOD_MULTIPLIER[periodKey] || 1;
    const dateRange = getDateRange(periodKey);

    const [flights, aircraftGroups] = await Promise.all([
        Flight.find().select("flightStatus scheduledDeparture delayMinutes groundPriorityExpedited"),
        Aircraft.aggregate([
            { $match: { isActive: { $ne: false } } },
            {
                $group: {
                    _id: "$model",
                    frameCount: { $sum: 1 },
                    activeFrames: {
                        $sum: { $cond: [{ $eq: ["$availabilityStatus", "Active"] }, 1, 0] }
                    },
                    avgHealth: { $avg: "$fleetHealthScore" }
                }
            },
            { $sort: { frameCount: -1, _id: 1 } }
        ])
    ]);

    const nonCancelled = flights.filter((f) => f.flightStatus !== "Cancelled");
    const onTime = nonCancelled.filter((f) => f.flightStatus !== "Delayed");
    const averageOtpPercent =
        nonCancelled.length > 0
            ? Number(((onTime.length / nonCancelled.length) * 100).toFixed(1))
            : 100;

    const variance = Number((averageOtpPercent - 85).toFixed(1));
    const otpVarianceLabel = `${variance >= 0 ? "+" : ""}${variance}% vs 85% Target`;

    const totalFrames = aircraftGroups.reduce((acc, g) => acc + g.frameCount, 0);
    const activeFrames = aircraftGroups.reduce((acc, g) => acc + g.activeFrames, 0);
    const fleetUtilizationPercent =
        totalFrames > 0 ? Number(((activeFrames / totalFrames) * 100).toFixed(1)) : 0;
    const dailyBlockHoursAvg = Number((8.5 + (fleetUtilizationPercent / 100) * 4.5).toFixed(1));

    const fuelSavingsAmount = Math.round(nonCancelled.length * 1450 * multiplier);
    const delayedCount = nonCancelled.length - onTime.length;
    const turnaroundAverageMinutes = Math.max(32, Math.round(38 + delayedCount * 3));

    const slots = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
    const hourlyOtp = slots.map((hourLabel, idx) => {
        const slotFlights = nonCancelled.filter((_, i) => i % slots.length === idx);
        const slotOnTime = slotFlights.filter((f) => f.flightStatus !== "Delayed");
        const otpPercent =
            slotFlights.length > 0
                ? Number(((slotOnTime.length / slotFlights.length) * 100).toFixed(1))
                : averageOtpPercent;
        return {
            hourLabel,
            otpPercent,
            flightCount: slotFlights.length * multiplier
        };
    });

    const aircraftProductivity = aircraftGroups.map((g) => {
        const util = g.frameCount > 0 ? Number(((g.activeFrames / g.frameCount) * 100).toFixed(1)) : 0;
        const dailyBlockHours = Number((9.2 + (util / 100) * 3.8).toFixed(1));
        const totalKm = Math.round(g.frameCount * 4200 * multiplier);
        return {
            modelName: g._id,
            frameCount: g.frameCount,
            dailyBlockHours,
            utilizationPercent: util,
            totalKm
        };
    });

    const totalNetworkKm = aircraftProductivity.reduce((acc, a) => acc + a.totalKm, 0);

    const snapshot = await AnalyticsSnapshot.findOneAndUpdate(
        { periodKey },
        {
            $set: {
                periodKey,
                dateRange,
                averageOtpPercent,
                otpVarianceLabel,
                fleetUtilizationPercent,
                dailyBlockHoursAvg,
                fuelSavingsAmount,
                fuelSavingsNote: "FlightRipple AI Optimization",
                turnaroundAverageMinutes,
                turnaroundBenchmarkNote: "Target <= 45 min",
                hourlyOtp,
                aircraftProductivity,
                totalNetworkKm,
                computedAt: new Date()
            }
        },
        { upsert: true, new: true, runValidators: true }
    );

    return snapshot;
};

// GET /api/analytics/overview?period=today|this_week|this_month|q4_2026
exports.getOverview = async (req, res) => {
    try {
        const periodKey = normalizePeriod(req.query.period);
        const snapshot = await computeAnalyticsForPeriod(periodKey);
        return res.status(200).json({ analytics: snapshot });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch analytics overview.",
            error: error.message
        });
    }
};

// GET /api/analytics/hourly-otp?period=...
exports.getHourlyOtp = async (req, res) => {
    try {
        const periodKey = normalizePeriod(req.query.period);
        const snapshot = await computeAnalyticsForPeriod(periodKey);
        return res.status(200).json({
            periodKey,
            targetBaseline: 85,
            hourlyOtp: snapshot.hourlyOtp
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch hourly OTP data.",
            error: error.message
        });
    }
};

// GET /api/analytics/fleet-productivity?period=...
exports.getFleetProductivity = async (req, res) => {
    try {
        const periodKey = normalizePeriod(req.query.period);
        const snapshot = await computeAnalyticsForPeriod(periodKey);
        return res.status(200).json({
            periodKey,
            totalNetworkKm: snapshot.totalNetworkKm,
            aircraftProductivity: snapshot.aircraftProductivity
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch fleet productivity.",
            error: error.message
        });
    }
};

// POST /api/analytics/recalculate
exports.recalculateAnalytics = async (req, res) => {
    try {
        const snapshots = await Promise.all(
            PERIOD_KEYS.map((key) => computeAnalyticsForPeriod(key))
        );

        await OperationalActivityLog.create({
            action: "ANALYTICS_RECALCULATED",
            entityType: "System",
            summary: "Recalculated Operations & Performance Analytics across all timeframes.",
            performedBy: req.staff ? req.staff._id : null,
            staffName: req.staff ? req.staff.fullName : "OCC System",
            department: req.staff ? req.staff.department : "OCC"
        });

        return res.status(200).json({
            message: "Analytics recalculated successfully.",
            periodsUpdated: snapshots.map((s) => s.periodKey)
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to recalculate analytics.",
            error: error.message
        });
    }
};
