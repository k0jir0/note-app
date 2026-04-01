const { expect } = require('chai');

const {
    applyMongooseInjectionDefaults,
    buildMongooseInjectionPosture,
    findUnsafeObjectKeys,
    inspectRequestInput
} = require('../src/services/injectionPreventionService');

describe('Injection prevention service', () => {
    it('detects unsafe operator and dotted keys recursively', () => {
        const findings = findUnsafeObjectKeys({
            filter: {
                $ne: null
            },
            nested: [
                {
                    profile: {
                        'access.level': 'admin'
                    }
                }
            ]
        });

        expect(findings).to.deep.include({
            path: 'filter.$ne',
            key: '$ne',
            reason: 'Keys starting with "$" can be interpreted as query or update operators.'
        });
        expect(findings).to.deep.include({
            path: 'nested[0].profile.access.level',
            key: 'access.level',
            reason: 'Keys containing "." can target nested document paths and bypass strict field intent.'
        });
    });

    it('allows request input that contains only scalar values', () => {
        const inspection = inspectRequestInput({
            body: {
                title: 'Mission note',
                content: 'Safe content'
            },
            query: {
                page: '1'
            },
            params: {
                id: '507f1f77bcf86cd799439011'
            }
        });

        expect(inspection.blocked).to.equal(false);
        expect(inspection.findings).to.deep.equal([]);
    });

    it('applies and reports mongoose injection-hardening defaults', () => {
        const state = {};
        const fakeMongoose = {
            set(key, value) {
                state[key] = value;
            },
            get(key) {
                return state[key];
            }
        };

        const defaults = applyMongooseInjectionDefaults(fakeMongoose);
        const posture = buildMongooseInjectionPosture(fakeMongoose);

        expect(defaults).to.deep.equal({
            sanitizeFilter: true,
            strictQuery: true
        });
        expect(posture).to.deep.equal({
            orm: 'Mongoose',
            sanitizeFilter: true,
            strictQuery: true
        });
    });
});
