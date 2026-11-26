const Staff = require("../models/Staff");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const sanitizeStaff = (staff) => ({
    id: staff._id,
    staffId: staff.staffId,
    fullName: staff.fullName,
    officialEmail: staff.officialEmail,
    department: staff.department,
    badgeId: staff.badgeId,
    designation: staff.designation,
    clearanceLevel: staff.clearanceLevel,
    operationalShift: staff.operationalShift,
    role: staff.role,
    isActive: staff.isActive,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt
});

// GET /api/staff/profile
exports.getProfile = async (req, res) => {
    return res.status(200).json({
        staff: sanitizeStaff(req.staff)
    });
};

// GET /api/staff/crew
exports.getCrew = async (req, res) => {
    try {
        const crew = await Staff.find({ isActive: true })
            .select("staffId fullName officialEmail department badgeId designation operationalShift role")
            .sort({ fullName: 1 });

        return res.status(200).json({
            count: crew.length,
            crew
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch crew members.",
            error: error.message
        });
    }
};

// GET /api/staff
exports.getAllStaff = async (req, res) => {
    try {
        const { department, role, isActive, search } = req.query;
        const filter = {};

        if (department) filter.department = new RegExp(`^${department.trim()}$`, "i");
        if (role) filter.role = role.trim().toLowerCase();
        if (isActive !== undefined) filter.isActive = isActive === "true";
        if (search) {
            const regex = new RegExp(search.trim(), "i");
            filter.$or = [
                { fullName: regex },
                { officialEmail: regex },
                { staffId: regex },
                { badgeId: regex },
                { department: regex }
            ];
        }

        const staffList = await Staff.find(filter).sort({ createdAt: -1 });
        return res.status(200).json({
            count: staffList.length,
            staff: staffList.map(sanitizeStaff)
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch staff records.",
            error: error.message
        });
    }
};

// GET /api/staff/:id
exports.getStaffById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = mongoose.Types.ObjectId.isValid(id)
            ? { _id: id }
            : { staffId: id.toUpperCase() };

        const staff = await Staff.findOne(query);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found." });
        }

        return res.status(200).json({ staff: sanitizeStaff(staff) });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to fetch staff member.",
            error: error.message
        });
    }
};

// POST /api/staff
exports.createStaff = async (req, res) => {
    try {
        const {
            staffId,
            fullName,
            officialEmail,
            password,
            passcode,
            department,
            badgeId,
            designation,
            clearanceLevel,
            operationalShift,
            role,
            isActive
        } = req.body;

        const rawPassword = passcode || password;
        if (
            !staffId ||
            !fullName ||
            !officialEmail ||
            !rawPassword ||
            !department ||
            !badgeId ||
            !operationalShift
        ) {
            return res.status(400).json({
                message:
                    "staffId, fullName, officialEmail, password/passcode, department, badgeId, and operationalShift are required."
            });
        }

        const existing = await Staff.findOne({
            $or: [
                { officialEmail: officialEmail.toLowerCase().trim() },
                { staffId: staffId.toUpperCase().trim() },
                { badgeId: badgeId.toUpperCase().trim() }
            ]
        });

        if (existing) {
            return res.status(409).json({
                message: "Staff member with this email, staffId, or badgeId already exists."
            });
        }

        const passwordHash = await bcrypt.hash(rawPassword, 10);

        const staff = await Staff.create({
            staffId,
            fullName,
            officialEmail,
            passwordHash,
            department,
            badgeId,
            designation,
            clearanceLevel,
            operationalShift,
            role,
            isActive
        });

        return res.status(201).json({
            message: "Staff member created successfully.",
            staff: sanitizeStaff(staff)
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to create staff member.",
            error: error.message
        });
    }
};

// PUT /api/staff/:id
exports.updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const query = mongoose.Types.ObjectId.isValid(id)
            ? { _id: id }
            : { staffId: id.toUpperCase() };

        const staff = await Staff.findOne(query);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found." });
        }

        const updatableFields = [
            "fullName",
            "officialEmail",
            "department",
            "badgeId",
            "designation",
            "clearanceLevel",
            "operationalShift",
            "role",
            "isActive"
        ];

        for (const field of updatableFields) {
            if (req.body[field] !== undefined) {
                staff[field] = req.body[field];
            }
        }

        const rawPassword = req.body.passcode || req.body.password;
        if (rawPassword) {
            staff.passwordHash = await bcrypt.hash(rawPassword, 10);
        }

        await staff.save();

        return res.status(200).json({
            message: "Staff member updated successfully.",
            staff: sanitizeStaff(staff)
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to update staff member.",
            error: error.message
        });
    }
};

// DELETE /api/staff/:id
exports.deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const query = mongoose.Types.ObjectId.isValid(id)
            ? { _id: id }
            : { staffId: id.toUpperCase() };

        const staff = await Staff.findOneAndDelete(query);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found." });
        }

        return res.status(200).json({
            message: "Staff member deleted successfully."
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to delete staff member.",
            error: error.message
        });
    }
};
