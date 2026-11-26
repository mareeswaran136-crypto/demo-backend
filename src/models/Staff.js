const mongoose = require("mongoose");

const CREW_ROLES = ["Captain", "First Officer", "Cabin Senior", "Cabin Crew", "Operations"];
const DUTY_STATUSES = ["On Duty", "Standby", "Rest Period"];

const staffSchema = new mongoose.Schema(
    {
        staffId: {
            type: String,
            required: [true, "Staff ID is required"],
            unique: true,
            trim: true,
            uppercase: true
        },
        crewId: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            uppercase: true
        },
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true
        },
        avatarUrl: {
            type: String,
            default: "",
            trim: true
        },
        officialEmail: {
            type: String,
            required: [true, "Official email is required"],
            unique: true,
            lowercase: true,
            trim: true
        },
        phone: {
            type: String,
            default: "",
            trim: true
        },
        passwordHash: {
            type: String,
            required: [true, "Password hash is required"],
            select: false
        },
        department: {
            type: String,
            required: [true, "Operational department is required"],
            trim: true
        },
        badgeId: {
            type: String,
            required: [true, "Badge ID is required"],
            unique: true,
            trim: true,
            uppercase: true
        },
        designation: {
            type: String,
            required: [true, "Designation is required"],
            trim: true,
            default: "Operations Controller"
        },
        crewRole: {
            type: String,
            enum: CREW_ROLES,
            default: "Operations"
        },
        subRole: {
            type: String,
            default: "",
            trim: true
        },
        aircraftType: {
            type: String,
            default: "Boeing 787-9",
            trim: true
        },
        assignedFlight: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Flight",
            default: null
        },
        dutyStatus: {
            type: String,
            enum: DUTY_STATUSES,
            default: "Standby"
        },
        availability: {
            status: { type: String, default: "Available" },
            remainingDutyHours: { type: Number, default: 12 },
            nextAvailableTime: { type: Date, default: null }
        },
        flightHoursLogged: {
            type: Number,
            default: 0
        },
        certifications: {
            type: [String],
            default: []
        },
        clearanceLevel: {
            type: String,
            required: [true, "Clearance level is required"],
            trim: true,
            default: "Level 3 - OCC"
        },
        operationalShift: {
            type: String,
            required: [true, "Operational shift is required"],
            trim: true
        },
        role: {
            type: String,
            enum: ["admin", "controller", "supervisor", "staff"],
            default: "controller"
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        collection: "staff"
    }
);

staffSchema.index({ crewRole: 1 });
staffSchema.index({ dutyStatus: 1 });

module.exports = mongoose.model("Staff", staffSchema);
module.exports.CREW_ROLES = CREW_ROLES;
module.exports.DUTY_STATUSES = DUTY_STATUSES;
