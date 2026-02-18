const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');

const noteApiRoute = require('./src/routes/noteApiRoutes');
const notePageRoute = require('./src/routes/notePageRoutes');
const authRoutes = require('./src/routes/authRoutes');
const { requireAuth } = require('./src/middleware/auth');

require('./src/config/passport')(passport);
require('dotenv').config();
const app = express();

// Model layer
const dbURI = process.env.MONGODB_URI;
if (!dbURI) {
    console.error('ERROR: MONGODB_URI is not defined in environment variables');
    process.exit(1);
}
mongoose.connect(dbURI)
    .then(() => {
        console.log('MongoDB connected successfully');
    }).catch((err) => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src', 'views', 'public')));

// Session configuration
const SESSION_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours in milliseconds

const sessionSecret = process.env.SESSION_SECRET || 'YourSecretKeyHere';
if (sessionSecret === 'YourSecretKeyHere' && process.env.NODE_ENV === 'production') {
    console.error('WARNING: Using default SESSION_SECRET in production is insecure!');
    process.exit(1);
}

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: SESSION_COOKIE_MAX_AGE,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevents client-side JavaScript access
        sameSite: 'lax' // CSRF protection
    }
}));

// Passport middleware (must come after session)
app.use(passport.initialize());
app.use(passport.session());

// Make user available in all views
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// Authentication routes (must be before requireAuth middleware)
app.use('/auth', authRoutes);

// Redirect home to notes page
app.get('/', requireAuth, (req, res) => {
    res.redirect('/notes');
});

// Seed route - DEVELOPMENT ONLY - requires authentication
// WARNING: This route deletes all data! Only enabled in non-production environments.
if (process.env.NODE_ENV !== 'production') {
    app.get('/seed', requireAuth, async (req, res) => {
        const User = require('./src/models/User');
        const Notes = require('./src/models/Notes');
        const bcrypt = require('bcrypt');

        try {
            // Clear existing data
            await Notes.deleteMany({});
            await User.deleteMany({});

            // Create a test user
            const hashedPassword = await bcrypt.hash('password123', 10);
            const testUser = await User.create({
                email: 'test@example.com',
                password: hashedPassword
            });

            // Create sample notes for the test user
            await Notes.create([
                {
                    title: 'Meeting Notes',
                    content: 'Discussed Q1 goals and upcoming project deadlines. Action items: Review budget, Schedule team meeting.',
                    image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=600',
                    user: testUser._id
                },
                {
                    title: 'Shopping List',
                    content: 'Milk, Eggs, Bread, Butter, Coffee, Fresh vegetables',
                    image: '',
                    user: testUser._id
                },
                {
                    title: 'Book Ideas',
                    content: 'Research topics for new project: Machine Learning basics, Web Development trends, Design patterns',
                    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600',
                    user: testUser._id
                }
            ]);

            res.send('Database seeded! Test user created: test@example.com / password123');
        } catch (error) {
            res.status(500).send('Error seeding database: ' + error.message);
        }
    });
}

app.use(noteApiRoute);
app.use(notePageRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

