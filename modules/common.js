const _ = require('lodash');
const winston = require('winston');
const telegram = require('telegram-bot-api');
var readlineSync = require('readline-sync');
const aes256 = require('./aes-256-cbc');
const config = require('./config');
const argv = require('minimist')(process.argv.slice(2));
require('winston-daily-rotate-file');
let resolve = require('path').resolve;
let path = require('path');

class common {

    constructor() {
        this.ERROR_MSG_DEFAULT = 'WARNING_____ERROR______';


        this.UNHANDLED_ERROR = 1000;



        this.telegramInstance = null;
        this.telegramApiKey = null;
        this.encrypto = null;

        this.availableErrorMessages = {
        };
    }



    /**
     *
     * @param field
     * @param defaultValue
     * @returns {*}
     */
    getArgv(field, defaultValue) {
        if (field) {
            return argv[field] || defaultValue
        } else {
            return argv
        }

    }

    /**
     *
     * @param field
     * @param value
     * @returns {*}
     */
    overrideArgv(field, value) {
        argv[field] = value;
        return value
    }

    /**
     *
     * @param ms
     * @returns {Promise<any>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     *
     * @param telegramApiKey
     * @returns {TelegramApi}
     */
    createTelegramInstance(telegramApiKey) {
        return this.telegramInstance = new telegram({
            token: telegramApiKey
        });
    }





    /**
     *
     * @returns {winston.LoggerInstance}
     */
    createLogger(loggerWorkerName) {
        if (!this.loggerInstance) {
            if (!loggerWorkerName) {
                loggerWorkerName='worker'
            }

            let tsFormat = () => (new Date()).toLocaleDateString() + ' - ' + (new Date()).toLocaleTimeString();
            this.loggerInstance = new (winston.Logger)({
                transports: [
                    new (winston.transports.DailyRotateFile)({
                        filename: loggerWorkerName+'-%DATE%.log',
                        dirname: resolve(__dirname+'/../logs/'),
                        datePattern: 'YYYY-MM',
                        json:false, //Setting JSON as false
                        maxSize: '50m',
                        level: 'debug',
                        zippedArchive: false,
                        timestamp: tsFormat
                    }),
                    new (winston.transports.Console)({
                        timestamp: tsFormat,
                        colorize: true,
                        level: 'debug'
                    })
                ]
            });
        }
        return this.loggerInstance;
    }




    /**
     *{
            operation: gateway.TRANSACTION_TYPE_WITHDRAW,
            coin: coinConfig.name,
            transaction_id: transaction.id,
            transaction_hash: transaction.confirmationHash,
            errorCode: outgoingTransaction.errorCode,
            message: err.message
    }
     * @param type
     * @param object
     * @returns {Promise<void>}
     */
    async notify(type, object) {
        let _this = this;

        return new Promise((complete)=>{

                object.errorMessage = _this.availableErrorMessages[object.errorCode] || object.errorCode;
                let str = "<b>";



                str += " " + type + "</b>\n\n\n";
                str += `<b>Coin</b> ${object.coin}\n`;
                if (object.transaction_id)
                    str += `<b>Transaction_id</b> ${object.transaction_id}\n`;
                if (object.transaction_hash)
                    str += `<b>Transaction_hash</b> ${object.transaction_hash}\n`;

                if (object.errorMessage)
                    str += `<b>ErrorCode</b> ${object.errorMessage}\n`;

                str += `<b>message</b> <code>${object.message}</code>\n`;
                // str += `</pre>`;
                // console.log(str);

            if (_this.telegramInstance) {
                _this.telegramInstance.sendMessage({
                    parse_mode: 'HTML',
                    chat_id: _this.telegramApiKey,
                    text: str
                })
                    .then(function (data) {
                        return complete();
                    })
                    .catch(function (err) {
                        console.log('Cannot send notification to Telegram!', err.message);

                    _this.telegramInstance.sendMessage({
                            parse_mode: 'HTML',
                            chat_id: _this.telegramApiKey,
                            text: str
                            // text: _this.htmlEntities(str)
                        })
                            .then(function (data) {
                                return complete();
                            })
                            .catch(function (err) {
                                console.log('Cannot send simple notification to Telegram! Token or access problem!', err.message);
                                return complete();
                            });

                        return complete();
                    });
            }
            else {
                console.error(str);
                return complete();
            }
        })
    }

    /**
     *
     * @param type
     * @param object
     * @returns {Promise<void>}
     */
    async exceptionNotify(type, object) {
        let _this = this;
        if (_this.telegramInstance) {

            let str = `<b>Exception!</b>\n`;

            str += `<b>ErrorMessage</b> ${object.message}\n`;
            // str += `</pre>`;
            // console.log(str);

            _this.telegramInstance.sendMessage({
                parse_mode: 'HTML',
                chat_id: _this.telegramApiKey,
                text: str
            })
                .then(function (data) {
                    // console.log(util.inspect(data, false, null));
                })
                .catch(function (err) {
                    console.log('Cannot send notification to TG', err.message);
                });
        }
    }



    /**
     *
     * @param query
     * @returns {Promise}
     */
    hiddenQuestion(query) {
        return new Promise((resolve, reject) => {
            let rl = readlineSync.question(query, {
                hideEchoBack: true
            });
            resolve(rl);
        });
    };

    /**
     *
     * @param queryre
     * @returns {Promise}
     */
    async createReadlineQuestion(query) {
        return new Promise((resolve, reject) => {
            let rl = readlineSync.question(query, {});
            resolve(rl);
        });
    }

    /**
     *
     * @returns {Promise}
     */
    async requestGwKey() {
        let query = "Gateway encryption key: ";
        return this.hiddenQuestion(query);
    }


    /**
     *
     * @param checkValue
     * @param fromError
     * @param checkValueParameter
     * @returns {Promise<*>}
     */
    async getEncryptionInstance(checkValue, fromError,checkValueParameter) {
        let encrypto;
        let inputKey;
        if (this.getArgv('key')) {
            console.warn('Used attribute-based secure key. Be careful. Only for testing. Not on production mode. ALL CONSOLE DATA - WILL LOGGED');
            if (fromError) {
                console.error('Used incorrect security key. Cannot continue operation. STOP', fromError);
                process.exit();
            }
            inputKey = this.getArgv('key');
        } else {
            if (fromError) {
                console.error(fromError);
                process.exit();
            }
            inputKey = await this.requestGwKey();
        }

        try {
            encrypto = new aes256(inputKey);
        } catch (e) {
            let error = new Error('Cannot decrypt key with error.' + e.message.toString());
            return this.getEncryptionInstance(checkValue, error, checkValueParameter);
        }

        if (checkValue) {
            try {
                encrypto.decrypt(checkValue)
            } catch (e) {
                console.error("Cannot decrypt private key for field: ",checkValueParameter);
                console.trace();
                console.log('process stopped');
                process.exit();

                return this.getEncryptionInstance(checkValue, true);
            }
        }

        return encrypto;

    }

    /**
     *
     * @param coinConfig
     * @param shutdown
     */
    watchFinallyException(coinConfig, shutdown) {
        let _this = this;

        shutdown=false;
        process.on('unhandledRejection', async (err) => {
            console.error('uncaughtException', err);
            await _this.notify('error', {
                operation: _this.UNHANDLED_ERROR,
                coin: coinConfig.name,
                transaction_id: "",
                transaction_hash: "",
                errorCode: err.errorCode,
                message: "Error caused. Please read logs"
            });
            if (shutdown) {
                console.error('Error catched & notified. SHUTDOWN', err.message);
                setTimeout(()=> {
                    process.exit()
                }, 10000);

            }
        })
    }

}

module.exports = new common();