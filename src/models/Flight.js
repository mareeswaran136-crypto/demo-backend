const mongoose = require("mongoose");

const FLIGHT_STATUSES = [
    "Scheduled",
    "Boarding",
    "On Time",
    "In Flight",
    "Departed",
    "In Transit",
    "Delayed",
    "Hold",
    "Arrived",
    "Cancelled"
];

const flightSchema = new mongoose.Schema(
    {
        flightNumber: {
            type: String,
            required: [true, "Flight number is required"],
            unique: true,
            uppercase: true,
            trim: true
        },
        flightDate: {
            type: Date,
            default: function () {
                return this.scheduledDeparture || Date.now();
            }
        },
        airline: {
            type: String,
            default: "SAVÉRA",
            trim: true
        },
        origin: {
            type: String,
            required: [true, "Origin is required"],
            uppercase: true,
            trim: true
        },
        destination: {
            type: String,
            required: [true, "Destination is required"],
            uppercase: true,
            trim: true
        },
        scheduledDeparture: {
            type: Date,
            required: [true, "Scheduled departure is required"]
        },
        scheduledArrival: {
            type: Date,
            required: [true, "Scheduled arrival is required"]
        },
        actualDeparture: {
            type: Date,
            default: null
        },
        actualArrival: {
            type: Date,
            default: null
        },
        flightStatus: {
            type: String,
            enum: FLIGHT_STATUSES,
            default: "Scheduled"
        },
        crewMembers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Staff"
            }
        ],
        aircraft: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Aircraft",
            default: null
        },
        route: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route",
            default: null
        },
        gate: {
            type: String,
            trim: true,
            default: "TBD"
        },
        operationalStatus: {
            type: String,
            enum: ["Normal", "Attention", "Critical"],
            default: "Normal"
        },
        sector: {
            type: String,
            default: "DEL / BOM AIRSPACE SECTOR - PRIMARY RADAR",
            trim: true
        },
        altitude: {
            type: String,
            default: "FL350",
            trim: true
        },
        speedKnots: {
            type: Number,
            default: 475
        },
        telemetryStatus: {
            type: String,
            enum: ["En Route", "Holding", "Approach", "Turnaround", "Delayed", "Scheduled"],
            default: "En Route"
        },
        lastSyncedAt: {
            type: Date,
            default: Date.now
        },
        delayMinutes: {
            type: Number,
            default: 0
        },
        delayCause: {
            type: String,
            default: "",
            trim: true
        },
        mitigationAction: {
            type: String,
            default: "",
            trim: true
        },
        groundPriorityExpedited: {
            type: Boolean,
            default: false
        },
        isDemoData: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        collection: "flights"
    }
);

module.exports = {
    Flight: mongoose.model("Flight", flightSchema),
    FLIGHT_STATUSES
};
