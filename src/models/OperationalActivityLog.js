const mongoose = require("mongoose");

const operationalActivityLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            trim: true
        },
        entityType: {
            type: String,
            enum: ["Flight", "Route", "Aircraft", "System"],
            required: true
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        summary: {
            type: String,
            required: true,
            trim: true
        },
        previousStatus: {
            type: String,
            default: null
        },
        newStatus: {
            type: String,
            default: null
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staff",
            default: null
        },
        staffName: {
            type: String,
            default: "OCC System"
        },
        department: {
            type: String,
            default: "OCC"
        }
    },
    {
        timestamps: true,
        collection: "operational_activity_logs"
    }
);

module.exports = mongoose.model(
    "OperationalActivityLog",
    operationalActivityLogSchema
);
