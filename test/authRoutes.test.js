const { expect } = require('chai');
const sinon = require('sinon');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const authRoutes = require('../src/routes/authRoutes');
const User = require('../src/models/User');

const getHandler = (method, path, stackIndex = 0) => {
    const layer = authRoutes.stack.find(
        (entry) =>
            entry.route &&
            entry.route.path === path &&
            entry.route.methods[method]
    );

    return layer ? layer.route.stack[stackIndex].handle : null;
};

const buildRes = () => ({
    render: sinon.stub(),
    redirect: sinon.stub(),
    status: sinon.stub().returnsThis(),
    json: sinon.stub()
});

describe('Auth Routes', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('GET /login', () => {
        it('should render the login page', () => {
            const handler = getHandler('get', '/login');

            const req = {};
            const res = buildRes();

            handler(req, res);

            expect(res.render.calledWith('pages/login', { title: 'Login', error: null })).to.be.true;
        });
    });

    describe('POST /login', () => {
        it('should render error if email is missing', () => {
            const handler = getHandler('post', '/login');

            const req = {
                body: { password: 'password123' }
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(res.render.calledWith('pages/login', {
                title: 'Login',
                error: 'Please provide both email and password'
            })).to.be.true;
        });

        it('should render error if password is missing', () => {
            const handler = getHandler('post', '/login');

            const req = {
                body: { email: 'test@example.com' }
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(res.render.calledWith('pages/login', {
                title: 'Login',
                error: 'Please provide both email and password'
            })).to.be.true;
        });

        it('should render error if email format is invalid', () => {
            const handler = getHandler('post', '/login');

            const req = {
                body: {
                    email: 'invalid-email',
                    password: 'password123'
                }
            };
            const res = buildRes();
            const next = sinon.stub();

            handler(req, res, next);

            expect(res.render.called).to.be.true;
            expect(res.render.firstCall.args[0]).to.equal('pages/login');
            expect(res.render.firstCall.args[1].error).to.include('email');
        });
    });

    describe('GET /signup', () => {
        it('should render the signup page', () => {
            const handler = getHandler('get', '/signup');

            const req = {};
            const res = buildRes();

            handler(req, res);

            expect(res.render.calledWith('pages/signup', { title: 'Sign Up', error: null })).to.be.true;
        });
    });

    describe('POST /signup', () => {
        it('should create a new user with valid data', async () => {
            const handler = getHandler('post', '/signup');

            sinon.stub(User, 'findOne').resolves(null);
            sinon.stub(User.prototype, 'save').resolves();
            sinon.stub(bcrypt, 'hash').resolves('hashedPassword123');

            const req = {
                body: {
                    email: 'newuser@example.com',
                    password: 'ValidPass123'
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(User.findOne.calledWith({ email: 'newuser@example.com' })).to.be.true;
            expect(res.redirect.calledWith('/auth/login')).to.be.true;
        });

        it('should render error if email is invalid', async () => {
            const handler = getHandler('post', '/signup');

            const req = {
                body: {
                    email: 'invalid-email',
                    password: 'ValidPass123'
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(res.render.called).to.be.true;
            expect(res.render.firstCall.args[0]).to.equal('pages/signup');
            expect(res.render.firstCall.args[1].error).to.include('email');
        });

        it('should render error if password is weak', async () => {
            const handler = getHandler('post', '/signup');

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'weak'
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(res.render.called).to.be.true;
            expect(res.render.firstCall.args[0]).to.equal('pages/signup');
            expect(res.render.firstCall.args[1].error).to.exist;
        });

        it('should render error if email is already registered', async () => {
            const handler = getHandler('post', '/signup');

            const existingUser = {
                _id: new mongoose.Types.ObjectId(),
                email: 'existing@example.com'
            };

            sinon.stub(User, 'findOne').resolves(existingUser);

            const req = {
                body: {
                    email: 'existing@example.com',
                    password: 'ValidPass123'
                }
            };
            const res = buildRes();

            await handler(req, res);

            expect(res.render.calledWith('pages/signup', {
                title: 'Sign Up',
                error: 'This email is already registered. Please login or use a different email.'
            })).to.be.true;
        });
    });

    describe('POST /logout', () => {
        it('should logout and redirect to login', () => {
            const handler = getHandler('post', '/logout');

            const req = {
                logout: sinon.stub().callsFake((callback) => callback(null))
            };
            const res = buildRes();

            handler(req, res);

            expect(req.logout.called).to.be.true;
            expect(res.redirect.calledWith('/auth/login')).to.be.true;
        });

        it('should return 500 if logout fails', () => {
            const handler = getHandler('post', '/logout');

            const req = {
                logout: sinon.stub().callsFake((callback) => callback(new Error('Logout error')))
            };
            const res = buildRes();

            handler(req, res);

            expect(res.status.calledWith(500)).to.be.true;
            expect(res.json.calledWith({ error: 'Logout failed' })).to.be.true;
        });
    });

    describe('GET /logout', () => {
        it('should logout and redirect to login', () => {
            const handler = getHandler('get', '/logout');

            const req = {
                logout: sinon.stub().callsFake((callback) => callback(null))
            };
            const res = buildRes();

            handler(req, res);

            expect(req.logout.called).to.be.true;
            expect(res.redirect.calledWith('/auth/login')).to.be.true;
        });

        it('should return 500 if logout fails', () => {
            const handler = getHandler('get', '/logout');

            const req = {
                logout: sinon.stub().callsFake((callback) => callback(new Error('Logout error')))
            };
            const res = buildRes();

            handler(req, res);

            expect(res.status.calledWith(500)).to.be.true;
            expect(res.json.calledWith({ error: 'Logout failed' })).to.be.true;
        });
    });
});
