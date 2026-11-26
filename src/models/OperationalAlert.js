const mongoose = require("mongoose");

const operationalAlertSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Alert title is required"],
            trim: true
        },
        message: {
            type: String,
            default: "",
            trim: true
        },
        category: {
            type: String,
            enum: ["FlightRipple", "ATC", "Crew FTL", "Maintenance", "OCC Advisory"],
            default: "OCC Advisory"
        },
        severity: {
            type: String,
            enum: ["info", "warning", "critical"],
            default: "info"
        },
        relatedFlightNumber: {
            type: String,
            default: "",
            uppercase: true,
            trim: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staff",
            default: null
        },
        staffName: {
            type: String,
            default: "OCC System"
        }
    },
    {
        timestamps: true,
        collection: "operational_alerts"
    }
);

operationalAlertSchema.index({ createdAt: -1 });
operationalAlertSchema.index({ relatedFlightNumber: 1 });
operationalAlertSchema.index({ category: 1 });

module.exports = mongoose.model("OperationalAlert", operationalAlertSchema);
