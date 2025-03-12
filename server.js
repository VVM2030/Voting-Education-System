const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { getMaxListeners } = require("nodemailer/lib/xoauth2");
require("dotenv").config();

const app = express();
const port = 3001;

mongoose
  .connect("mongodb+srv://votingverficationmachine:VVMvoting2030@cluster0.nr8cn.mongodb.net/VVMWebsite",{ serverSelectionTimeoutMS: 5000,socketTimeoutMS: 45000,})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const OtpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 }, 
});

const RegistereduserSchema = new mongoose.Schema({
  registerNumber: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  department: { type: String, required: true },
  batchYear: { type: String, required: true },
  year: { type: String, required: true },
  shift: { type: String, required: true },
  otp: { type: Number, required: true },
  hasVoted: { type: Boolean, default: false }, 
  verified: { type: Boolean, default: false },
});

const candidateSchema = new mongoose.Schema({
    name: String,
    department: String,
    year: Number,
    shift: Number,
    college: String,
    position: String,
    votes: { type: Number, default: 0 }
});

const votingSchema = new mongoose.Schema({
    registerNumber: String,
    department: String,
    year: String,
    shift: String,
    candidateId: String,
    timestamp: { type: Date, default: Date.now }
});

const phaseSchema = new mongoose.Schema({
  currentPhase: { type: String, required: true, enum: ["registration", "voting", "result"], default: "registration" }
});

const academicYearSchema = new mongoose.Schema({
  year: String,
});

const User = mongoose.model("User", UserSchema);
const Otp = mongoose.model("Otp", OtpSchema);
const Registereduser = mongoose.model("RegisterUser", RegistereduserSchema);
const Candidate = mongoose.model('Candidate', candidateSchema);
const voting = mongoose.model("Voting", votingSchema);
const Phase = mongoose.model("Phase", phaseSchema);
const AcademicYear = mongoose.model("AcademicYear", academicYearSchema);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "vvmvotingwebsite@gmail.com",
    pass: "aozl eszz gzym qvxw",
  },
  debug: true,
  logger: true, 
});


app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use. Please log in." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully." });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "An error occurred while registering the user." });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please enter both email and password." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found. Please sign up." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password. Please try again." });
    }

    res.status(200).json({ message: "Login successful." });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "An error occurred during login." });
  }
});

app.post("/register", async (req, res) => {
  const { registerNumber, email, department, batchYear, year, shift } = req.body;

  const registerRegex = /^\d{10}$/; 
  const validDepartments = ["BCA", "BSC", "BCOM", "BCOM(CA)", "BCOM(CS)", "VISCOM", "TAMIL", "ENGLISH"];
  const validYears = ["1", "2", "3"]; 
  const validShifts = ["1", "2"]; 

  try {
    const academicYearRecord = await AcademicYear.findOne({});

    if (!academicYearRecord || !academicYearRecord.year) {
      return res.status(400).json({ success: false, message: "Academic year not set. Please contact the admin." });
    }

    const academicYear = academicYearRecord.year; 

    // Validate academic year format
    const yearRange = academicYear.split(" to ").map(Number);
    if (yearRange.length !== 2 || isNaN(yearRange[0]) || isNaN(yearRange[1])) {
      return res.status(500).json({ success: false, message: "Invalid academic year format." });
    }

    const [startYear, endYear] = yearRange;
    const validBatchYears = Array.from({ length: endYear - startYear + 1 }, (_, i) => (startYear + i).toString());

    if (!registerRegex.test(registerNumber)) {
      return res.status(400).json({ success: false, message: "Invalid register number format. Must be 10 digits." });
    }

    if (!validDepartments.includes(department)) {
      return res.status(400).json({ success: false, message: "Invalid department selected." });
    }

    if (!validBatchYears.includes(batchYear)) {
      return res.status(400).json({ success: false, message: "Invalid batch year." });
    }

    if (!validYears.includes(year)) {
      return res.status(400).json({ success: false, message: "Invalid year selection." }); 
    }

    if (!validShifts.includes(shift)) {
      return res.status(400).json({ success: false, message: "Invalid shift selection." });
    }

    const existingUser = await Registereduser.findOne({ registerNumber });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Register Number already registered." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    await Otp.findOneAndUpdate(
      { email },
      { otp, createdAt: new Date() },
      { upsert: true }
    );

    const newRegistereduser = new Registereduser({
      registerNumber,
      email,
      department,
      batchYear,
      year,
      shift,
      otp, 
      verified: false,
    });

    await newRegistereduser.save();

    const mailOptions = {
      from: "vvmvotingwebsite@gmail.com",
      to: email,
      subject: "OTP Verification",
      text: `Your OTP for voter registration is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Registration successful! OTP sent to your email." });

  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});


app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  const otpRecord = await Otp.findOne({ email });
  if (!otpRecord) {
    return res.status(400).json({ message: "Invalid email or OTP expired." });
  }

  if (otpRecord.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP." });
  }

  await Registereduser.updateOne({ email }, { verified: true });

  return res.status(200).json({ success: true, message: "User registered successfully." });
});

app.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000);

    await Otp.findOneAndUpdate(
      { email },
      { otp: newOtp, createdAt: Date.now() },
      { upsert: true }
    );

    const mailOptions = {
      from: "vvmvotingwebsite@gmail.com",
      to: email,
      subject: 'New OTP for Verification',
      text: `Your new OTP is: ${newOtp}. It is valid for 1 minute.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'OTP resent successfully.' });
  } catch (error) {
    console.error('Error in resending OTP:', error);
    res.status(500).json({ message: 'Error in resending OTP.' });
  }
});

app.post("/adlogin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (!admin || admin.password !== password) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    res.status(200).json({ message: "Login successful. Please enter your PIN." });
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).json({ message: "An error occurred during admin login." });
  }
});

let registeredUsers = []; 

app.get("/getRegisteredUsers", (req, res) => {
  res.json(registeredUsers);
});

app.post("/registerVoter", async (req, res) => {
  try {
    const { registerNumber } = req.body;

    if (!registerNumber) {
      return res.status(400).json({ success: false, message: "Register Number is required." });
    }

    // Check if the user is registered
    const registeredUser = await Registereduser.findOne({ registerNumber });

    if (!registeredUser) {
      return res.status(404).json({ success: false, message: "Register Number not found. Please register first." });
    }

    if (!registeredUser.verified) {
      return res.status(400).json({ success: false, message: "User is not verified. Please complete verification first." });
    }

    return res.status(200).json({ success: true, message: "Voter registered successfully!", verified: true });

  } catch (error) {
    console.error("Error in voter registration:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
});


app.post('/addCandidate', async (req, res) => {
  const { name, department, year, shift, college, position } = req.body;

  if (!name || !department || !college || !position || ![1, 2, 3].includes(year) || ![1, 2].includes(shift)) {
      return res.status(400).json({ message: "Invalid input data" });
  }

  try {
      const candidate = new Candidate({ name, department, year, shift, college, position });
      await candidate.save();
      res.status(201).json({ message: "Candidate added successfully!" });
  } catch (error) {
      res.status(500).json({ message: "Database error" });
  }
});

app.get('/getCandidates', async (req, res) => {
  try {
    const candidates = await Candidate.find();
    res.status(200).json(candidates);
  } catch (err) {
    res.status(500).json({ message: "Error fetching candidates", error: err });
  }
});

app.get("/api/candidate", async (req, res) => {
  try {
      const candidates = await Candidate.find();
      res.json(candidates);
  } catch (error) {
      res.status(500).json({ message: "Error fetching candidates", error });
  }
});

app.post("/api/validateUser", async (req, res) => {
  try {
      const { registerNumber, department, year, shift, candidateId } = req.body;

      const user = await Registereduser.findOne({ 
          registerNumber, 
          department: department.toUpperCase(), 
          year, 
          shift 
      });

      if (!user) {
          return res.json({ success: false, message: "Student records not found!" });
      }

      if (user.hasVoted) {
          return res.json({ success: false, message: "Student has already voted!" });
      }

      // Increment candidate votes
      const candidate = await Candidate.findByIdAndUpdate(candidateId, { $inc: { votes: 1 } }, { new: true });
      if (!candidate) {
          return res.status(400).json({ success: false, message: "Candidate not found!" });
      }

      // Mark user as voted
      user.hasVoted = true;
      await user.save();

      // Store voting record
      const newVote = new voting({ registerNumber, department, year, shift, candidateId });
      await newVote.save();

      res.json({ success: true, message: "Vote successfully submitted!" });
  } catch (error) {
      console.error("Error casting vote:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


app.get("/api/currentPhase", async (req, res) => {
  try {
    let phase = await Phase.findOne();
    if (!phase) {
      phase = await Phase.create({ currentPhase: "registration" }); // Default phase
    }
    res.json({ phase: phase.currentPhase });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.post("/api/updatePhase", async (req, res) => {
  try {
    const { newPhase } = req.body;

    if (!["registration", "voting", "result"].includes(newPhase)) {
      return res.status(400).json({ error: "Invalid phase value" });
    }

    let phase = await Phase.findOne();
    if (!phase) {
      phase = new Phase({ currentPhase: newPhase });
    } else {
      phase.currentPhase = newPhase;
    }

    await phase.save();
    res.json({ message: "Phase updated successfully!", phase: phase.currentPhase });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.post("/api/setAcademicYear", async (req, res) => {
  try {
    const { academicYear } = req.body;
    if (!academicYear) {
      return res.status(400).json({ error: "Academic year is required" });
    }

    await AcademicYear.deleteMany({});
    const newAcademicYear = new AcademicYear({ year: academicYear });
    await newAcademicYear.save();

    res.json({ message: "Academic year set successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error while setting academic year" });
  }
});

app.get("/api/getAcademicYear", async (req, res) => {
  try {
      const academicYearData = await AcademicYear.findOne({});
      if (!academicYearData) {
          return res.status(404).json({ error: "Academic year not set" });
      }
      res.json({ academicYear: academicYearData.year });
  } catch (error) {
      res.status(500).json({ error: "Server error while retrieving academic year" });
  }
});

app.get("/resultcandidates", async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ votes: -1 });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: "Error fetching results" });
  }
});


// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
