"use strict";

require('dotenv').config()
const async  = require('async');
const _      = require('lodash');
const fs     = require('fs');

var bluebird = require("bluebird");
var request  = bluebird.promisify(require('request-promise').defaults({jar: true}));
var requestImage = require('request').defaults({ encoding: null });
var stream   = require('stream');
var log      = require('npmlog');
var cheerio  = require('cheerio');
var mysql    = require('promise-mysql');
var hashids  = require('hashids');
var bcrypt   = require('bcrypt');
var moment   = require('moment');
var AWS      = require('aws-sdk');
var googleMapsClient = require('@google/maps').createClient({
  key: process.env.GOOGLE_MAP_KEY
});
var hashIds = new hashids(process.env.HASHID_SALT, process.env.HASHID_LENGTH, process.env.HASHID_ALPHABET);
var connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

AWS.config.update({ accessKeyId: process.env.AWS_ID, secretAccessKey: process.env.AWS_KEY });

function wait(ms) {
   return new Promise(r => setTimeout(r, ms))
}

function getHeaders(url) {
  var headers = {
    'Content-Type' : 'application/x-www-form-urlencoded',
    'Referer' : 'https://www.deliverynow.vn/ha-noi',
    'Host' : 'www.deliverynow.vn',
    'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/600.3.18 (KHTML, like Gecko) Version/8.0.3 Safari/600.3.18',
    'Connection' : 'keep-alive',
    'Cookie' : ''
  };

  return headers;
}

function getType(obj) {
  return Object.prototype.toString.call(obj).slice(8, -1);
}

function get(url, qs) {
  // I'm still confused about this
  if(getType(qs) === "Object") {
    for(var prop in qs) {
      if(qs.hasOwnProperty(prop) && getType(qs[prop]) === "Object") {
        qs[prop] = JSON.stringify(qs[prop]);
      }
    }
  }
  var op = {
    headers: getHeaders(url),
    timeout: 10000,
    qs: qs,
    url: url,
    method: "GET",
    gzip: true
  };

  return request(op).then(function(res) {return res;});
}

function getLinks () {
  console.log('Begin get links...');
  let timenow  =  moment().format("YYYY-MM-DD HH:mm:ss");
  let links    = fs.readFileSync('links.html').toString();
  let arrLinks = _.split(links, '\n', 3000);
  async.each(arrLinks, link => {
    connection.query('SELECT * FROM links WHERE link = ?', [link]).then(rows => {
      if (rows.length === 0) {
        connection.query('INSERT INTO links SET ?', {link: link, created_at: timenow, updated_at: timenow});
      }
    })
  })
}

function uploadRemoteImage (url) {
  if ((url === undefined) || url.includes('no-image')) {
    return '';
  }
  let imageName = '5ship-vn-food-'+Date.now()+url.substring(url.length-4,url.length);
  requestImage.get(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var s3 = new AWS.S3();
      s3.putObject({
        Bucket: 'static.5ship',
        Key: imageName,
        Body: body,
        ACL: 'public-read'
      },function (err, data) {
        if (err) console.log(err);
      });
    }
  });
  return imageName;
}

function crawl () {
  // connection.connect();
  connection.query('SELECT link FROM links').then(function(rows){
    // Logs out a list of hobbits
    async.eachSeries(rows, (row, next) => {
      get(row.link).then(res => {
        if (!res.error) {
          let timenow    =  moment().format("YYYY-MM-DD HH:mm:ss");
          let $          = cheerio.load(res.body);
          let restaurantImage = $('.img-hot-restaurant').first().children('img').first().attr('src');
          restaurantImage = uploadRemoteImage(restaurantImage);
          let category   = $('.kind-restaurant').first().text().trim();
          let name       = $('.name-hot-restaurant').first().text();
          let address    = $('.info-basic-hot-restaurant').children('p').first().text();
          let time       = $('.info-basic-hot-restaurant').children('p').eq(1).children('span').eq(1).text();
          let openTime1  = '';
          let closeTime1 = '';
          let openTime2  = '';
          let closeTime2 = '';
          let lat        = 0;
          let lng        = 0;
          if (time.includes('|')) {
            time       = _.split(time, ' | ', 2);
            let time1  = _.split(time[0], ' - ', 2);
            let time2  = _.split(time[1], ' - ', 2);
            openTime1  = time1[0];
            closeTime1 = time1[1];
            openTime2  = time2[0];
            closeTime2 = time2[1];
          } else {
            time       = _.split(time, '-', 2);
            openTime1  = time[0].trim();
            closeTime1 = time[1].trim();
          }
          let categoryId     = 0;
          let restaurantId   = 0;
          let menuId         = 0;
          let uuid;
          // ADD CATEGORY
          connection.query('SELECT * FROM restaurant_kinds WHERE name = ?', [category]).then((rows) => {
            if (rows.length === 0) {
              connection.query('INSERT INTO restaurant_kinds SET ?', {name: category, created_at: timenow, updated_at: timenow}).then((rows) => {
                categoryId = rows.insertId;
              });
            } else categoryId = rows[0].id;
            // ADD RESTAURANT
            wait(700).then(() => {
              // Phân loại đồ ăn, đồ uống
              let restaurantType = category.includes('CAFÉ/DESSERT') ? 2 : 1;
              // CREATE USER
              googleMapsClient.geocode({ address: address }, function(err, response) {
                if (!err) {
                  lat = response.json.results[0].geometry.location.lat;
                  lng = response.json.results[0].geometry.location.lng;
                }
                bcrypt.hash('123456', 10).then(function(password) {
                    connection.query('INSERT INTO users SET ?', {name: name, username: 'user', password: password.replace('$2a$', '$2y$'), balance_confirm: 0, address: address, is_restaurant: 1, created_at: timenow, updated_at: timenow }).then((rows) => {
                      uuid = hashIds.encode(rows.insertId);
                      let userData = { user_id: rows.insertId, image: restaurantImage, name: name, address: address, open_time1: openTime1, close_time1: closeTime1, category_id: categoryId, created_at: timenow, updated_at: timenow, lat: lat, lng: lng, type: restaurantType};
                      if(openTime2) userData.open_time2 = openTime2;
                      if(closeTime2) userData.close_time2 = closeTime2;
                      connection.query('INSERT INTO restaurants SET ?', userData).then((inserted) => {
                        restaurantId = inserted.insertId;
                        connection.query('UPDATE users SET uuid = ?, username = ? WHERE id = ?', [uuid, 'restaurant'+restaurantId, rows.insertId]);
                        console.log('restaurant id: '+restaurantId);
                      });
                    });
                });
              });
            });
          });

          let menus = [];
          $('.detail-menu-kind').children('.scrollspy').each(function(i, item){
            let listName = $(this).children('.title-kind-food').first().text();
            let listFood = [];
            $(this).children('div').each(function(i, item){
              let imageName = '5ship-food-' + Date.now() + '.jpg';
              let foodImage = $(this).children('.img-food-detail').children('a').first().children('img').first().attr('src');
              foodImage = uploadRemoteImage(foodImage);
              let foodName = $(this).children('.name-food-detail').children('a').children('h3').first().text().trim();
              let foodDescription = $(this).children('.name-food-detail').children('.desc').first().text().trim();
              let foodPrice = $(this).children('.more-info').first().children('.product-price').first().children('a').first().children('.current-price').first().children('span').first().text();
              listFood.push({image: foodImage, name: _.split(foodName, ' -', 1)[0], price: foodPrice.replace(',', ''), description: foodDescription});
            });
            menus.push({listName: listName.trim(), listFood: listFood});
          });

          wait(4000).then(() => {
            _.each(menus, menu => {
              connection.query('INSERT INTO menus SET ?', {name: menu.listName, restaurant_id: restaurantId, created_at: timenow, updated_at: timenow}).then((rows) => {
                menuId = rows.insertId;
                _.each(menu.listFood, food => {
                  connection.query('INSERT INTO foods SET ?', {name: food.name, image: food.image, price: food.price, description: food.description, menu_id: menuId, restaurant_id: restaurantId, created_at: timenow, updated_at: timenow});
                });
              });
            });
          });
        }
        // console.log(menu);
      });
      wait(700).then(() => {
        next();
      });
    });
  });
  // connection.end();
}

module.exports = {
  crawl: crawl,
  getLinks: getLinks
}
