const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        badgeId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        shift: {
            type: String,
            required: true,
            trim: true
        },

        role: {
            type: String,
            enum: ["admin", "user"],
            default: "admin"
        }

    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
