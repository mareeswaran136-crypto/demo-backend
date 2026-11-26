const OperationalActivityLog = require("../models/OperationalActivityLog");
const Aircraft = require("../models/Aircraft");

// GET /api/operations/activity
exports.getActivityLogs = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 25, 100);
        const logs = await OperationalActivityLog.find()
            .sort({ createdAt: -1 })
            .limit(limit);

        return res.status(200).json({
            count: logs.length,
            logs
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch operational activity logs.",
            error: error.message
        });
    }
};

// GET /api/aircraft
exports.getAircraft = async (req, res) => {
    try {
        const aircraft = await Aircraft.find().sort({ registration: 1 });
        return res.status(200).json({
            count: aircraft.length,
            aircraft
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch aircraft.",
            error: error.message
        });
    }
};
