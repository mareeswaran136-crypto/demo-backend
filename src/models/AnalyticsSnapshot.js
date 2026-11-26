const mongoose = require("mongoose");

const PERIOD_KEYS = ["today", "this_week", "this_month", "q4_2026"];

const analyticsSnapshotSchema = new mongoose.Schema(
    {
        periodKey: {
            type: String,
            enum: PERIOD_KEYS,
            required: true,
            unique: true
        },
        dateRange: {
            startDate: { type: Date, required: true },
            endDate: { type: Date, required: true }
        },
        averageOtpPercent: { type: Number, default: 0 },
        otpVarianceLabel: { type: String, default: "+0.0% vs Target" },
        fleetUtilizationPercent: { type: Number, default: 0 },
        dailyBlockHoursAvg: { type: Number, default: 0 },
        fuelSavingsAmount: { type: Number, default: 0 },
        fuelSavingsNote: { type: String, default: "FlightRipple AI Optimization" },
        turnaroundAverageMinutes: { type: Number, default: 42 },
        turnaroundBenchmarkNote: { type: String, default: "Target <= 45 min" },
        hourlyOtp: [
            {
                hourLabel: { type: String, required: true },
                otpPercent: { type: Number, required: true },
                flightCount: { type: Number, default: 0 }
            }
        ],
        aircraftProductivity: [
            {
                modelName: { type: String, required: true },
                frameCount: { type: Number, default: 0 },
                dailyBlockHours: { type: Number, default: 0 },
                utilizationPercent: { type: Number, default: 0 },
                totalKm: { type: Number, default: 0 }
            }
        ],
        totalNetworkKm: { type: Number, default: 0 },
        computedAt: { type: Date, default: Date.now }
    },
    {
        timestamps: true,
        collection: "analytics_snapshots"
    }
);

analyticsSnapshotSchema.index({ computedAt: -1 });

module.exports = mongoose.model("AnalyticsSnapshot", analyticsSnapshotSchema);
module.exports.PERIOD_KEYS = PERIOD_KEYS;
