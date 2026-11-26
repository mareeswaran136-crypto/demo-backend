const express = require("express");
const router = express.Router();
const {
    getCrewSummary,
    getAllCrew,
    getCrewById,
    createCrew,
    updateCrew,
    updateDutyStatus,
    assignFlightToCrew,
    deleteCrew
} = require("../controllers/crewController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/stats/summary", protect, getCrewSummary);
router.get("/", protect, getAllCrew);
router.get("/:id", protect, getCrewById);
router.post("/", protect, authorizeRoles("admin", "supervisor"), createCrew);
router.put("/:id", protect, authorizeRoles("admin", "supervisor"), updateCrew);
router.patch("/:id/duty-status", protect, authorizeRoles("admin", "supervisor", "controller"), updateDutyStatus);
router.patch("/:id/assign-flight", protect, authorizeRoles("admin", "supervisor", "controller"), assignFlightToCrew);
router.delete("/:id", protect, authorizeRoles("admin", "supervisor"), deleteCrew);

module.exports = router;
