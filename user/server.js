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
const redis = require('redis');
const bodyParser = require('body-parser');
const express = require('express');
const pino = require('pino');
const expPino = require('express-pino-logger');

// Prometheus
const promClient = require('prom-client');
const Registry = promClient.Registry;
const register = new Registry();

// Redis response time
const rt_user_get_redis = new promClient.Histogram(
    {
        name: 'rt_user_get_redis',
        help: 'response time of redis GET request from user',
        buckets: [0, 0.05, 0.1, 0.2, 1, 50, 100, 150],
        registers: [register],
    }
);

const rt_user_get_mongo_checkid = new promClient.Histogram(
    {
        name: 'rt_user_get_mongo_checkid',
        help: 'response time of mongo user id GET request from user',
        buckets: [0, 0.05, 0.1, 0.2, 1, 50, 100, 150],
        registers: [register],
    }
);

const rt_user_get_mongo_users = new promClient.Histogram(
    {
        name: 'rt_user_get_mongo_users',
        help: 'response time of mongo users GET request from user',
        buckets: [0, 0.05, 0.1, 0.2, 1, 50, 100, 150],
        registers: [register],
    }
);

const rt_user_post_login = new promClient.Histogram(
    {
        name: 'rt_user_post_login',
        help: 'response time of login POST request from user',
        buckets: [0, 0.05, 0.1, 0.2, 1, 50, 100, 150],
        registers: [register],
    }
);

const rt_user_post_register = new promClient.Histogram(
    {
        name: 'rt_user_post_register',
        help: 'response time of register POST request from user',
        buckets: [0, 0.05, 0.1, 0.2, 1, 50, 100, 150],
        registers: [register],
    }
);

const rt_user_post_order = new promClient.Histogram(
    {
        name: 'rt_user_post_order',
        help: 'response time of order POST request from user',
        buckets: [0, 0.05, 0.1, 0.2, 1, 50, 100, 150],
        registers: [register],
    }
);

const rt_user_get_mongo_history = new promClient.Histogram(
    {
        name: 'rt_user_get_mongo_history',
        help: 'response time of mongo history GET request from user',
        buckets: [0, 0.05, 0.1, 0.2, 1, 50, 100, 150],
        registers: [register],
    }
);

// MongoDB
var db;
var usersCollection;
var ordersCollection;
var mongoConnected = false;

const logger = pino({
    level: 'info',
    prettyPrint: false,
    useLevelLabels: true
});
const expLogger = expPino({
    logger: logger

});

const app = express();

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

// Prometheus
app.get('/metrics', (req, res) => {
    res.header('Content-Type', promClient.register.contentType);
    res.send(register.metrics());
});

// use REDIS INCR to track anonymous users
app.get('/uniqueid', (req, res) => {
    // Start timing service: redis(/get)
    var start = new Date().getTime();
    // get number from Redis
    redisClient.incr('anonymous-counter', (err, r) => {
        if(!err) {
            res.json({
                uuid: 'anonymous-' + r
            });
        } else {
            req.log.error('ERROR', err);
            res.status(500).send(err);
        }
    });
    var elapsed = new Date().getTime() - start; // End timing service: redis(/get)
    rt_user_get_redis.observe(elapsed)
});

// check user exists
app.get('/check/:id', (req, res) => {
    // Start timing service: mongo(/get)
    var start = new Date().getTime();
    if(mongoConnected) {
        usersCollection.findOne({name: req.params.id}).then((user) => {
            if(user) {
                res.send('OK');
            } else {
                res.status(404).send('user not found');
            }
        }).catch((e) => {
            req.log.error(e);
            res.send(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not available');
    }
    var elapsed = new Date().getTime() - start; // End timing service: mongo(/get)
    rt_user_get_mongo_checkid.observe(elapsed)
});

// return all users for debugging only
app.get('/users', (req, res) => {
    // Start timing service: mongo(/get)
    var start = new Date().getTime();
    if(mongoConnected) {
        usersCollection.find().toArray().then((users) => {
            res.json(users);
        }).catch((e) => {
            req.log.error('ERROR', e);
            res.status(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not available');
    }
    var elapsed = new Date().getTime() - start; // End timing service: mongo(/get)
    rt_user_get_mongo_users.observe(elapsed)
});

app.post('/login', (req, res) => {
    // Start timing service: login(/post)
    var start = new Date().getTime();
    req.log.info('login', req.body);
    if(req.body.name === undefined || req.body.password === undefined) {
        req.log.warn('credentails not complete');
        res.status(400).send('name or passowrd not supplied');
    } else if(mongoConnected) {
        usersCollection.findOne({
            name: req.body.name,
        }).then((user) => {
            req.log.info('user', user);
            if(user) {
                if(user.password == req.body.password) {
                    res.json(user);
                } else {
                    res.status(404).send('incorrect password');
                }
            } else {
                res.status(404).send('name not found');
            }
        }).catch((e) => {
            req.log.error('ERROR', e);
            res.status(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not available');
    }
    var elapsed = new Date().getTime() - start; // End timing service: login(/post)
    rt_user_post_login.observe(elapsed)
});

// TODO - validate email address format
app.post('/register', (req, res) => {
    // Start timing service: register(/post)
    var start = new Date().getTime();
    req.log.info('register', req.body);
    if(req.body.name === undefined || req.body.password === undefined || req.body.email === undefined) {
        req.log.warn('insufficient data');
        res.status(400).send('insufficient data');
    } else if(mongoConnected) {
        // check if name already exists
        usersCollection.findOne({name: req.body.name}).then((user) => {
            if(user) {
                req.log.warn('user already exists');
                res.status(400).send('name already exists');
            } else {
                // create new user
                usersCollection.insertOne({
                    name: req.body.name,
                    password: req.body.password,
                    email: req.body.email
                }).then((r) => {
                    req.log.info('inserted', r.result);
                    res.send('OK');
                }).catch((e) => {
                    req.log.error('ERROR', e);
                    res.status(500).send(e);
                });
            }
        }).catch((e) => {
            req.log.error('ERROR', e);
            res.status(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not available');
    }
    var elapsed = new Date().getTime() - start; // End timing service: register(/post)
    rt_user_post_register.observe(elapsed)
});

app.post('/order/:id', (req, res) => {
    // Start timing service: order(/post)
    var start = new Date().getTime();
    req.log.info('order', req.body);
    // only for registered users
    if(mongoConnected) {
        usersCollection.findOne({
            name: req.params.id
        }).then((user) => {
            if(user) {
                // found user record
                // get orders
                ordersCollection.findOne({
                    name: req.params.id
                }).then((history) => {
                    if(history) {
                        var list = history.history;
                        list.push(req.body);
                        ordersCollection.updateOne(
                            { name: req.params.id },
                            { $set: { history: list }}
                        ).then((r) => {
                            res.send('OK');
                        }).catch((e) => {
                            req.log.error(e);
                            res.status(500).send(e);
                        });
                    } else {
                        // no history
                        ordersCollection.insertOne({
                            name: req.params.id,
                            history: [ req.body ]
                        }).then((r) => {
                            res.send('OK');
                        }).catch((e) => {
                            req.log.error(e);
                            res.status(500).send(e);
                        });
                    }
                }).catch((e) => {
                    req.log.error(e);
                    res.status(500).send(e);
                });
            } else {
                res.status(404).send('name not found');
            }
        }).catch((e) => {
            req.log.error(e);
            res.status(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not available');
    }
    var elapsed = new Date().getTime() - start; // End timing service: order(/post)
    rt_user_post_order.observe(elapsed)
});

app.get('/history/:id', (req, res) => {
    // Start timing service: mongo_history(/get)
    var start = new Date().getTime();
    if(mongoConnected) {
        ordersCollection.findOne({
            name: req.params.id
        }).then((history) => {
            if(history) {
                res.json(history);
            } else {
                res.status(404).send('history not found');
            }
        }).catch((e) => {
            req.log.error(e);
            res.status(500).send(e);
        });
    } else {
        req.log.error('database not available');
        res.status(500).send('database not available');
    }
    var elapsed = new Date().getTime() - start; // End timing service: mongo_history(/get)
    rt_user_get_mongo_history.observe(elapsed)
});

// connect to Redis
var redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'redis'
});

redisClient.on('error', (e) => {
    logger.error('Redis ERROR', e);
});
redisClient.on('ready', (r) => {
    logger.info('Redis READY', r);
});

// set up Mongo
function mongoConnect() {
    return new Promise((resolve, reject) => {
        var mongoURL = process.env.MONGO_URL || 'mongodb://mongodb:27017/users';
        mongoClient.connect(mongoURL, (error, client) => {
            if(error) {
                reject(error);
            } else {
                db = client.db('users');
                usersCollection = db.collection('users');
                ordersCollection = db.collection('orders');
                resolve('connected');
            }
        });
    });
}

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
const port = process.env.USER_SERVER_PORT || '8080';
app.listen(port, () => {
    logger.info('Started on port', port);
});

