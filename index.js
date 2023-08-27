
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

async function fetchResource(chargebee_resource, site, api_key, updated_before_time, updated_after_time) {
    chargebee.configure({
        site: secrets[site],
        api_key: secrets[api_key]
    })
    let params = {
        limit: 100,
        "sort_by[asc]": "updated_at",
    }
    if (updated_before_time != null) {
        params["updated_at[before]"] = updated_before_time;
    }
    if (updated_after_time != null) {
        params["updated_at[after]"] = updated_after_time;
    }
    
    let responses = [];
    let page = 0;
    let next_offset = null
    do {
        if (next_offset) {
            params.offset = next_offset
        }
        console.log(`GET ${site} ${chargebee_resource.name}`, params);
        let response = await chargebee_resource.list(params).request(function (error, result) {
            if (error) {
                //handle error
                console.log(error);
            } else {
                console.log(`Fetched Page #${page} of ${site} ${chargebee_resource.name}`)
            }
        });
        if("next_offset" in response) {
            console.log(`${next_offset} =?= ${response.next_offset}`)
            if (next_offset == response.next_offset) {
                // the same offset was returned last time so set it to null
                // otherwise we endlessly loop trying to get the next offset page
                next_offset = null;
            } else {
                next_offset = response.next_offset;
            }
        } else {
            next_offset = null;
        }
        responses.push(response);
        page = page + 1;
    } while (next_offset != null && page < 10);
    return responses;
}

exports.fetchChargeBee = async (req, res) => {

    secrets = await fetchSecrets();

    // check to see if there is state from the prior call passed in
    // see: https://apidocs.chargebee.com/docs/api?prod_cat_ver=2#pagination
    // on the initial sync we want to pull all data up through today
    // ChargeBee works with timestamps in seconds since UTC
    current_time = Math.floor(Date.now() / 1000);
    console.log(`current_time: `, current_time);
    let after_time = null;
    if ("state" in req.body && "last_synced_time" in req.body.state) {
        // for subsequent syncs, we only want to pull data since last sync up through today
        const SECS_PER_MINUTE = 60;
        const durationInMinutes = 5;
        last_synced_time = req.body.state.last_synced_time;
        after_time = last_synced_time - durationInMinutes * SECS_PER_MINUTE;
    }

    const transactions = chargebee.transaction;
    transactions.name = "Transactions";
    const subscriptions = chargebee.subscription;
    subscriptions.name = "Subscriptions";
    const customers = chargebee.customer;
    customers.name = "Customers";
    const plans = chargebee.plan;
    plans.name = "Plans";

    const promises = await Promise.allSettled([
        fetchResource(transactions, CB_SITE_US, CB_API_KEY_US, current_time, after_time),
        fetchResource(transactions, CB_SITE_EU, CB_API_KEY_EU, current_time, after_time),
        fetchResource(subscriptions, CB_SITE_US, CB_API_KEY_US, current_time, after_time),
        fetchResource(subscriptions, CB_SITE_EU, CB_API_KEY_EU, current_time, after_time),
        fetchResource(customers, CB_SITE_US, CB_API_KEY_US, current_time, after_time),
        fetchResource(customers, CB_SITE_EU, CB_API_KEY_EU, current_time, after_time),
        fetchResource(plans, CB_SITE_US, CB_API_KEY_US, current_time, after_time),
        fetchResource(plans, CB_SITE_EU, CB_API_KEY_EU, current_time, after_time),
    ]);

    // console.log('promises: ', promises)

    // FiveTran Connector Function Response Format:
    // https://fivetran.com/docs/functions#responseformat
    aggregated_result = {
        state: {
            last_synced_time: current_time,
        },
        insert: {
            transactions: [],
            subscriptions: [],
            customers: [],
            plans: [],
        },
        schema: {
            transactions: {
                primary_key: ["id"]
            },
            subscriptions: {
                primary_key: ["id"]
            },
            customers: {
                primary_key: ["id"]
            },
            plans: {
                primary_key: ["id"]
            }
        },
    }

    for (const promise of promises) {
        for (const response of promise.value) {
            for (const item of response.list) {
                // console.log("item: ", item);
                if ("transaction" in item) {
                    aggregated_result.insert.transactions.push(item.transaction);
                }
                if ("subscription" in item) {
                    aggregated_result.insert.subscriptions.push(item.subscription);
                }
                if ("customer" in item) {
                    aggregated_result.insert.customers.push(item.customer);
                }
                if ("plan" in item) {
                    aggregated_result.insert.plans.push(item.plan);
                }
            }
        }
    }

    console.log("Inserting...");
    Object.keys(aggregated_result.insert).forEach(e => console.log(`${aggregated_result.insert[e].length} ${e}`));

    res.json(aggregated_result);
};