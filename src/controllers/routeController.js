const Route = require("../models/Route");
const OperationalActivityLog = require("../models/OperationalActivityLog");

// GET /api/routes
exports.getRoutes = async (req, res) => {
    try {
        const routes = await Route.find().sort({ routeCode: 1 });
        return res.status(200).json({
            count: routes.length,
            routes
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch routes.",
            error: error.message
        });
    }
};

// GET /api/routes/:id
exports.getRouteById = async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);
        if (!route) {
            return res.status(404).json({ message: "Route not found." });
        }
        return res.status(200).json({ route });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch route.",
            error: error.message
        });
    }
};

// PUT /api/routes/:id
exports.updateRoute = async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);
        if (!route) {
            return res.status(404).json({ message: "Route not found." });
        }

        const previousStatus = route.routeStatus;
        const updatable = [
            "plannedRoute",
            "estimatedDeparture",
            "estimatedArrival",
            "routeStatus",
            "airspaceSyncStatus",
            "optimizationStatus"
        ];

        for (const field of updatable) {
            if (req.body[field] !== undefined) {
                route[field] = req.body[field];
            }
        }

        await route.save();

        await OperationalActivityLog.create({
            action: "ROUTE_UPDATED",
            entityType: "Route",
            entityId: route._id,
            summary: `Updated route ${route.routeCode} (${route.routeStatus}, ${route.optimizationStatus})`,
            previousStatus,
            newStatus: route.routeStatus,
            performedBy: req.staff ? req.staff._id : null,
            staffName: req.staff ? req.staff.fullName : "OCC System",
            department: req.staff ? req.staff.department : "OCC"
        });

        return res.status(200).json({
            message: "Route updated successfully.",
            route
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update route.",
            error: error.message
        });
    }
};
