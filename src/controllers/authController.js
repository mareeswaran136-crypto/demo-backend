const Staff = require("../models/Staff");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const department = (req.body.department || "").trim();
        const identifier = (
            req.body.identifier ||
            req.body.email ||
            req.body.officialEmail ||
            req.body.staffId ||
            ""
        ).trim();
        const passcode = req.body.passcode || req.body.password || "";
        const rememberMe = Boolean(req.body.rememberMe);

        if (!department || !identifier || !passcode) {
            return res.status(400).json({
                message:
                    "Operational Department, Staff ID or Airline Email, and Security Passcode are required."
            });
        }

        const staff = await Staff.findOne({
            $or: [
                { officialEmail: identifier.toLowerCase() },
                { staffId: identifier.toUpperCase() },
                { badgeId: identifier.toUpperCase() }
            ]
        }).select("+passwordHash");

        if (!staff) {
            return res.status(401).json({
                message: "Invalid credentials."
            });
        }

        if (!staff.isActive) {
            return res.status(403).json({
                message: "Staff account is inactive. Contact OCC Administrator."
            });
        }

        if (staff.department.toLowerCase() !== department.toLowerCase()) {
            return res.status(401).json({
                message: "Selected Operational Department does not match your staff record."
            });
        }

        const isMatch = await bcrypt.compare(passcode, staff.passwordHash);
        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid security passcode."
            });
        }

        const expiresIn = rememberMe
            ? process.env.JWT_REMEMBER_EXPIRES_IN || "7d"
            : process.env.JWT_EXPIRES_IN || "1d";

        const token = jwt.sign(
            {
                id: staff._id,
                staffId: staff.staffId,
                role: staff.role,
                department: staff.department
            },
            process.env.JWT_SECRET,
            { expiresIn }
        );

        return res.status(200).json({
            message: "OCC authorization successful.",
            token,
            expiresIn,
            rememberMe,
            staff: sanitizeStaff(staff)
        });
    } catch (error) {
        return res.status(500).json({
            message: "Authentication failed.",
            error: error.message
        });
    }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
    return res.status(200).json({
        message: "Logged out successfully."
    });
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
    return res.status(200).json({
        staff: sanitizeStaff(req.staff)
    });
};
