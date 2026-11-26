const express = require("express");
const router = express.Router();
const {
    getFleetSummary,
    getAllFleet,
    getFleetById,
    createFleet,
    updateFleet,
    updateAvailability,
    updateMaintenance,
    deleteFleet
} = require("../controllers/fleetController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/stats/summary", protect, getFleetSummary);
router.get("/", protect, getAllFleet);
router.get("/:id", protect, getFleetById);
router.post("/", protect, authorizeRoles("admin", "supervisor"), createFleet);
router.put("/:id", protect, authorizeRoles("admin", "supervisor"), updateFleet);
router.patch("/:id/availability", protect, authorizeRoles("admin", "supervisor", "controller"), updateAvailability);
router.patch("/:id/maintenance", protect, authorizeRoles("admin", "supervisor", "controller"), updateMaintenance);
router.delete("/:id", protect, authorizeRoles("admin", "supervisor"), deleteFleet);

module.exports = router;
