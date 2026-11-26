const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema(
    {
        routeCode: {
            type: String,
            required: [true, "Route code is required"],
            unique: true,
            uppercase: true,
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
        plannedRoute: {
            type: String,
            required: [true, "Planned route is required"],
            trim: true
        },
        estimatedDeparture: {
            type: String,
            trim: true
        },
        estimatedArrival: {
            type: String,
            trim: true
        },
        routeStatus: {
            type: String,
            enum: ["Optimal", "Congested", "Rerouted", "Weather Hold"],
            default: "Optimal"
        },
        airspaceSyncStatus: {
            type: String,
            enum: ["Synchronized (Demo)", "Pending", "Advisory"],
            default: "Synchronized (Demo)"
        },
        optimizationStatus: {
            type: String,
            enum: ["Optimized", "Optimizing", "Manual Override"],
            default: "Optimized"
        },
        isDemoData: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        collection: "routes"
    }
);

module.exports = mongoose.model("Route", routeSchema);
