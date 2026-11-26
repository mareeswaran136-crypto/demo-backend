const express = require("express");
const router = express.Router();
const {
    getOverview,
    getHourlyOtp,
    getFleetProductivity,
    recalculateAnalytics
} = require("../controllers/analyticsController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/overview", protect, getOverview);
router.get("/hourly-otp", protect, getHourlyOtp);
router.get("/fleet-productivity", protect, getFleetProductivity);
router.post("/recalculate", protect, authorizeRoles("admin", "supervisor", "controller"), recalculateAnalytics);

module.exports = router;
