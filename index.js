
// Import the Secret Manager client and instantiate it:
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();
const CB_SITE_US = 'chargebee-site-us';
const CB_API_KEY_US = 'chargebee-api-key-us';
const CB_SITE_EU = 'chargebee-site-eu';
const CB_API_KEY_EU = 'chargebee-api-key-eu';
const SECRET_NAMES = [
    CB_SITE_US,
    CB_API_KEY_US,
    CB_SITE_EU,
    CB_API_KEY_EU,
];

const chargebee = require('chargebee');

async function fetchSecrets() {
    const parent_project = 'projects/atlas-one-company-os';

    var secrets = {}
    for (secret_name of SECRET_NAMES) {
        const full_name = `${parent_project}/secrets/${secret_name}/versions/latest`;
        const[version] = await client.accessSecretVersion({
            name: full_name,
        });
        secrets[secret_name] = version.payload.data.toString();
    }

    return secrets;
}

exports.fetchChargeBee = async (req, res) => {

    secrets = await fetchSecrets();

    chargebee.configure({
        site: secrets[CB_SITE_US],
        api_key: secrets[CB_API_KEY_US]
    })

    aggregated_result = {}

    await chargebee.transaction.list({
        limit: 2,
        "status[is]": "success",
        "sort_by[asc]": "date"
    }).request(function (error, result) {
        if (error) {
            //handle error
            console.log(error);
        } else {
            // console.log("####### Transactions:");
            aggregated_result['transacations'] = result
            for (var i = 0; i < result.list.length; i++) {
                var entry = result.list[i]
                // console.log(entry);
                var transaction = entry.transaction;
            }
            // console.log("End Transactions ----------");
        }
    });

    await chargebee.customer.list({
        limit: 2
    }).request(function (error, result) {
        if (error) {
            //handle error
            console.log(error);
        } else {
            // console.log("###### Customers:");
            aggregated_result['customers'] = result
            for (var i = 0; i < result.list.length; i++) {
                var entry = result.list[i]
                // console.log(entry);
                var customer = entry.customer;
                var card = entry.card;
            }
            // console.log("End Customers --------");
        }
    });

    await chargebee.subscription.list({
        limit: 2
    }).request(function (error, result) {
        if (error) {
            //handle error
            console.log(error);
        } else {
            // console.log("###### Subscriptions:");
            aggregated_result['subscriptions'] = result
            for (var i = 0; i < result.list.length; i++) {
                var entry = result.list[i]
                // console.log(entry);
            }
            // console.log("End Subscriptions --------");
        }
    });

    return res.json(aggregated_result);
};