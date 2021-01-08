var express = require('express');
const bodyParser = require('body-parser');
var router = express.Router();
var fs = require('fs');
const {body, validationResult} = require('express-validator');
var mysql = require('mysql2/promise');
const redis = require('redis');
const publisher = redis.createClient();
const moment = require('moment');
const {HOST, USER, PASSWORD, DATABASE, PUB_SUB_NAME} = require('../config');
const cheerio = require('cheerio');
const HtmlTableToJson = require('html-table-to-json');


var pool = mysql.createPool({
    host: HOST || 'localhost',
    user: USER || 'root',
    password: PASSWORD || '123456',
    database: DATABASE || 'mrs',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


var token_check = function (req, res, next) {
    console.log('LOGGED')
    next()
}

router.post("/check-process", [
    body('token').isLength({min: 10}),
    body('reference').isLength({min: 10}),
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({errors: errors.array()});
    }
    const check = await checkToken(req.body.token);
    if (check) {
        const check = await pool.query("select * from queues where reference_number='" + req.body.reference + "' and created_at>'" + moment().add(-30, 'days').format("YYYY-MM-DD HH:mm:ss") + "'");
        if (check[0][0]) {
            if (check[0][0].status === 1) {
                const result = {
                    process_status: check[0][0].status,
                    reference: check[0][0].reference_number,
                    tax_number: check[0][0].tax_number,
                    bot_payload: JSON.parse(check[0][0].bot_payload),

                };
                return res.status(200).json({
                    status: true,
                    cache_date: check[0][0].process_end_at,
                    data: result
                });
            } else if (check[0][0].status === 0) {
                return res.status(200).json({
                    status: true,
                    processing: true,
                    reference: parseInt(check[0][0].reference_number)
                });
            }
        }
        return res.status(404).json({status: false});
    } else {
        return res.status(401).json({status: false});
    }
});


router.get("/manuel-start", [
    body('token').isLength({min: 10})
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({errors: errors.array()});
    }
    if (req.body.token) {
        const check = await checkToken(req.body.token);
        if (check) {
            publisher.publish(PUB_SUB_NAME, JSON.stringify({}));
            return res.status(200).json({status: true});
        } else {
            return res.status(401).json({status: false});
        }
    }
    return res.status(401).json({status: false});
});

router.post("/query", [
    body('token').isLength({min: 10}),
    body('tax_number').isLength({min: 5})
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({errors: errors.array()});
    }
    let user = await checkToken(req.body.token);
    if (!user) {
        return res.status(401).json({status: false});
    }
    const check = await pool.query("select * from queues where tax_number='" + req.body.tax_number + "' and created_at>'" + moment().add(-30, 'days').format("YYYY-MM-DD HH:mm:ss") + "'");
    if (check[0][0]) {
        if (check[0][0].status === 1) {
            const result = {
                process_status: check[0][0].status,
                reference: check[0][0].reference_number,
                tax_number: check[0][0].tax_number,
                bot_payload: JSON.parse(check[0][0].bot_payload),

            };
            return res.status(200).json({
                status: true,
                cache_date: check[0][0].process_end_at,
                data: result
            });
        } else if (check[0][0].status === 0) {
            return res.status(200).json({
                status: true,
                processing: true,
                reference: parseInt(check[0][0].reference_number)
            });
        }
    }
    let reference = getRandomArbitrary(1000000000, 9999999999);
    const result = await pool.query('INSERT INTO queues (created_at, process_start_at, process_end_at, reference_number, tax_number, bot_payload, status, error_log, user_payload,api_user_id) VALUES (now(), null, null, \'' + reference + '\', \'' + req.body.tax_number + '\', null, 0, null, \'' + JSON.stringify({
        token: req.body.token,
        tax_number: req.body.tax_number
    }) + '\',' + user + ')\n');
    publisher.publish(PUB_SUB_NAME, JSON.stringify(result[0]));

    /*
    for (const i in rows) {
        ss.push(rows[i])
    }
    console.log(rows);*/
    return res.status(200).json({status: true, cached: false, reference: reference})
})
;

/* GET home page. */
router.get('/', function (req, res, next) {
    res.status(200).json({
        services: "working"
    });
});

module.exports = router;

function getRandomArbitrary(min, max) {
    return parseInt(Math.random() * (max - min) + min);
}

/**
 * You first need to create a formatting function to pad numbers to two digits…
 **/
function twoDigits(d) {
    if (0 <= d && d < 10) return "0" + d.toString();
    if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
    return d.toString();
}

/**
 * …and then create the method to output the date string as desired.
 * Some people hate using prototypes this way, but if you are going
 * to apply this to more than one Date object, having it as a prototype
 * makes sense.
 **/
Date.prototype.toMysqlFormat = function () {
    return this.getUTCFullYear() + "-" + twoDigits(1 + this.getUTCMonth()) + "-" + twoDigits(this.getUTCDate()) + " " + twoDigits(this.getUTCHours()) + ":" + twoDigits(this.getUTCMinutes()) + ":" + twoDigits(this.getUTCSeconds());
};

async function checkToken(token) {
    console.log(token);
    const check = await pool.query("select * from api_users where private_key='" + token + "'");
    console.log(check[0][0]);
    if (check[0][0]) {
        return check[0][0].id;
    }
    return false;
}
