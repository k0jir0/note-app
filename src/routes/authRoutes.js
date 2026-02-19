const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { validateEmail, validatePassword } = require('../utils/validation');

const router = express.Router();

// GET login page
router.get('/login', (req, res) => {
    res.render('pages/login', { title: 'Login', error: null });
});

// POST login
router.post('/login', (req, res, next) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.render('pages/login', {
            title: 'Login',
            error: 'Please provide both email and password'
        });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
        return res.render('pages/login', {
            title: 'Login',
            error: emailValidation.error
        });
    }

    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.render('pages/login', {
                title: 'Login',
                error: info.message || 'Invalid email or password'
            });
        }

        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.redirect('/');
        });
    })(req, res, next);
});

// GET signup page
router.get('/signup', (req, res) => {
    res.render('pages/signup', { title: 'Sign Up', error: null });
});

// POST signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
            return res.render('pages/signup', {
                title: 'Sign Up',
                error: emailValidation.error
            });
        }

        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            return res.render('pages/signup', {
                title: 'Sign Up',
                error: passwordValidation.errors.join('. ')
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
        if (existingUser) {
            return res.render('pages/signup', {
                title: 'Sign Up',
                error: 'This email is already registered. Please login or use a different email.'
            });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const user = new User({
            email: email.trim().toLowerCase(),
            password: hashedPassword
        });

        // Save the user
        await user.save();

        // Redirect to login
        res.redirect('/auth/login');
    } catch (err) {
        // Handle validation errors from Mongoose
        if (err.name === 'ValidationError') {
            const errorMessages = Object.values(err.errors).map(e => e.message);
            return res.render('pages/signup', {
                title: 'Sign Up',
                error: errorMessages.join('. ')
            });
        }

        res.render('pages/signup', {
            title: 'Sign Up',
            error: 'An error occurred during signup. Please try again.'
        });
    }
});

// POST logout
router.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/auth/login');
    });
});

// GET logout (for convenience)
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/auth/login');
    });
});

// Google Auth
router.get('/login/federated/google', passport.authenticate('google'));

router.get('/oauth2/redirect/google', passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/auth/login'
}));

module.exports = router;
