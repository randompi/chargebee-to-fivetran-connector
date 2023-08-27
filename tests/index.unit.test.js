const assert = require('assert');
const sinon = require('sinon');

describe('fetchChargeBee', () => {

    const {fetchChargeBee} = require('..');

    it('fetchChargeBee should call json', () => {
        // Mock parameters
        const req = {
            query: {},
            body: {}
        };
        const res = {json: sinon.stub()};

        // TODO: need to figure out how to stub SecretManagerServiceClient

        // Call tested function
        fetchChargeBee(req, res);

        // Verify behavior of tested function
        // assert.ok(res.json.calledOnce);
    });
})