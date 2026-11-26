const express = require("express");
const router = express.Router();
const { getOverview, getKpis, getOperations } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

router.get("/overview", protect, getOverview);
router.get("/kpis", protect, getKpis);
router.get("/operations", protect, getOperations);

module.exports = router;
