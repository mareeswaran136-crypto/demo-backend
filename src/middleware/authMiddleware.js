const jwt = require("jsonwebtoken");
const Staff = require("../models/Staff");

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Access denied. Authorization token required."
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const staff = await Staff.findById(decoded.id);

        if (!staff) {
            return res.status(401).json({
                message: "Invalid token. Staff account not found."
            });
        }

        if (!staff.isActive) {
            return res.status(403).json({
                message: "Account is deactivated. Contact OCC Administrator."
            });
        }

        req.staff = staff;
        req.user = staff;
        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token."
        });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.staff || !roles.includes(req.staff.role)) {
            return res.status(403).json({
                message: "Forbidden. Insufficient role clearance."
            });
        }
        next();
    };
};

const authorizeDepartments = (...departments) => {
    const allowed = departments.map((d) => d.toLowerCase());
    return (req, res, next) => {
        if (
            !req.staff ||
            !allowed.includes(req.staff.department.toLowerCase())
        ) {
            return res.status(403).json({
                message: "Forbidden. Department access restricted."
            });
        }
        next();
    };
};

module.exports = {
    protect,
    authorizeRoles,
    authorizeDepartments
};
