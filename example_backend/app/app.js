import express from 'express';
import path from 'path';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import xmlParser from 'body-parser-xml';
import routes from './routes/index';
import cors from 'cors';
import helmet from 'helmet';

xmlParser(bodyParser);

var app = express();

app.use(cors());
app.use(helmet());
app.use(logger(':date :method :url - :status - :response-time ms'));

app.use(bodyParser.json({
    limit: '1mb',
    verify: (req, res, body) => {
        req.rawBody = body.toString();
    }
}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.xml({
    xmlParseOptions: {
        explicitArray: false
    }
}));
app.use(cookieParser());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use('/', routes);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    var err = new Error('Not found');
    err.status = 404;
    next(err);
});


// error handler
app.use( (err, req, res, next) => {
    res.status(err.status || 500).json({
        status: false,
        error: err.message 
    });
});


module.exports = app;