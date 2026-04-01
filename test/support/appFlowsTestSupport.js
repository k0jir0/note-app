const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const { createApp: createApplication } = require('../../src/app/createApp');
const { applyMongooseInjectionDefaults } = require('../../src/services/injectionPreventionService');
const Notes = require('../../src/models/Notes');
const SecurityAlert = require('../../src/models/SecurityAlert');
const ScanResult = require('../../src/models/ScanResult');

const TEST_USER_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

function sameValue(left, right) {
    if (left instanceof Date && right instanceof Date) {
        return left.getTime() === right.getTime();
    }

    return String(left) === String(right);
}

function isPlainObject(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function matchesQuery(document, query = {}) {
    return Object.entries(query).every(([key, expected]) => {
        if (isPlainObject(expected)) {
            return Object.entries(expected).every(([operator, value]) => {
                if (operator === '$gte') {
                    return document[key] >= value;
                }

                return false;
            });
        }

        return sameValue(document[key], expected);
    });
}

function compareValues(left, right) {
    if (left instanceof Date && right instanceof Date) {
        return left.getTime() - right.getTime();
    }

    if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
    }

    return String(left).localeCompare(String(right));
}

function setNestedValue(target, propertyPath, value) {
    const parts = String(propertyPath).split('.');
    let current = target;

    while (parts.length > 1) {
        const nextPart = parts.shift();
        if (!current[nextPart] || typeof current[nextPart] !== 'object') {
            current[nextPart] = {};
        }
        current = current[nextPart];
    }

    current[parts[0]] = value;
}

function createQuery(items) {
    let current = [...items];

    const query = {
        select() {
            return query;
        },
        sort(sortSpec = {}) {
            const entries = Object.entries(sortSpec);
            current.sort((left, right) => {
                for (const [field, direction] of entries) {
                    const delta = compareValues(left[field], right[field]);
                    if (delta !== 0) {
                        return direction < 0 ? -delta : delta;
                    }
                }

                return 0;
            });

            return query;
        },
        skip(count = 0) {
            current = current.slice(count);
            return query;
        },
        limit(count) {
            current = current.slice(0, count);
            return query;
        },
        lean() {
            return query;
        },
        then(resolve, reject) {
            return Promise.resolve(current).then(resolve, reject);
        },
        catch(reject) {
            return Promise.resolve(current).catch(reject);
        }
    };

    return query;
}

function createStores() {
    return {
        notes: [],
        alerts: [],
        scans: []
    };
}

function stubNotesModel(sandbox, stores) {
    sandbox.stub(Notes, 'countDocuments').callsFake(async (query = {}) => {
        return stores.notes.filter((note) => matchesQuery(note, query)).length;
    });

    sandbox.stub(Notes, 'find').callsFake((query = {}) => {
        return createQuery(stores.notes.filter((note) => matchesQuery(note, query)));
    });

    sandbox.stub(Notes, 'findOne').callsFake(async (query = {}) => {
        return stores.notes.find((note) => matchesQuery(note, query)) || null;
    });

    sandbox.stub(Notes, 'create').callsFake(async (payload) => {
        const now = new Date();
        const note = {
            _id: new mongoose.Types.ObjectId(),
            title: payload.title,
            content: payload.content || '',
            image: payload.image || '',
            imageAssetKey: payload.imageAssetKey || '',
            imageAssetContentType: payload.imageAssetContentType || '',
            user: payload.user,
            createdAt: now,
            updatedAt: now
        };

        stores.notes.push(note);
        return note;
    });

    sandbox.stub(Notes, 'findOneAndUpdate').callsFake(async (query = {}, update = {}) => {
        const note = stores.notes.find((entry) => matchesQuery(entry, query));
        if (!note) {
            return null;
        }

        Object.assign(note, update, { updatedAt: new Date() });
        return note;
    });

    sandbox.stub(Notes, 'findOneAndDelete').callsFake(async (query = {}) => {
        const index = stores.notes.findIndex((note) => matchesQuery(note, query));
        if (index === -1) {
            return null;
        }

        const [deleted] = stores.notes.splice(index, 1);
        return deleted;
    });
}

function stubSecurityModels(sandbox, stores) {
    sandbox.stub(SecurityAlert, 'countDocuments').callsFake(async (query = {}) => {
        return stores.alerts.filter((alert) => matchesQuery(alert, query)).length;
    });

    sandbox.stub(SecurityAlert, 'find').callsFake((query = {}) => {
        return createQuery(stores.alerts.filter((alert) => matchesQuery(alert, query)));
    });

    sandbox.stub(SecurityAlert, 'insertMany').callsFake(async (payloads = []) => {
        const created = payloads.map((payload) => ({
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...payload
        }));

        stores.alerts.push(...created);
        return created;
    });

    sandbox.stub(SecurityAlert, 'findOne').callsFake(async (query = {}) => {
        return stores.alerts.find((alert) => matchesQuery(alert, query)) || null;
    });

    sandbox.stub(SecurityAlert, 'findOneAndUpdate').callsFake(async (query = {}, update = {}) => {
        const alert = stores.alerts.find((entry) => matchesQuery(entry, query));
        if (!alert) {
            return null;
        }

        Object.entries(update).forEach(([key, value]) => {
            if (key.includes('.')) {
                setNestedValue(alert, key, value);
                return;
            }

            alert[key] = value;
        });

        alert.updatedAt = new Date();
        return alert;
    });

    sandbox.stub(SecurityAlert, 'bulkWrite').callsFake(async (operations = []) => {
        operations.forEach((operation) => {
            const updateOne = operation.updateOne || {};
            const alert = stores.alerts.find((entry) => matchesQuery(entry, updateOne.filter || {}));
            if (!alert) {
                return;
            }

            const updateDocument = updateOne.update && updateOne.update.$set
                ? updateOne.update.$set
                : (updateOne.update || {});

            Object.entries(updateDocument).forEach(([key, value]) => {
                alert[key] = value;
            });
        });

        return { modifiedCount: operations.length };
    });

    sandbox.stub(ScanResult, 'countDocuments').callsFake(async (query = {}) => {
        return stores.scans.filter((scan) => matchesQuery(scan, query)).length;
    });

    sandbox.stub(ScanResult, 'find').callsFake((query = {}) => {
        return createQuery(stores.scans.filter((scan) => matchesQuery(scan, query)));
    });

    sandbox.stub(ScanResult, 'create').callsFake(async (payload) => {
        const scan = {
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...payload
        };

        stores.scans.push(scan);
        return scan;
    });

    sandbox.stub(ScanResult, 'findOne').callsFake(async (query = {}) => {
        return stores.scans.find((scan) => matchesQuery(scan, query)) || null;
    });

    sandbox.stub(ScanResult, 'insertMany').callsFake(async (payloads = []) => {
        const created = payloads.map((payload) => ({
            _id: new mongoose.Types.ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...payload
        }));

        stores.scans.push(...created);
        return created;
    });
}

function createApp() {
    const runtimeConfig = {
        sessionManagement: {
            idleTimeoutMs: 15 * 60 * 1000,
            absoluteTimeoutMs: 8 * 60 * 60 * 1000,
            missionIdleTimeoutMs: 5 * 60 * 1000,
            missionAbsoluteTimeoutMs: 2 * 60 * 60 * 1000,
            preventConcurrentLogins: true
        },
        automation: {
            logBatch: {
                enabled: true,
                source: 'server-log-batch',
                intervalMs: 60000,
                dedupeWindowMs: 300000,
                maxReadBytes: 65536,
                filePath: 'C:\\temp\\e2e-security.log'
            },
            scanBatch: {
                enabled: true,
                source: 'scheduled-scan-import',
                intervalMs: 300000,
                dedupeWindowMs: 3600000,
                filePath: 'C:\\temp\\e2e-scan.txt'
            },
            intrusionBatch: {
                enabled: false
            }
        }
    };

    return createApplication({
        rootDir: path.join(__dirname, '../..'),
        runtimeConfig,
        mongooseLib: mongoose,
        injectionPreventionPosture: applyMongooseInjectionDefaults(mongoose),
        sessionMiddleware: session({
            secret: 'test-session-secret-that-is-long-enough',
            resave: false,
            saveUninitialized: true
        }),
        realtimeAvailable: true,
        realtimeEnabled: true,
        includeAuthRoutes: false,
        includeSettingsApiRoute: false,
        includeMetricsRoute: false,
        additionalLocals: {
            locatorRepairStorageRoot: path.join(__dirname, '../.tmp-locator-repair-runtime')
        },
        injectSessionPrincipal: (req, res, next) => {
            const authenticated = req.get('x-test-auth') === '1';
            req.isAuthenticated = () => authenticated;
            req.user = authenticated
                ? {
                    _id: TEST_USER_ID,
                    email: 'tester@example.com',
                    accessProfile: {
                        missionRole: 'analyst',
                        clearance: 'protected_b',
                        unit: 'cyber-task-force',
                        assignedMissions: ['research-workspace', 'browser-assurance'],
                        deviceTier: 'managed',
                        networkZones: ['corp'],
                        registeredHardwareToken: true,
                        hardwareTokenLabel: 'TestRigKey',
                        hardwareTokenSerial: 'CAF-TST-1000',
                        registeredPkiCertificate: true,
                        pkiCertificateSubject: 'CN=tester@example.com, OU=CAF Research',
                        pkiCertificateIssuer: 'CN=CAF Root CA',
                        breakGlassApproved: false,
                        breakGlassReason: ''
                    }
                }
                : null;
            req.logIn = (user, callback) => {
                req.user = user;
                callback(null);
            };
            req.logout = (callback) => callback(null);
            next();
        },
        registerAdditionalRoutes: (app) => {
            app.get('/__test/csrf', (req, res) => {
                res.status(200).json({ csrfToken: res.locals.csrfToken });
            });
        }
    });
}

class TestClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.cookieHeader = '';
    }

    updateCookies(response) {
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            this.cookieHeader = setCookie.split(';')[0];
        }
    }

    async request(pathname, {
        method = 'GET',
        headers = {},
        body,
        redirect = 'manual'
    } = {}) {
        const finalHeaders = { ...headers };
        if (this.cookieHeader) {
            finalHeaders.Cookie = this.cookieHeader;
        }

        const response = await fetch(`${this.baseUrl}${pathname}`, {
            method,
            headers: finalHeaders,
            body,
            redirect
        });

        this.updateCookies(response);
        return response;
    }

    async getCsrfToken() {
        const response = await this.request('/__test/csrf');
        const payload = await response.json();
        return payload.csrfToken;
    }
}

function closeServer(server) {
    return new Promise((resolve, reject) => {
        const forceCloseTimer = setTimeout(() => {
            if (typeof server.closeAllConnections === 'function') {
                server.closeAllConnections();
                return;
            }

            if (typeof server.closeIdleConnections === 'function') {
                server.closeIdleConnections();
            }
        }, 50);

        server.close((error) => {
            clearTimeout(forceCloseTimer);
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });

        if (typeof server.closeIdleConnections === 'function') {
            server.closeIdleConnections();
        }
    });
}

module.exports = {
    TEST_USER_ID,
    TestClient,
    closeServer,
    createApp,
    createStores,
    stubNotesModel,
    stubSecurityModels
};
