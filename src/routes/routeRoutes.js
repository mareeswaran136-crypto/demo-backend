const express = require("express");
const router = express.Router();
const { getRoutes, getRouteById, updateRoute } = require("../controllers/routeController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", protect, getRoutes);
router.get("/:id", protect, getRouteById);
router.put("/:id", protect, authorizeRoles("admin", "supervisor", "controller"), updateRoute);

module.exports = router;
