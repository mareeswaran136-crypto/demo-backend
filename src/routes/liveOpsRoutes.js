const express = require("express");
const router = express.Router();
const {
    getRadar,
    syncRadar,
    getAlerts,
    broadcastAdvisory,
    getDelays,
    expediteDelay
} = require("../controllers/liveOpsController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/radar", protect, getRadar);
router.post("/radar/sync", protect, authorizeRoles("admin", "supervisor", "controller"), syncRadar);
router.get("/alerts", protect, getAlerts);
router.post("/alerts/broadcast", protect, authorizeRoles("admin", "supervisor", "controller"), broadcastAdvisory);
router.get("/delays", protect, getDelays);
router.patch("/delays/:flightId/expedite", protect, authorizeRoles("admin", "supervisor", "controller"), expediteDelay);

module.exports = router;
