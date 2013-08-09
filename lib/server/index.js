var express = require('express');
var derby = require('derby');
var racerBrowserChannel = require('racer-browserchannel');
var liveDbMongo = require('livedb-mongo');
var MongoStore = require('connect-mongo')(express);
var app = require('../app');
var error = require('./error');

var expressApp = module.exports = express();

// Get Redis configuration
if (process.env.REDIS_HOST) {
  var redis = require('redis').createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);
  redis.auth(process.env.REDIS_PASSWORD);
} else if (process.env.REDISCLOUD_URL) {
  var redisUrl = require('url').parse(process.env.REDISCLOUD_URL);
  var redis = require('redis').createClient(redisUrl.port, redisUrl.hostname);
  redis.auth(redisUrl.auth.split(":")[1]);
} else {
  var redis = require('redis').createClient();
}
redis.select(process.env.REDIS_DB || 1);
// Get Mongo configuration 
var mongoUrl = process.env.MONGO_URL || process.env.MONGOHQ_URL ||
  'mongodb://localhost:27017/project';

// The store creates models and syncs data
var store = derby.createStore({
  db: liveDbMongo(mongoUrl + '?auto_reconnect', {safe: true})
, redis: redis
});

function createUserId(req, res, next) {
  var model = req.getModel();
  var userId = req.session.userId || (req.session.userId = model.id());
  model.set('_session.userId', userId);
  next();
}

expressApp
  .use(express.favicon())
  // Gzip dynamically
  .use(express.compress())
  
  // Respond to requests for application script bundles
  .use(app.scripts(store))
  
  // Serve static files from the public directory
  .use(express.static(__dirname + '/../../public'))

  // Add browserchannel client-side scripts to model bundles created by store,
  // and return middleware for responding to remote client messages
  .use(racerBrowserChannel(store))
  
  // Add req.getModel() method
  .use(store.modelMiddleware())



  // Parse form data
  .use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + '/../../uploads' }))



  // .use(express.methodOverride())

  // Session middleware
  .use(express.cookieParser())
  .use(express.session({
    secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE'
  , store: new MongoStore({url: mongoUrl, safe: true})
  }))
  .use(createUserId)

  // Create an express middleware from the app's routes
  .use(app.router())
  .use(expressApp.router)
  .use(error())


// SERVER-SIDE ROUTES //

// Uploading Images
var fs= require('fs');
var path= require('path');
expressApp.post('/moni-upload', function(req, res) {
  
  // get the temporary location of the file
  var tmp_path = req.files.xfile.path;

  console.log("tmp path");
  console.log(tmp_path);
    
  // set where the file should actually exists - in this case it is in the "images" directory
  var target_path = path.join(__dirname + '../..', 'public/images' , req.files.xfile.name);

  console.log("TARTGET TARGET path");
  console.log(target_path);
  
  // move the file from the temporary location to the intended location
  fs.rename(tmp_path, target_path, function(err) {
      if (err) throw err;
      // delete the temporary file, so that the explicitly set temporary upload dir does not get filled with unwanted files
      fs.unlink(tmp_path, function() {
          if (err) throw err;
          res.send('File uploaded to: ' + target_path + ' - ' + req.files.xfile.size + ' bytes');
      });
  });

});

expressApp.all('*', function(req, res, next) {
  next('404: ' + req.url);
});