const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oidc');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { getConfiguredAppBaseUrl, hasGoogleAuthCredentials } = require('./runtimeConfig');

module.exports = function (passport) {
    passport.use(new LocalStrategy({
        usernameField: 'email'
    }, async (email, password, done) => {
        try {
            // Get the user from the database
            const user = await User.findOne({ email: email });

            if (!user) {
                return done(null, false, { message: 'Invalid credentials.' });
            }

            // Google-only accounts do not have a local password hash.
            if (user.googleId && typeof user.password !== 'string') {
                return done(null, false, { message: 'Invalid credentials.' });
            }

            if (typeof user.password !== 'string' || user.password.length === 0) {
                return done(null, false, { message: 'Invalid credentials.' });
            }

            // Compare passwords after confirming a valid local hash exists.
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return done(null, false, { message: 'Invalid credentials.' });
            }

            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }));

    if (hasGoogleAuthCredentials()) {
        const googleCallbackPath = '/auth/oauth2/redirect/google';
        const configuredAppBaseUrl = getConfiguredAppBaseUrl();

        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: configuredAppBaseUrl
                ? `${configuredAppBaseUrl}${googleCallbackPath}`
                : googleCallbackPath,
            scope: ['profile', 'email']
        }, async (issuer, profile, cb) => {
            try {
                // Check if user already exists with Google ID
                let user = await User.findOne({ googleId: profile.id });
                if (user) {
                    return cb(null, user);
                }

                // Check if user exists with email (link account)
                // Note: passport-google-oidc usually provides email in profile.emails
                let email = null;
                if (profile.emails && profile.emails.length > 0) {
                    email = profile.emails[0].value;
                }

                if (email) {
                    user = await User.findOne({ email: email });
                    if (user) {
                        user.googleId = profile.id;
                        await user.save();
                        return cb(null, user);
                    }
                }

                // Create new google user
                const newUser = new User({
                    googleId: profile.id,
                    name: profile.displayName,
                    email: email
                });

                await newUser.save();
                return cb(null, newUser);

            } catch (err) {
                return cb(err);
            }
        }));
    }

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
