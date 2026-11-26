const express = require("express");
const router = express.Router();
const {
    getFlights,
    searchFlights,
    getFilterCounts,
    getFlightById,
    createFlight,
    updateFlight,
    updateFlightStatus,
    deleteFlight
} = require("../controllers/flightController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", protect, getFlights);
router.get("/search", protect, searchFlights);
router.get("/filters/counts", protect, getFilterCounts);
router.get("/:id", protect, getFlightById);
router.post("/", protect, authorizeRoles("admin", "supervisor", "controller"), createFlight);
router.put("/:id", protect, authorizeRoles("admin", "supervisor", "controller"), updateFlight);
router.patch("/:id/status", protect, authorizeRoles("admin", "supervisor", "controller"), updateFlightStatus);
router.delete("/:id", protect, authorizeRoles("admin", "supervisor"), deleteFlight);

module.exports = router;
