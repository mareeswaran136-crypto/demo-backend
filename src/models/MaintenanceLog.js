const mongoose = require("mongoose");

const MAINTENANCE_STATUSES = ["IN PROGRESS", "SCHEDULED", "COMPLETED"];
const MAINTENANCE_CATEGORIES = [
    "Hangar Inspection",
    "A-Check",
    "Avionics Calibration",
    "Audit",
    "Engine Diagnostics"
];

const maintenanceLogSchema = new mongoose.Schema(
    {
        aircraftId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Aircraft",
            required: [true, "Aircraft ID is required"]
        },
        registrationNumber: {
            type: String,
            required: [true, "Registration number is required"],
            uppercase: true,
            trim: true
        },
        aircraftModel: {
            type: String,
            required: [true, "Aircraft model is required"],
            trim: true
        },
        taskTitle: {
            type: String,
            required: [true, "Maintenance task title is required"],
            trim: true
        },
        checkCode: {
            type: String,
            required: [true, "Check code is required"],
            trim: true
        },
        category: {
            type: String,
            enum: MAINTENANCE_CATEGORIES,
            default: "A-Check"
        },
        hangarBay: {
            type: String,
            default: "Hangar Bay 1",
            trim: true
        },
        assignedEngineer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staff",
            default: null
        },
        estimatedReturnToService: {
            type: Date,
            required: [true, "Estimated Return to Service is required"]
        },
        status: {
            type: String,
            enum: MAINTENANCE_STATUSES,
            default: "SCHEDULED"
        },
        signedOffBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staff",
            default: null
        },
        signedOffAt: {
            type: Date,
            default: null
        },
        signOffRemarks: {
            type: String,
            default: "",
            trim: true
        }
    },
    {
        timestamps: true,
        collection: "maintenance_logs"
    }
);

maintenanceLogSchema.index({ registrationNumber: 1 });
maintenanceLogSchema.index({ status: 1 });
maintenanceLogSchema.index({ category: 1 });

module.exports = mongoose.model("MaintenanceLog", maintenanceLogSchema);
module.exports.MAINTENANCE_STATUSES = MAINTENANCE_STATUSES;
module.exports.MAINTENANCE_CATEGORIES = MAINTENANCE_CATEGORIES;
