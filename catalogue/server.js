const instana = require('@instana/collector');
// init tracing
// MUST be done before loading anything else!
instana({
    tracing: {
        enabled: true
    }
});

const mongoClient = require('mongodb').MongoClient;
const mongoObjectID = require('mongodb').ObjectID;
const bodyParser = require('body-parser');
const express = require('express');
const pino = require('pino');
const expPino = require('express-pino-logger');


const logger = pino({
    level: 'info',
    prettyPrint: false,
    useLevelLabels: true
});
const expLogger = expPino({
    logger: logger
});

// MongoDB
var db;
var collection;
var mongoConnected = false;

const app = express();


// Prometheus
const promClient = require('prom-client');
const Registry = promClient.Registry;
const register = new Registry();
/* const counter = new promClient.Counter({
    name: 'items_added',
    help: 'running count of items added to cart',
    registers: [register]
}); */

//  get all products response time
const rt_catalogue_get_mongo_products = new promClient.Histogram(
    {
        name: 'rt_catalogue_get_mongo_products',
        help: 'response time of get all products from catalogue service',
        buckets: [0,0.01, 0.05, 0.5, 0.9, 0.95, 0.99, 1, 1.5,2],
        registers: [register]
    }
    );

//  get all products in order response time
/* const get_resp_catalogue_all_products_ordered = new promClient.Histogram(
    {
        name: 'get_resp_catalogue_all_products_ordered',
        help: 'response time of get  products in order from catalogue service',
        buckets: [0,10,50,100,200,500,1000,5000,10000],
        registers: [register]
    }
    ); */

//  get all products in category response time
const rt_catalogue_get_mongo_productscat = new promClient.Histogram(
    {
        name: 'rt_catalogue_get_mongo_productscat',
        help: 'response time of get  products in order from catalogue service',
        buckets: [0,10,50,100,200,500,1000,5000,10000],
        registers: [register]
    }
    );

//  get products by name and description response time
const rt_catalogue_get_mongo_search = new promClient.Histogram(
    {
        name: 'rt_catalogue_get_mongo_search',
        help: 'response time of searching  products in from catalogue',
        buckets: [0,10,50,100,200,500,1000,5000,10000],
        registers: [register]
    }
    );

// get products by category 
const rt_catalogue_get_mongo_categories = new promClient.Histogram(
    {
        name: 'rt_catalogue_get_mongo_categories',
        help: 'response time of searching  products in from catalogue',
        buckets: [0,10,50,100,200,500,1000,5000,10000],
        registers: [register]
    }
    );

// get products by sku
const rt_catalogue_get_mongo_productsku = new promClient.Histogram(
    {
        name: 'rt_catalogue_get_mongo_productsku',
        help: 'response time of searching  products in from catalogue',
        buckets: [0,10,50,100,200,500,1000,5000,10000],
        registers: [register]
    }
    );
app.use(expLogger);

app.use((req, res, next) => {
    res.set('Timing-Allow-Origin', '*');
    res.set('Access-Control-Allow-Origin', '*');
    next();
});

app.use((req, res, next) => {
    let dcs = [
        "asia-northeast2",
        "asia-south1",
        "europe-west3",
        "us-east1",
        "us-west1"
    ];
    let span = instana.currentSpan();
    span.annotate('custom.sdk.tags.datacenter', dcs[Math.floor(Math.random() * dcs.length)]);

    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/health', (req, res) => {
    var stat = {
        app: 'OK',
        mongo: mongoConnected
    };
    res.json(stat);
});

// all products
app.get('/products', (req, res) => {
    // Start timing service: catalogue(/products)
    var start = new Date().getTime();
    if(mongoConnected) {
        collection.find({}).toArray().then((products) => {
            res.json(products);
        }).catch((e) => {
            req.log.error('ERROR', e);
            res.status(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not avaiable');
    }
    // End timing service: redis(/get)
    var elapsed = new Date().getTime() - start; 
    rt_catalogue_get_mongo_products.observe(elapsed);
});

// product by SKU
app.get('/product/:sku', (req, res) => {
    var start = new Date().getTime();
    if(mongoConnected) {
        // optionally slow this down
        const delay = process.env.GO_SLOW || 0;
        setTimeout(() => {
        collection.findOne({sku: req.params.sku}).then((product) => {
            req.log.info('product', product);
            if(product) {
                res.json(product);
            } else {
                res.status(404).send('SKU not found');
            }
        }).catch((e) => {
            req.log.error('ERROR', e);
            res.status(500).send(e);
        });
        }, delay);
    } else {
        req.log.error('database not available');
        res.status(500).send('database not available');
    }
    // End timing service: redis(/get)
    var elapsed = new Date().getTime() - start; 
    rt_catalogue_get_mongo_productsku.observe(elapsed);
});

// products in a category
app.get('/products/:cat', (req, res) => {
    var start = new Date().getTime();
    if(mongoConnected) {
        collection.find({ categories: req.params.cat }).sort({ name: 1 }).toArray().then((products) => {
            if(products) {
                res.json(products);
            } else {
                res.status(404).send('No products for ' + req.params.cat);
            }
        }).catch((e) => {
            req.log.error('ERROR', e);
            res.status(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not avaiable');
    }
    var elapsed = new Date().getTime() - start; 
    rt_catalogue_get_mongo_productscat.observe(elapsed);
});

// all categories
app.get('/categories', (req, res) => {
    var start = new Date().getTime();
    if(mongoConnected) {
        collection.distinct('categories').then((categories) => {
            res.json(categories);
        }).catch((e) => {
            req.log.error('ERROR', e);
            res.status(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not available');
    }
    var elapsed = (new Date().getTime() - start); 
    rt_catalogue_get_mongo_categories.observe(elapsed);
});

// search name and description
app.get('/search/:text', (req, res) => {
    var start = new Date().getTime();
    if(mongoConnected) {
        collection.find({ '$text': { '$search': req.params.text }}).toArray().then((hits) => {
            res.json(hits);
        }).catch((e) => {
            req.log.error('ERROR', e);
            res.status(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not available');
    }
    var elapsed = new Date().getTime() - start; 
    rt_catalogue_get_mongo_search.observe(elapsed);
});

// Prometheus
app.get('/metrics', (req, res) => {
    res.header('Content-Type', promClient.register.contentType);
    res.send(register.metrics());
});


// set up Mongo
function mongoConnect() {
    return new Promise((resolve, reject) => {
        var mongoURL = process.env.MONGO_URL || 'mongodb://mongodb:27017/catalogue';
        mongoClient.connect(mongoURL, (error, client) => {
            if(error) {
                reject(error);
            } else {
                db = client.db('catalogue');
                collection = db.collection('products');
                resolve('connected');
            }
        });
    });
}

// mongodb connection retry loop
function mongoLoop() {
    mongoConnect().then((r) => {
        mongoConnected = true;
        logger.info('MongoDB connected');
    }).catch((e) => {
        logger.error('ERROR', e);
        setTimeout(mongoLoop, 2000);
    });
}

mongoLoop();

// fire it up!
const port = process.env.CATALOGUE_SERVER_PORT || '8080';
app.listen(port, () => {
    logger.info('Started on port', port);
});

