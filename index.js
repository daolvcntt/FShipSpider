require('dotenv').config()
var express = require('express');
var app = express();
var foody	= require('./foody.js');
var bodyParser = require('body-parser');
const compress = require('compression');
const cors = require('cors');
const helmet = require('helmet');

// Constants list
const PORT = process.env.PORT;

// Setup middleware
app.set('port', (PORT || 3000));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('request-param')());
app.use(compress());
app.use(cors());
app.use(helmet());

// var googleMapsClient = require('@google/maps').createClient({
//   key: 'AIzaSyB6ejQLRgg7pBH1a0eIx3s2OeEmpNfPpPk'
// });
// googleMapsClient.geocode({
//   address: '26B Thọ Xương, Phủ Doãn, Quận Hoàn Kiếm, Hà Nội'
// }, function(err, response){
// 	if (!err) {
// 	  console.log(response.json.results[0].geometry);
// 	}
// });
foody.getLinks();
setTimeout(function(){
	foody.crawl();
}, 5000);

app.listen(PORT, function() {
	console.log('Port ' +  PORT);
});