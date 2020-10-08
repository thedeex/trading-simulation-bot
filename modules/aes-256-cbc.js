'use strict';
const crypto = require('crypto');

class aes_crypto {
    constructor(secret_key) {
        secret_key = secret_key + 'nt';
        this.IV_LENGTH = 16; //  AES = 16 bytes
        if (secret_key.length !== 32)
            throw new Error('aes_crypto error param init secret_key.length !== 30');
        this.ENCRYPTION_KEY = secret_key;
        this.algoritm = 'aes-256-cbc';
    }

    encrypt(text) {
        let iv = crypto.randomBytes(this.IV_LENGTH);
        let cipher = crypto.createCipheriv(this.algoritm, Buffer.from(this.ENCRYPTION_KEY), iv);
        let encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    decrypt(text) {
        if (typeof text !=='string') {
            throw new Error('Incorrect type of value. ');

        }
        let textParts = text.split(':');
        let iv = Buffer.from(textParts.shift(), 'hex');
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv(this.algoritm, Buffer.from(this.ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
}


module.exports = aes_crypto;