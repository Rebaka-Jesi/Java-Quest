// server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// You MUST change this to a strong, random string in a real application
const SECRET_KEY = 'your_super_secret_key_here';

// Use middleware for parsing JSON, handling CORS, and serving files
app.use(cors());
app.use(bodyParser.json());

// In-memory 'database' for demonstration. In a real app, use a proper database.
const users = {};
const userProgress = {};

// --- Helper Functions ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Authentication token is required.' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error('JWT verification failed:', err.message);
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

// --- API Endpoints ---

// User Signup
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.status(409).json({ message: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    users[username] = { password: hashedPassword };
    userProgress[username] = { completedModules: 0, phaseProgress: {} };
    console.log(`✅ New user signed up: ${username}`);
    res.status(201).json({ message: 'User created successfully' });
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }
    const token = jwt.sign({ username: username }, SECRET_KEY);
    console.log(`➡️ User logged in: ${username}`);
    res.json({ token, username });
});

// Save User Progress (Protected Route)
app.post('/api/progress/save', authenticateToken, (req, res) => {
    const { username } = req.user;
    const { progress } = req.body;
    userProgress[username] = progress;
    console.log(`💾 Progress saved for ${username}. Completed modules: ${Object.keys(progress.phaseProgress).length}`);
    res.status(200).json({ message: 'Progress saved successfully' });
});

// Load User Progress (Protected Route)
app.get('/api/progress/load', authenticateToken, (req, res) => {
    const { username } = req.user;
    const progress = userProgress[username] || { completedModules: 0, phaseProgress: {} };
    console.log(`➡️ Progress loaded for ${username}. Completed modules: ${Object.keys(progress.phaseProgress).length}`);
    res.status(200).json({ progress });
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for all other GET requests to serve the main HTML file
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});