const express = require("express");
const router = express.Router();
const { getActivityLogs } = require("../controllers/operationsController");
const { protect } = require("../middleware/authMiddleware");

router.get("/activity", protect, getActivityLogs);

module.exports = router;
