const express = require("express");
const router = express.Router();
const { getAircraft } = require("../controllers/operationsController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getAircraft);

module.exports = router;
