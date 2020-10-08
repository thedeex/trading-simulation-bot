'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const config = require('../modules/config');
let db = {};


const sequelize = new Sequelize(config.get('database:database'), config.get('database:username'), config.get('database:password'), config.get('database'));
if (config.get('database:auto_sync'))
{
    sequelize.sync().then(function(){

    }, function(err){
        console.error(`Database init failure. with message ${err.message}. Please. check configuration. Process stopped.`);
        process.exit();

    });
}

fs
    .readdirSync(__dirname)
    .filter(file => {
        return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
    })
    .forEach(file => {
        var model = sequelize['import'](path.join(__dirname, file));
        db[model.name] = model;
    });

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
