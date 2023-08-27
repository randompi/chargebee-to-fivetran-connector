const assert = require('assert');
const {exec} = require('child_process');
const {request} = require('gaxios');
const waitPort = require('wait-port');

const PORT = process.env.PORT || 8080;
const BASE_URL = `http://localhost:${PORT}`;

describe('functions_fetchChargeBee HTTP integration test', () => {
  // [START functions_http_integration_test]
  let ffProc;

  // Run the functions-framework instance to host functions locally
  before(async () => {
    ffProc = exec(
      `npx functions-framework --target=fetchChargeBee --signature-type=http --port ${PORT}`
    );
    await waitPort({host: 'localhost', port: PORT});
  });

  after(() => ffProc.kill());

  it('fetchChargeBee: initial state should fetch earliest data', async () => {

    // from: https://fivetran.com/docs/functions#examplerequest
    const data_payload = {
        "agent" : "<function_connector_name>/<external_id>/<schema>",
        "state": {},
        "secrets": {}
    }

    const response = await request({
      url: `${BASE_URL}/fetchChargeBee`,
      method: 'POST',
      data: data_payload,
    });

    console.log('response data', response.data)

    assert.strictEqual(response.status, 200);

    assert.ok(response.data.hasOwnProperty('transactions'));
  });
  // END it('fetchChargeBee: initial state should fetch earliest data'


});