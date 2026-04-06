const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

const {
    DEFAULT_PRIVILEGED_ROLES,
    PRIVILEGED_USER_PROJECTION,
    buildPrivilegedAccessComparison,
    exportPrivilegedAccessReport,
    loadPreviousPrivilegedAccessReport,
    normalizePrivilegedUser,
    parseArgs,
    validateRuntimeRequirements
} = require('../scripts/export-privileged-access-report');

function createFakeUserModel(records = []) {
    const state = {
        filter: null,
        projection: null,
        sort: null,
        leanCalled: false
    };

    return {
        state,
        find(filter) {
            state.filter = filter;

            return {
                select(projection) {
                    state.projection = projection;
                    return this;
                },
                sort(sortSpec) {
                    state.sort = sortSpec;
                    return this;
                },
                lean() {
                    state.leanCalled = true;
                    return Promise.resolve(records);
                }
            };
        }
    };
}

describe('Privileged-access report export', () => {
    it('parses an optional previous report path from cli arguments', () => {
        const options = parseArgs([
            '--roles=admin,break_glass',
            '--previous-report=artifacts/itsg33/previous-report.json',
            '--output=artifacts/itsg33/current-report.json'
        ]);

        expect(options).to.deep.equal({
            outputFile: 'artifacts/itsg33/current-report.json',
            previousReportFile: 'artifacts/itsg33/previous-report.json',
            roles: ['admin', 'break_glass']
        });
    });

    it('normalizes privileged users without exposing the raw break-glass reason', () => {
        const normalizedUser = normalizePrivilegedUser({
            _id: '507f1f77bcf86cd799439011',
            email: 'operator@example.com',
            accessProfile: {
                missionRole: 'break_glass',
                breakGlassApproved: true,
                breakGlassReason: 'Emergency maintenance window',
                registeredHardwareToken: true,
                registeredPkiCertificate: false,
                mfaVerifiedAt: '2026-04-02T11:00:00.000Z',
                unit: 'ops',
                assignedMissions: ['recovery']
            },
            authenticationState: {
                lockoutUntil: '2026-04-02T13:00:00.000Z'
            },
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-04-02T11:05:00.000Z'
        }, {
            referenceTime: new Date('2026-04-02T12:00:00.000Z')
        });

        expect(normalizedUser).to.include({
            id: '507f1f77bcf86cd799439011',
            email: 'operator@example.com',
            missionRole: 'break_glass',
            breakGlassApproved: true,
            breakGlassReasonSet: true,
            hardwareTokenRegistered: true,
            pkiCertificateRegistered: false,
            lockedOut: true
        });
        expect(normalizedUser).to.not.have.property('breakGlassReason');
    });

    it('queries privileged roles and builds a summary report', async () => {
        const fakeUserModel = createFakeUserModel([
            {
                _id: '507f1f77bcf86cd799439011',
                email: 'admin@example.com',
                accessProfile: {
                    missionRole: 'admin',
                    unit: 'security',
                    assignedMissions: ['research-workspace'],
                    breakGlassApproved: false,
                    breakGlassReason: '',
                    registeredHardwareToken: true,
                    registeredPkiCertificate: true,
                    mfaVerifiedAt: '2026-04-01T09:00:00.000Z'
                },
                authenticationState: {
                    lockoutUntil: null,
                    lastSuccessfulLoginAt: '2026-04-01T10:00:00.000Z'
                },
                createdAt: '2026-01-10T00:00:00.000Z',
                updatedAt: '2026-04-01T10:01:00.000Z'
            },
            {
                _id: '507f191e810c19729de860ea',
                email: 'breakglass@example.com',
                accessProfile: {
                    missionRole: 'break_glass',
                    unit: 'ops',
                    assignedMissions: ['recovery'],
                    breakGlassApproved: true,
                    breakGlassReason: 'Quarterly drill',
                    registeredHardwareToken: false,
                    registeredPkiCertificate: true,
                    mfaVerifiedAt: null
                },
                authenticationState: {
                    lockoutUntil: '2026-04-02T13:00:00.000Z',
                    lastFailedLoginAt: '2026-04-02T11:30:00.000Z'
                },
                createdAt: '2026-02-10T00:00:00.000Z',
                updatedAt: '2026-04-02T11:31:00.000Z'
            }
        ]);

        const report = await exportPrivilegedAccessReport({
            UserModel: fakeUserModel,
            generatedAt: new Date('2026-04-02T12:00:00.000Z')
        });

        expect(fakeUserModel.state.filter).to.deep.equal({
            'accessProfile.missionRole': {
                $in: DEFAULT_PRIVILEGED_ROLES
            }
        });
        expect(fakeUserModel.state.projection).to.equal(PRIVILEGED_USER_PROJECTION);
        expect(fakeUserModel.state.sort).to.deep.equal({
            'accessProfile.missionRole': 1,
            email: 1,
            _id: 1
        });
        expect(fakeUserModel.state.leanCalled).to.equal(true);
        expect(report.summary).to.deep.equal({
            totalPrivilegedUsers: 2,
            byMissionRole: {
                admin: 1,
                break_glass: 1
            },
            lockedOutUsers: 1,
            strongFactorVerifiedUsers: 1,
            breakGlassApprovedUsers: 1,
            hardwareTokenRegisteredUsers: 1,
            pkiCertificateRegisteredUsers: 2
        });
        expect(report.users.map((user) => user.email)).to.deep.equal([
            'admin@example.com',
            'breakglass@example.com'
        ]);
    });

    it('builds a previous-period diff when a prior report is available', async () => {
        const fakeUserModel = createFakeUserModel([
            {
                _id: '507f1f77bcf86cd799439011',
                email: 'admin@example.com',
                accessProfile: {
                    missionRole: 'admin',
                    unit: 'security',
                    assignedMissions: ['research-workspace', 'audit'],
                    breakGlassApproved: false,
                    breakGlassReason: '',
                    registeredHardwareToken: true,
                    registeredPkiCertificate: true,
                    mfaVerifiedAt: '2026-04-01T09:00:00.000Z'
                },
                authenticationState: {
                    lockoutUntil: null
                }
            },
            {
                _id: '507f191e810c19729de860ea',
                email: 'breakglass@example.com',
                accessProfile: {
                    missionRole: 'break_glass',
                    unit: 'ops',
                    assignedMissions: ['recovery'],
                    breakGlassApproved: true,
                    breakGlassReason: 'Quarterly drill',
                    registeredHardwareToken: false,
                    registeredPkiCertificate: true,
                    mfaVerifiedAt: null
                },
                authenticationState: {
                    lockoutUntil: null
                }
            }
        ]);
        const previousReport = {
            generatedAt: '2026-03-02T12:00:00.000Z',
            criteria: {
                missionRoles: ['admin', 'break_glass']
            },
            users: [
                {
                    id: '507f1f77bcf86cd799439011',
                    email: 'admin@example.com',
                    missionRole: 'admin',
                    unit: 'security',
                    assignedMissions: ['research-workspace'],
                    breakGlassApproved: false,
                    breakGlassReasonSet: false,
                    hardwareTokenRegistered: true,
                    pkiCertificateRegistered: true,
                    strongFactorVerifiedAt: '2026-04-01T09:00:00.000Z',
                    lockoutUntil: null,
                    lockedOut: false
                },
                {
                    id: '111111111111111111111111',
                    email: 'legacy-admin@example.com',
                    missionRole: 'admin',
                    unit: 'legacy',
                    assignedMissions: ['legacy-mission'],
                    breakGlassApproved: false,
                    breakGlassReasonSet: false,
                    hardwareTokenRegistered: false,
                    pkiCertificateRegistered: false,
                    strongFactorVerifiedAt: null,
                    lockoutUntil: null,
                    lockedOut: false
                }
            ]
        };

        const report = await exportPrivilegedAccessReport({
            UserModel: fakeUserModel,
            previousReport,
            generatedAt: new Date('2026-04-02T12:00:00.000Z')
        });

        expect(report.comparison).to.deep.equal({
            available: true,
            reason: '',
            previousGeneratedAt: '2026-03-02T12:00:00.000Z',
            previousCriteria: {
                missionRoles: ['admin', 'break_glass']
            },
            summary: {
                previousTotalPrivilegedUsers: 2,
                currentTotalPrivilegedUsers: 2,
                addedUsers: 1,
                removedUsers: 1,
                changedUsers: 1,
                unchangedUsers: 0
            },
            byMissionRole: {
                admin: {
                    previous: 2,
                    current: 1,
                    delta: -1
                },
                break_glass: {
                    previous: 0,
                    current: 1,
                    delta: 1
                }
            },
            addedUsers: [{
                id: '507f191e810c19729de860ea',
                email: 'breakglass@example.com',
                missionRole: 'break_glass',
                unit: 'ops',
                lockedOut: false
            }],
            removedUsers: [{
                id: '111111111111111111111111',
                email: 'legacy-admin@example.com',
                missionRole: 'admin',
                unit: 'legacy',
                lockedOut: false
            }],
            changedUsers: [{
                id: '507f1f77bcf86cd799439011',
                email: 'admin@example.com',
                changedFields: ['assignedMissions'],
                before: {
                    assignedMissions: ['research-workspace']
                },
                after: {
                    assignedMissions: ['research-workspace', 'audit']
                }
            }]
        });
    });

    it('reports that comparison data is unavailable when no baseline exists', () => {
        const comparison = buildPrivilegedAccessComparison({
            currentUsers: []
        });

        expect(comparison).to.deep.equal({
            available: false,
            reason: 'No previous privileged-access report was provided.',
            previousGeneratedAt: null,
            summary: null,
            byMissionRole: null,
            addedUsers: [],
            removedUsers: [],
            changedUsers: []
        });
    });

    it('writes the report to disk when an output path is provided', async () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-privileged-report-'));
        const outputFile = path.join(tempDirectory, 'artifacts', 'privileged-access.json');
        const fakeUserModel = createFakeUserModel([]);

        await exportPrivilegedAccessReport({
            UserModel: fakeUserModel,
            outputFile,
            generatedAt: new Date('2026-04-02T12:00:00.000Z')
        });

        const persisted = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        expect(persisted.summary.totalPrivilegedUsers).to.equal(0);
    });

    it('loads a previous report from disk', () => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'helios-privileged-baseline-'));
        const reportPath = path.join(tempDirectory, 'previous-report.json');

        fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: '2026-03-01T00:00:00.000Z' }, null, 2), 'utf8');

        expect(loadPreviousPrivilegedAccessReport(reportPath)).to.deep.equal({
            generatedAt: '2026-03-01T00:00:00.000Z'
        });
    });

    it('requires the Mongo URI and note encryption key for runtime execution', () => {
        expect(() => validateRuntimeRequirements({})).to.throw(
            'Missing required environment values for privileged-access export: MONGODB_URI, NOTE_ENCRYPTION_KEY'
        );
    });
});
