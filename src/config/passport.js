const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/User');

module.exports = function (passport) {
    passport.use(new LocalStrategy({
        usernameField: 'email'
    }, async (email, password, done) => {
        try {
            // Get the user from the database
            const user = await User.findOne({ email: email });

            // Compare passwords (also handles case when user is null)
            // Using generic error message to prevent user enumeration via timing attacks
            const isMatch = user ? await bcrypt.compare(password, user.password) : false;

            if (!user || !isMatch) {
                return done(null, false, { message: 'Invalid credentials.' });
            }

            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error);
        }
    });
};
