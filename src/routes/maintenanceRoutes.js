const express = require("express");
const router = express.Router();
const {
    getMaintenanceSummary,
    getAllMaintenance,
    getMaintenanceById,
    createMaintenance,
    updateMaintenance,
    signOffMaintenance,
    deleteMaintenance
} = require("../controllers/maintenanceController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/stats/summary", protect, getMaintenanceSummary);
router.get("/", protect, getAllMaintenance);
router.get("/:id", protect, getMaintenanceById);
router.post("/", protect, authorizeRoles("admin", "supervisor", "controller"), createMaintenance);
router.put("/:id", protect, authorizeRoles("admin", "supervisor", "controller"), updateMaintenance);
router.patch("/:id/sign-off", protect, authorizeRoles("admin", "supervisor", "controller"), signOffMaintenance);
router.delete("/:id", protect, authorizeRoles("admin", "supervisor"), deleteMaintenance);

module.exports = router;
