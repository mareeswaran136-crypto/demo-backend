require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Staff = require("../models/Staff");

const seedStaff = async () => {
    const rawPassword = process.env.SEED_STAFF_PASSWORD;
    if (!rawPassword) {
        console.error("SEED_STAFF_PASSWORD environment variable is required.");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const accounts = [
        {
            staffId: "SVR-OCC-001",
            fullName: "Capt. Rajesh Varma",
            officialEmail: "rajesh.varma@savera.aero",
            passwordHash,
            department: "OCC",
            badgeId: "SVR-OCC-001",
            designation: "Chief OCC Controller",
            clearanceLevel: "Level 4 - Executive OCC",
            operationalShift: "Day Shift (06:00 - 18:00 IST)",
            role: "admin",
            isActive: true
        },
        {
            staffId: "SVR-OCC-002",
            fullName: "Meera Nair",
            officialEmail: "meera.nair@savera.aero",
            passwordHash,
            department: "Flight Operations",
            badgeId: "SVR-OCC-002",
            designation: "Senior Flight Dispatcher",
            clearanceLevel: "Level 3 - OCC",
            operationalShift: "Night Shift (18:00 - 06:00 IST)",
            role: "controller",
            isActive: true
        }
    ];

    for (const account of accounts) {
        await Staff.findOneAndUpdate(
            { officialEmail: account.officialEmail },
            { $set: account },
            { upsert: true, new: true, runValidators: true }
        );
        console.log(`Seeded staff: ${account.fullName} (${account.officialEmail})`);
    }

    await mongoose.disconnect();
    console.log("Seed completed.");
};

seedStaff().catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
});
