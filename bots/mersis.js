const puppeteer = require('puppeteer');
var mysql = require('mysql2/promise');
const redis = require('redis');
const cheerio = require('cheerio');
const {HOST, USER, PASSWORD, DATABASE, PUB_SUB_NAME, MERSIS_ACCOUNT_USERNAME, MERSIS_ACCOUNT_PASSWORD, CAPTCHA_SECRET, PUPPETEER_SLOW_MO} = require('../config');
const subscriber = redis.createClient();
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
let isWorkingProcess = false;

subscriber.on("message", (channel, message) => {
    if (!isWorkingProcess) {
        run();
    }
})

subscriber.subscribe(PUB_SUB_NAME);

function run() {
    (async () => {

        isWorkingProcess = true;
        const browser = await puppeteer.launch({
            headless: true, devtools: false,
            slowMo: PUPPETEER_SLOW_MO
        });
        const page = await browser.newPage();
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        let testGo = true;
        let testCount = 0;
        while (testGo && testCount < 3) {
            testCount++;
            console.log("test: " + testCount);
            try {
                //#captchaImage
                await page.goto('https://mersis.gtb.gov.tr/Portal/KullaniciIslemleri/GirisIslemleri');
                await page.click('body > div.container-fluid > div > div > div.container > div > div > div.panel-body > ul > li:nth-child(2) > a');
                //await page.screenshot({path: 'example.png'});

                await page.waitForSelector('#captchaImage');          // wait for the selector to load
                const element = await page.$('#captchaImage');        // declare a variable with an ElementHandle
                await element.screenshot({path: 'test.png'});

                const ac = require("@antiadmin/anticaptchaofficial");
                const fs = require('fs');

                const captcha = fs.readFileSync('test.png', {encoding: 'base64'});
                let solving;
                let error = false;
                ac.setAPIKey(CAPTCHA_SECRET);
                await ac.solveImage(captcha, true)
                    .then(text => solving = text)
                    .catch(error2 => {
                        console.log('test received error ' + error2);
                        error = true
                    });
                if (!error) {
                    await page.type('#KullaniciAdi', MERSIS_ACCOUNT_USERNAME);
                    await page.type('#Sifre', MERSIS_ACCOUNT_PASSWORD);
                    await page.type("#Captcha", solving)
                    await page.click("#btnLogin")
                    console.log('New Page URL:', page.url());
                    try {
                        await page.waitForSelector("#divDuyurular", {timeout: 5000});
                    } catch (e) {
                        await page.goto('https://google.com');
                        continue;
                    }

                    debugger;
                    console.log('New Page URL:', page.url());
                    await page.screenshot({path: 'example.png'});
                    await page.waitForSelector("#navbar > ul:nth-child(1) > li:nth-child(4) > a", {visible: true});
                    await page.click('#navbar > ul:nth-child(1) > li:nth-child(4) > a')
                    try {
                        await page.waitForSelector("#navbar > ul:nth-child(1) > li.dropdown.open > ul > li:nth-child(1) > a", {visible: true});
                    } catch (e) {
                        await page.click('#navbar > ul:nth-child(1) > li:nth-child(4) > a');
                    }
                    await page.click('#navbar > ul:nth-child(1) > li.dropdown.open > ul > li:nth-child(1) > a')
                    await page.waitForSelector("#VergiNo");
                    console.log('New Page URL:', page.url());
                    await page.waitForSelector('#captchaImage');          // wait for the selector to load
                    let checkNew = true;
                    let check_count = 0;
                    let total = 0;
                    testGo = false;
                    while (checkNew && check_count < 30 && total < 300) {
                        error = false;
                        let rows = await pool.query("select * from queues where status=0 and process_start_at is null");
                        rows = rows[0];
                        console.log(rows);
                        if (!checkNew) {
                            await page.waitForTimeout(2000);
                            continue;
                        }
                        total++;
                        if (rows.length < 1) {
                            check_count++;
                        } else {
                            check_count = 0;
                        }
                        for (let i = 0; i < rows.length; i++) {
                            let canContinue = true;
                            let date = new Date();
                            await page.evaluate(() => document.getElementById("VergiNo").value = "")
                            await pool.query("UPDATE queues t SET t.process_start_at = '" + date.toMysqlFormat() + "' WHERE t.id = " + rows[i].id);
                            const element = await page.$('#captchaImage');        // declare a variable with an ElementHandle
                            await element.screenshot({path: 'test2.png'});
                            const captcha2 = fs.readFileSync('test2.png', {encoding: 'base64'});
                            let isCaptchaFalse = true;
                            let searchNotFound = false;
                            let count_isCaptchaFalse = 0;
                            while (isCaptchaFalse && count_isCaptchaFalse < 3) {
                                await ac.solveImage(captcha2, true)
                                    .then(text => solving = text)
                                    .catch(error2 => {
                                        console.log('test received error ' + error2);
                                        error = error2 + " captcha çözülemedi."
                                    });
                                if (error) {
                                    await pool.query("INSERT INTO failed_jobs (queue_id, description) VALUES (" + rows[i].id + ", '" + error + "')")
                                    isCaptchaFalse = false;
                                    canContinue = false;
                                    continue;
                                }
                                await page.type('#VergiNo', rows[i].tax_number);
                                await page.type('#Captcha', solving);
                                await page.click("#btnSubmitDegisiklikFirmaAra");
                                try {
                                    await page.waitForSelector("#gridAramaFirmaCommonList > tbody > tr > td > a", {timeout: 2000})
                                    isCaptchaFalse = false;
                                } catch (e) {
                                    count_isCaptchaFalse++;
                                    try {
                                        await page.waitForSelector('#toast-container', {timeout: 3000});
                                        await page.click("body > nav > div > div.navbar-header > div > a");
                                        await page.waitForSelector("#navbar > ul:nth-child(1) > li:nth-child(4) > a", {
                                            visible: true,
                                            timeout: 3000
                                        });
                                        await page.click('#navbar > ul:nth-child(1) > li:nth-child(4) > a')
                                        try {
                                            await page.waitForSelector("#navbar > ul:nth-child(1) > li.dropdown.open > ul > li:nth-child(1) > a", {
                                                visible: true,
                                                timeout: 3000
                                            });
                                        } catch (e) {
                                            await page.click('#navbar > ul:nth-child(1) > li:nth-child(4) > a');
                                        }
                                        await page.click('#navbar > ul:nth-child(1) > li.dropdown.open > ul > li:nth-child(1) > a');
                                    } catch (e) {
                                        searchNotFound = true;
                                        isCaptchaFalse = false;
                                    }
                                }
                            }
                            if (!canContinue || count_isCaptchaFalse >= 3) {
                                continue;
                            }
                            if (searchNotFound) {
                                console.log("Firma bulunamadı. ");
                                await pool.query("UPDATE queues t SET t.process_end_at = '" + date.toMysqlFormat() + "',t.status=1,bot_payload='{\"status\":false,\"message\":\"Firma bulunamadı\"}' WHERE t.id = " + rows[i].id);
                            } else {
                                console.log("Firma Bulundu.");
                                await page.click("#gridAramaFirmaCommonList > tbody > tr > td > a");
                                await page.waitForSelector("#collapseOne > div");
                                let info_raw = await page.$eval('#collapseOne > div', e => e.innerHTML);

                                const $html = cheerio.load(info_raw);

                                let title = "";
                                try {
                                    title = $html("div:nth-child(1) > div:nth-child(1)")[0].children[3].data.trim();
                                } catch (e) {
                                }
                                let establish_date = "";
                                try {
                                    establish_date = $html("div:nth-child(1) > div:nth-child(2)")[0].children[3].data.trim();
                                } catch (e) {
                                }
                                let company_status = "";
                                try {
                                    company_status = $html("div:nth-child(1) > div:nth-child(3)")[0].children[3].data.trim();
                                } catch (e) {
                                }

                                let mersis_no = "";
                                try {
                                    mersis_no = $html("div:nth-child(2) > div:nth-child(1)")[0].children[3].data.trim();
                                } catch (e) {
                                }
                                let tax_dep_no = "";
                                try {
                                    tax_dep_no = $html("div:nth-child(2) > div:nth-child(2)")[0].children[3].data.trim();
                                } catch (e) {
                                }
                                let ticaret_sicil = "";
                                try {
                                    console.log($html("div:nth-child(2) > div:nth-child(3)")[0].children[4].children[0].data);
                                    ticaret_sicil = $html("div:nth-child(2) > div:nth-child(3)")[0].children[4].children[0].data;

                                } catch (e) {
                                }

                                let company_type = "";
                                try {
                                    company_type = $html("div:nth-child(3) > div:nth-child(1)")[0].children[3].data.trim();
                                } catch (e) {
                                }
                                let ts_mudurlugu = "";
                                try {
                                    ts_mudurlugu = $html("div:nth-child(3) > div:nth-child(2)")[0].children[3].data.trim();
                                } catch (e) {
                                }
                                let city = "";
                                try {
                                    city = $html("div:nth-child(3) > div:nth-child(3)")[0].children[3].data.trim();
                                } catch (e) {
                                }
                                let address = "";
                                try {
                                    address = $html("div:nth-child(4) > div:nth-child(1)")[0].children[3].data.trim();
                                } catch (e) {
                                }

                                let info = {
                                    title: title,
                                    establish_date: establish_date,
                                    company_status: company_status,
                                    mersis_no: mersis_no,
                                    tax_dep_no: tax_dep_no,
                                    ticaret_sicil: ticaret_sicil,
                                    company_type: company_type,
                                    ts_mudurlugu: ts_mudurlugu,
                                    city: city,
                                    address: address
                                };

                                /*
                                fs.writeFile('info.txt', info, function (err) {
                                    if (err) return console.log(err);
                                });
    7330407854
                                 */
                                let yetkili = {};
                                await page.click("#hrefYKYetkili");
                                await page.waitForSelector("#gridFirmaTicariSinirliYetkili");
                                let yetkili_info = "<table id='table1'>";
                                try {
                                    yetkili_info += await page.$eval('#gridFirmaTicariSinirliYetkili', e => e.innerHTML);
                                    yetkili_info += "</table>";
                                    yetkili_info = yetkili_info.replace(/\<tfoot\>([\s\S]*)\<\/tfoot\>/g, '');
                                    const a = HtmlTableToJson.parse(yetkili_info);
                                    const aObj = {
                                        name_surname: a._results[0][0]['Adı Soyadı'],
                                        permission: a._results[0][0]['Yetki'],
                                        permission_type: a._results[0][0]['Yetki Şekli'],
                                        permission_term: a._results[0][0]['Yetki Süresi'],
                                        permission_end_at: a._results[0][0]['Yetki Bitiş Tarihi'],
                                    };
                                    yetkili.yetkililer = aObj;
                                } catch (e) {
                                    console.log(e);
                                }

                                try {
                                    yetkili_info = "<table id='table2'>";
                                    yetkili_info += await page.$eval('#gridFirmaUyelerListesi', e => e.innerHTML);
                                    yetkili_info += "</table>";
                                    yetkili_info = yetkili_info.replace(/\<tfoot\>([\s\S]*)\<\/tfoot\>/g, '');
                                    const b = HtmlTableToJson.parse(yetkili_info);
                                    console.log(b._results);
                                    const bObj = {
                                        name_surname: b._results[0][0]['Adı Soyadı'],
                                        mission_term: b._results[0][0]['Görev Süresi']
                                    };
                                    yetkili.firma_uyeleri = bObj;
                                } catch (e) {
                                    console.log(e);
                                }

                                try {
                                    yetkili_info = "<table id='table3'>";
                                    yetkili_info += await page.$eval('#gridFirmaOrtakYetkiliOlduguFirmalarListesi', e => e.innerHTML);
                                    yetkili_info += "</table>";
                                    yetkili_info = yetkili_info.replace(/\<tfoot\>([\s\S]*)\<\/tfoot\>/g, '');
                                    const c = HtmlTableToJson.parse(yetkili_info);
                                    console.log(c._results);
                                    const cObj = {
                                        name_surname: c._results[0][0]['Adı Soyadı'],
                                        mission_distribution: c._results[0][0]['Görev Dağılımı'],
                                        permission_term: c._results[0][0]['Yetki Süresi'],
                                        permission_end_at: c._results[0][0]['Yetki Bitiş Tarihi']
                                    };
                                    yetkili.gorev_dagilimi = cObj;
                                } catch (e) {
                                    console.log(e);
                                }


                                let result = {
                                    status: true,
                                    info: info,
                                    yetkili_info: yetkili
                                };
                                result = JSON.stringify(result);

                                await pool.query("UPDATE queues t SET t.process_end_at = '" + date.toMysqlFormat() + "',t.status=1,bot_payload=? WHERE t.id = " + rows[i].id, [result]);
                                await page.waitForSelector('#btnClearDegisiklikFirmaAra')
                                await page.click('#btnClearDegisiklikFirmaAra');
                                //#collapseOne > div
                            }
                        }
                        await page.waitForTimeout(2000);
                    }
                }
            } catch (e) {
                console.log(e);
                console.log("teknik arza")
            }
        }
        await browser.close();
        isWorkingProcess = false;
    })();
}

function twoDigits(d) {
    if(0 <= d && d < 10) return "0" + d.toString();
    if(-10 < d && d < 0) return "-0" + (-1*d).toString();
    return d.toString();
}

/**
 * …and then create the method to output the date string as desired.
 * Some people hate using prototypes this way, but if you are going
 * to apply this to more than one Date object, having it as a prototype
 * makes sense.
 **/
Date.prototype.toMysqlFormat = function() {
    return this.getUTCFullYear() + "-" + twoDigits(1 + this.getUTCMonth()) + "-" + twoDigits(this.getUTCDate()) + " " + twoDigits(this.getUTCHours()) + ":" + twoDigits(this.getUTCMinutes()) + ":" + twoDigits(this.getUTCSeconds());
};
