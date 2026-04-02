const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const { applyFieldEncryption } = require('../src/utils/fieldEncryption');

describe('Field encryption middleware', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('supports promise-style save hooks without a next callback', () => {
        const schema = new mongoose.Schema({ value: String });
        const encryptDocument = sinon.stub().callsFake((target) => {
            target.value = `enc:${target.value}`;
        });
        const decryptDocument = sinon.stub().callsFake((target) => {
            target.value = String(target.value).replace(/^enc:/, '');
        });

        applyFieldEncryption(schema, {
            encryptDocument,
            decryptDocument,
            encryptUpdatePayload: (update) => update
        });

        const preSaveHook = schema.s.hooks._pres.get('save').find((entry) => entry.fn.name === 'encryptSensitiveFields');
        const postSaveHook = schema.s.hooks._posts.get('save').find((entry) => entry.fn.name === 'decryptSavedDocument');
        const document = { value: 'secret' };

        expect(() => preSaveHook.fn.call(document)).to.not.throw();
        expect(encryptDocument.calledOnceWithExactly(document)).to.equal(true);
        expect(() => postSaveHook.fn.call(document, document)).to.not.throw();
        expect(decryptDocument.calledOnceWithExactly(document)).to.equal(true);
    });

    it('supports promise-style update hooks without a next callback', () => {
        const schema = new mongoose.Schema({ value: String });
        const encryptedUpdate = {
            $set: {
                value: 'enc:secret'
            }
        };
        const encryptUpdatePayload = sinon.stub().returns(encryptedUpdate);

        applyFieldEncryption(schema, {
            encryptDocument: sinon.stub(),
            decryptDocument: sinon.stub(),
            encryptUpdatePayload
        });

        const updateHook = schema.s.hooks._pres.get('findOneAndUpdate').find((entry) => entry.fn.name === 'encryptSensitiveUpdate');
        const query = {
            getUpdate: sinon.stub().returns({
                $set: {
                    value: 'secret'
                }
            }),
            setUpdate: sinon.stub()
        };

        expect(() => updateHook.fn.call(query)).to.not.throw();
        expect(encryptUpdatePayload.calledOnce).to.equal(true);
        expect(query.setUpdate.calledOnceWithExactly(encryptedUpdate)).to.equal(true);
    });
});
