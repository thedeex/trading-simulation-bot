'use strict';
/**
 * Created by bogdanmedvedev on 11.01.18.
 * TODO перепиаcать к черятм
 */

const DIR_CONFIG = 'config';
const NAME_CONFIG = 'app_config';

const fs = require('fs'),
    path = require('path'),
    nconf = require('nconf'),
    error = console.error,
    log = console,
    _path_config = __dirname + '/../../config/';

let defaultDatabaseConfig={
    "production": {
        "username": "postgres",
        "password": "",
        "database": "gateway",
        "host": "127.0.0.1",
        "dialect": "postgresql",
        "logging": false
    }
};

function reloadConfig() {
    try {
        let dbCoinfig;
        if (!fs.existsSync(_path_config + 'config.json')) {
            fs.writeFileSync(_path_config + 'config.json', JSON.stringify(defaultDatabaseConfig, null, "\t"));
            console.info('Creating default config.json file. Please edit manually and restart.Process stopped');
            process.exit();
        }

        try {
            dbCoinfig = JSON.parse(fs.readFileSync(_path_config + 'config.json'));
        }
        catch (e) {
            console.error('config.json corrupted. Please verify and restart container. Process stopped', e.message);
            process.exit();
        }

        try {
            if (!fs.existsSync(_path_config + 'app_config.json')) {
                fs.writeFileSync(_path_config + 'app_config.json', JSON.stringify({}, null, "\t"));
            }

            JSON.parse(fs.readFileSync(_path_config + 'app_config.json'));
        } catch (e) {
            console.error('app_config.json corrupted. Please verify and restart container. Process stopped',e.message);
            process.exit();
        }

        nconf.argv().env().file({file: _path_config + 'app_config.json'});
        nconf.set('database', (dbCoinfig['production'] || dbCoinfig['development']));

    } catch (e) {
        setTimeout(reloadConfig, 5000);
        log.error('File app_config.json [format Error]:', e);
    }
}

reloadConfig();

function saveConfig() {
    return new Promise(async (resolve, reject) => {
        nconf.save(function (err) {
            if (err) return reject('core/createConfig.js/nconf.save :' + err);
            return resolve(true);
        });
    });
}


const model = {
    set: (param, value, testWrite, dontSave) => {
        return new Promise((resolve, reject) => {
            if (!param || typeof param !== 'string')
                return reject('param is not string');
            if (testWrite) {
                if (!nconf.get(param)) {
                    nconf.set(param, value);
                    return resolve(true);
                }
                return resolve(false);
            }
            nconf.set(param, value);
            return resolve(true);
        }).then((status) => {
            if (!dontSave) return saveConfig().catch(function () {
                console.log('config save fail');
            });
            return true
        });
    },
    get: function (param) {
        var value = nconf.get(param);
        if (param != 'server:server:logs:app_config' && model.get('server:server:logs:app_config')) log.info('[app_config get] Param:' + param + ', Value:' + value);
        return value
    },
    save: saveConfig,
    rereadConfig: reloadConfig
};
module.exports = model;
require('./createConfig'); // init create conf
