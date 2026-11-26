const express = require("express");
const router = express.Router();

const {
    getProfile,
    getCrew,
    getAllStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff
} = require("../controllers/staffController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/profile", protect, getProfile);
router.get("/crew", protect, getCrew);
router.get("/", protect, getAllStaff);
router.get("/:id", protect, getStaffById);
router.post("/", protect, authorizeRoles("admin", "supervisor"), createStaff);
router.put("/:id", protect, authorizeRoles("admin", "supervisor"), updateStaff);
router.delete("/:id", protect, authorizeRoles("admin"), deleteStaff);

module.exports = router;
