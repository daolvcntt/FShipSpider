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

foody.getLinks();
setTimeout(function(){
	foody.crawl();
}, 10000);