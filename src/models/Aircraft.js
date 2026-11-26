const mongoose = require("mongoose");

const AVAILABILITY_STATUSES = ["Active", "Standby", "In Maintenance"];

const aircraftSchema = new mongoose.Schema(
    {
        registration: {
            type: String,
            required: [true, "Aircraft registration is required"],
            unique: true,
            uppercase: true,
            trim: true
        },
        msn: {
            type: String,
            default: "",
            trim: true
        },
        deliveryYear: {
            type: Number,
            default: 2024
        },
        model: {
            type: String,
            required: [true, "Aircraft model is required"],
            trim: true
        },
        modelCode: {
            type: String,
            default: "B787",
            uppercase: true,
            trim: true
        },
        engineType: {
            type: String,
            default: "GEnx-1B",
            trim: true
        },
        airline: {
            type: String,
            default: "SAVÉRA",
            trim: true
        },
        capacity: {
            type: Number,
            default: 240
        },
        cabinBreakdown: {
            first: { type: Number, default: 12 },
            business: { type: Number, default: 36 },
            economy: { type: Number, default: 192 }
        },
        status: {
            type: String,
            enum: ["Active", "Maintenance", "Grounded"],
            default: "Active"
        },
        availabilityStatus: {
            type: String,
            enum: AVAILABILITY_STATUSES,
            default: "Active"
        },
        maintenanceStatus: {
            label: { type: String, default: "A-Check Cleared" },
            nextCheckSummary: { type: String, default: "Next check in 420 FH" },
            isCleared: { type: Boolean, default: true }
        },
        assignedRoute: {
            origin: { type: String, default: "", uppercase: true, trim: true },
            destination: { type: String, default: "", uppercase: true, trim: true },
            flightNumber: { type: String, default: "", uppercase: true, trim: true }
        },
        fleetHealthScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 98
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isDemoData: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        collection: "aircraft"
    }
);

aircraftSchema.index({ modelCode: 1 });
aircraftSchema.index({ availabilityStatus: 1 });

module.exports = mongoose.model("Aircraft", aircraftSchema);
module.exports.AVAILABILITY_STATUSES = AVAILABILITY_STATUSES;
