const express = require("express"); 
const cors = require("cors"); 
require("dotenv").config(); 
const connectDB = require("./config/db");
connectDB();
const authRoutes = require("./routes/authRoutes");

const authMiddleware = require("./middleware/authMiddleware");

const app = express(); 

app.use(cors()); 
app.use(express.json()); 
app.use("/api/auth", authRoutes);


app.get("/", (req, res) => { 
    res.send("Node.js Server Running Successfully!"); 
}); 

const PORT = process.env.PORT || 5000; 
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`); 
});