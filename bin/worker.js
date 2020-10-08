#!/usr/bin/env node




const _=require("lodash");
const config = require('../modules/config');
const deexdex=require("deexdex");
global.common=require("../modules/common");





let available_accounts = config.get('bot:accounts');
if (_.size(available_accounts)<2) {
    console.error(`but:account requires 2 or more accounts.`);
    process.exit();
}


let instanceName = common.getArgv('instance');
if (!instanceName) {
    console.error(`Parameter --instance is not set.`);
    process.exit();
}


if (!config.get(`bot:instances:${instanceName}`)) {
    console.error(`Cannot read: bot:instances:${instanceName}. Incorrect configuration`);
    process.exit();
}



global.logger = common.createLogger(instanceName);



logger.info("Process started");
let node=config.get(`bot:instances:${instanceName}:node`) || config.get(`bot:node`);
deexdex.connect(node).then(async()=>{



    if (config.get(`bot:instances:${instanceName}:fee_asset`)) {
        logger.info(`Connected to DEEX chain with custom fee asset: `+config.get(`bot:instances:${instanceName}:fee_asset`));
    } else {
        logger.info(`Connected to DEEX chain`);
    }




    let sellers=[];
    let buyers=[];

    _.each(config.get(`bot:instances:${instanceName}:accounts:seller`),(item)=>{
        sellers.push({
                instance:new deexdex(available_accounts[item]['login'], available_accounts[item]['key'], config.get(`bot:instances:${instanceName}:fee_asset`) || "DEEX"),
                login: available_accounts[item]['login']
            }

        );
    });

    _.each(config.get(`bot:instances:${instanceName}:accounts:buyer`),(item)=>{
        buyers.push(
            {
                instance: new deexdex(available_accounts[item]['login'], available_accounts[item]['key'], config.get(`bot:instances:${instanceName}:fee_asset`) || "DEEX"),
                login: available_accounts[item]['login']
            }


        );
    });


    logger.info(`-- Initial balances`);
    for await (const buyer of buyers) {
        let associatedBalances={};

        try {
            let balances=await buyer.instance.balances();
            _.each(balances, (row)=>{
                associatedBalances[row['asset']['symbol']]=row

            });
        } catch(e)
        {
            console.log('err',e);
        }



        let sellerAsset=config.get(`bot:instances:${instanceName}:sell:asset`);
        let buyerAsset=config.get(`bot:instances:${instanceName}:buy:asset`);

        let sellerAssetBalalanceData=associatedBalances[sellerAsset];
        let buyerAssetBalalanceData=associatedBalances[buyerAsset];
        let buyerFeeBalalanceData=associatedBalances["DEEX"];


        let reportData={

        };

        if (sellerAssetBalalanceData) {
            logger.info(`          Buy ${buyer.login}: ${sellerAssetBalalanceData['amount']/Math.pow(10,sellerAssetBalalanceData['asset']['precision'])} ${sellerAssetBalalanceData['asset']['symbol']}`);
        } else {
            logger.warn(`          Buy ${buyer.login}: 0 ${sellerAsset}`);
        }
        if (buyerAssetBalalanceData) {
            logger.info(`          Buy ${buyer.login}: ${buyerAssetBalalanceData['amount']/Math.pow(10,buyerAssetBalalanceData['asset']['precision'])} ${buyerAssetBalalanceData['asset']['symbol']}`);
        }

        if (buyerFeeBalalanceData) {
            logger.info(`          Buy ${buyer.login}: ${buyerFeeBalalanceData['amount']/Math.pow(10,buyerFeeBalalanceData['asset']['precision'])} ${buyerFeeBalalanceData['asset']['symbol']}`);
        } else {
            logger.warn(`          Buy ${buyer.login}: 0 DEEX`);
        }
    }


    for await (const seller of sellers) {
        let associatedBalances={};

        try {
            let balances=await seller.instance.balances();
            _.each(balances, (row)=>{
                associatedBalances[row['asset']['symbol']]=row

            });
        } catch(e)
        {
            console.log('err',e);
        }

        let sellerAsset=config.get(`bot:instances:${instanceName}:sell:asset`);
        let buyerAsset=config.get(`bot:instances:${instanceName}:buy:asset`);

        let sellerAssetBalalanceData=associatedBalances[sellerAsset];
        let buyerAssetBalalanceData=associatedBalances[buyerAsset];
        let buyerFeeBalalanceData=associatedBalances["DEEX"];


        let reportData={

        };

        if (sellerAssetBalalanceData) {
            logger.info(`          Seller ${seller.login}: ${sellerAssetBalalanceData['amount']/Math.pow(10,sellerAssetBalalanceData['asset']['precision'])} ${sellerAssetBalalanceData['asset']['symbol']}`);
        } else {
            logger.warn(`          Seller ${seller.login}: 0 ${sellerAsset}`);
        }
        if (buyerAssetBalalanceData) {
            logger.info(`          Seller ${seller.login}: ${buyerAssetBalalanceData['amount']/Math.pow(10,buyerAssetBalalanceData['asset']['precision'])} ${buyerAssetBalalanceData['asset']['symbol']}`);
        }

        if (buyerFeeBalalanceData) {
            logger.info(`          Seller ${seller.login}: ${buyerFeeBalalanceData['amount']/Math.pow(10,buyerFeeBalalanceData['asset']['precision'])} ${buyerFeeBalalanceData['asset']['symbol']}`);        } else {
            logger.warn(`          Seller ${seller.login}: 0 DEEX`);
        }

    }



    //init

    if (config.get(`bot:instances:${instanceName}:allow_cleanup`))
    {
        for await (const seller of sellers) {

            await new Promise(async (tick) => {
                let currentOrders = await seller.instance.orders();
                if (_.size(currentOrders)>0) {
                    logger.info(`Startup cleanup. Detected: ${_.size(currentOrders)} seller orders.`);
                }

                let chunks = _.chunk(currentOrders,10);

                for await (const chunk of chunks) {
                    let promises=[];

                    for await (const order of chunk) {
                        promises.push(
                            new Promise((accept,reject)=> {

                                let timer = setTimeout(() => {
                                    logger.error('Timeout. at sell operation.');
                                    return reject(new Error('Timeout'));
                                }, 15000);

                                seller.instance.cancelOrder(order['id']).then(()=>{
                                    clearTimeout(timer);
                                    return accept();
                                }).catch((e)=>{
                                    clearTimeout(timer);
                                    return reject(e);
                                })
                            })

                        );
                        logger.info(`Removing sell order with id: ${order['id']}`);
                    }


                    await Promise.all(promises).then(()=>{

                    }).catch((e)=>{
                        console.log(e);
                    })
                }

                return tick();
            })
        }


        for await (const buyer of buyers) {

            await new Promise(async (tick) => {
                let currentOrders;
                try {
                    currentOrders = await buyer.instance.orders();

                } catch(e) {
                    logger.error(`Cannot read orders. Returned error ${e.message}`);
                    return tick();
                }

                if (_.size(currentOrders)>0) {
                    logger.info(`Startup cleanup. Detected: ${_.size(currentOrders)} buyer orders.`);
                }

                let chunks = _.chunk(currentOrders,10);

                for await (const chunk of chunks) {
                    let promises=[];

                    for await (const order of chunk) {
                        promises.push(
                            new Promise((accept,reject)=> {

                                let timer = setTimeout(() => {
                                    logger.error('Timeout. at sell operation.');
                                    return reject(new Error('Timeout'));
                                }, 15000);

                                buyer.instance.cancelOrder(order['id']).then(()=>{
                                    clearTimeout(timer);
                                    return accept();
                                }).catch((e)=>{
                                    clearTimeout(timer);
                                    return reject(e);
                                })
                            })
                        );
                        logger.info(`Removing sell order with id: ${order['id']}`);
                    }


                    await Promise.all(promises).then(()=>{

                    }).catch((e)=>{
                        console.log('promise rejection',e);
                    })
                }

                return tick();
            })
        }

    }


    //init



    while(true)
    {

        await new Promise(async(round)=>{

            let sellerOrders=[];

            // let buyerOrders=[];




            //
            // for await (const buyer of buyers) {
            //     let currentOrders;
            //     try {
            //         currentOrders = await buyer.instance.orders();
            //         if (currentOrders) {
            //             buyerOrders=buyerOrders.concat(currentOrders);
            //         }
            //
            //     } catch(e) {
            //         logger.error(`Cannot read orders. Returned error ${e.message}`);
            //     }
            // }




            if (config.get(`bot:instances:${instanceName}:allow_sell`))
            {
                for await (const seller of sellers) {

                    await new Promise(async(tick)=>{

                        let maxAmount = parseFloat(config.get(`bot:instances:${instanceName}:sell:amountMax`));
                        let minAmount = parseFloat(config.get(`bot:instances:${instanceName}:sell:amountMin`));
                        let decimals = parseFloat(config.get(`bot:instances:${instanceName}:sell:decimals`));




                        let zeroed = Math.pow(10, decimals);
                        minAmount = minAmount * zeroed;
                        maxAmount = maxAmount * zeroed;


                        let currentOrders;
                        try {
                            currentOrders = await seller.instance.orders();

                        } catch(e) {
                            logger.error(`Cannot read orders. Returned error ${e.message}`);
                            return tick();
                        }

                        let tradeSlots= _.range(_.size(currentOrders), parseFloat(config.get(`bot:instances:${instanceName}:sell:opsLimit`)));
                        let tradeSlotsChunks=_.chunk(tradeSlots,parseInt(config.get(`bot:chunk_size`)));


                        if (_.size(tradeSlots)>0) {
                            logger.info(`Required to create ${_.size(tradeSlots)} slots`);
                            for await (const tradeSlotsChunk of tradeSlotsChunks) {
                                let promises=[];
                                for await (const slot of tradeSlotsChunk) {


                                    let randPercentage=(Math.floor(Math.random() * (300 - 10 + 1)) + 10 ) / Math.pow(10,3);
                                    let sellPrice=parseFloat(config.get(`bot:instances:${instanceName}:sell:price`));
                                    sellPrice=(sellPrice+sellPrice * randPercentage / 100).toFixed(6);


                                    let sellAmount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
                                    sellAmount = (sellAmount / zeroed).toFixed(decimals);

                                    logger.info(`Creating sell operation with params: sell:`+config.get(`bot:instances:${instanceName}:sell:asset`)+
                                        ", buy:"+config.get(`bot:instances:${instanceName}:buy:asset`)+", price:"
                                        +sellPrice
                                        +", sum:"+parseFloat(sellAmount));

                                    try {
                                        promises.push(
                                            new Promise((accept,reject)=>{

                                                let timer = setTimeout(()=>{
                                                    logger.error('Timeout. at sell operation.');
                                                    return reject(new Error('Timeout'));
                                                }, 15000);

                                                seller.instance.sell(
                                                    config.get(`bot:instances:${instanceName}:sell:asset`)
                                                    , config.get(`bot:instances:${instanceName}:buy:asset`)
                                                    ,parseFloat(sellAmount)
                                                    , sellPrice

                                                    , false).then(()=>{
                                                    clearTimeout(timer);
                                                    return accept()
                                                }).catch((e)=>{
                                                    clearTimeout(timer);
                                                    return reject(e);
                                                })


                                            }))

                                    }
                                    catch (e) {
                                        if (e.message.indexOf("insufficient balance")!==-1) {
                                            logger.error("Cannot create sell operation! No money! Notify!");
                                        } else {
                                            logger.error(`Failed to create sell operation! Message: ${e.message}`);
                                        }

                                    }




                                }

                                await Promise.all(promises).then((data)=>{
                                    // console.log('promise',data);
                                }).catch((data)=>{
                                    console.log('Sell errors',data)
                                });
                            }


                            return tick();

                        }


                        {
                            logger.info("Selling pull is full.");
                            return tick();
                        }





                    })

                }

            }




            for await (const seller of sellers) {
                let currentOrders;
                try {
                    currentOrders = await seller.instance.orders();
                    if (currentOrders) {
                        sellerOrders=sellerOrders.concat(currentOrders);
                    }

                } catch(e) {
                    logger.error(`Cannot read orders. Returned error ${e.message}`);
                }
            }


            if (config.get(`bot:instances:${instanceName}:allow_buy`))
            {
                for await (const buyer of buyers) {

                    await new Promise(async(tick)=>{

                        let maxAmount = parseFloat(config.get(`bot:instances:${instanceName}:buy:amountMax`));
                        let minAmount = parseFloat(config.get(`bot:instances:${instanceName}:buy:amountMin`));
                        let decimals = parseFloat(config.get(`bot:instances:${instanceName}:buy:decimals`));

                        let zeroed = Math.pow(10, decimals);
                        minAmount = minAmount * zeroed;
                        maxAmount = maxAmount * zeroed;




                        let currentOrders;
                        try {
                            currentOrders = await buyer.instance.orders();

                        } catch(e) {
                            logger.error(`Cannot read orders. Returned error ${e.message}`);
                            return tick();
                        }


                        let tradeSlots= _.range(_.size(currentOrders), parseFloat(config.get(`bot:instances:${instanceName}:buy:opsLimit`)));
                        let tradeSlotsChunks=_.chunk(tradeSlots,parseInt(config.get(`bot:chunk_size`)));

                        // let realTradeSlots= _.range(_.size(currentOrders)-parseFloat(config.get(`bot:instances:${instanceName}:buy:opsLimit`)), parseFloat(config.get(`bot:instances:${instanceName}:buy:tradingOpsLimit`)));
                        // let realTradeSlotsChunks=_.chunk(realTradeSlots,parseInt(config.get(`bot:chunk_size`)));


                        if (_.size(tradeSlots)>0) {
                            logger.info(`Required to create ${_.size(tradeSlots)} slots`);

                            for await (const tradeSlotsChunk of tradeSlotsChunks) {
                                let promises=[];
                                for await (const slot of tradeSlotsChunk) {

                                    let buyAmount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
                                    buyAmount = (buyAmount / zeroed).toFixed(decimals);

                                    let randPercentage=(Math.floor(Math.random() * (300 - 10 + 1)) + 10 ) / Math.pow(10,3);
                                    let buyPrice=parseFloat(config.get(`bot:instances:${instanceName}:sell:price`));
                                    buyPrice=(buyPrice+buyPrice * randPercentage / 100).toFixed(6);

                                    // sellerOrders

                                    // console.log('slot buy',slot);

                                    logger.info(`Creating buy operation with params: sell:`+config.get(`bot:instances:${instanceName}:sell:asset`)+
                                        ", buy:"+config.get(`bot:instances:${instanceName}:buy:asset`)+", price:"
                                        +buyPrice
                                        +", sum:"+parseFloat(buyAmount));

                                    try {

                                        promises.push(
                                            new Promise((accept,reject)=>{

                                                let timer = setTimeout(()=>{
                                                    logger.error('Timeout. at sell operation.');
                                                    return reject(new Error('timeout'));
                                                }, 15000);

                                                buyer.instance.buy(
                                                    config.get(`bot:instances:${instanceName}:sell:asset`)
                                                    , config.get(`bot:instances:${instanceName}:buy:asset`)
                                                    ,parseFloat(buyAmount)
                                                    , buyPrice

                                                    , false).then(()=>{
                                                    clearTimeout(timer);
                                                    return accept()
                                                }).catch((e)=>{
                                                    clearTimeout(timer);
                                                    return reject(e);
                                                })
                                            }))
                                    }
                                    catch (e) {
                                        if (e.message.indexOf("insufficient balance")!==-1) {
                                            logger.error("Cannot create buy operation! No money! Notify!");
                                        } else {
                                            logger.error(`Failed to create buy operation! Message: ${e.message}`);
                                        }

                                    }




                                }




                                ////////////////////////////////////
                                let buyAmount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
                                buyAmount = (buyAmount / zeroed).toFixed(decimals);

                                let randPercentage=(Math.floor(Math.random() * (300 - 10 + 1)) + 10 ) / Math.pow(10,3);
                                let buyPrice=parseFloat(config.get(`bot:instances:${instanceName}:sell:price`));
                                buyPrice=(buyPrice+buyPrice * randPercentage / 100).toFixed(6);

                                let randomSellOrder=false;
                                sellerOrders.forEach((item)=>{
//qqqq                                    item['sell_price']
                                });

                                if (randomSellOrder)
                                {


                                    logger.info(`Creating buy--- operation with params: sell:`+config.get(`bot:instances:${instanceName}:sell:asset`)+
                                        ", buy:"+config.get(`bot:instances:${instanceName}:buy:asset`)+", price:"
                                        +buyPrice
                                        +", sum:"+parseFloat(buyAmount));

                                    try {

                                        promises.push(
                                            new Promise((accept,reject)=>{

                                                let timer = setTimeout(()=>{
                                                    logger.error('Timeout. at sell operation.');
                                                    return reject(new Error('timeout'));
                                                }, 15000);

                                                buyer.instance.buy(
                                                    config.get(`bot:instances:${instanceName}:sell:asset`)
                                                    , config.get(`bot:instances:${instanceName}:buy:asset`)
                                                    ,parseFloat(buyAmount)
                                                    , buyPrice

                                                    , false).then(()=>{
                                                    clearTimeout(timer);
                                                    return accept()
                                                }).catch((e)=>{
                                                    clearTimeout(timer);
                                                    return reject(e);
                                                })
                                            }))
                                    }
                                    catch (e) {
                                        if (e.message.indexOf("insufficient balance")!==-1) {
                                            logger.error("Cannot create buy operation! No money! Notify!");
                                        } else {
                                            logger.error(`Failed to create buy operation! Message: ${e.message}`);
                                        }

                                    }

                                }

                                // console.log('slot buy',slot);

                                ////////////////////////////////////
                                await Promise.all(promises).then(()=>{

                                }).catch((data)=>{
                                    console.log('Buy err',data)
                                });
                            }


                            return tick();



                        } else
                        {
                            logger.info("Buy pull is full.");
                            return tick();
                        }



                    })

                }
            }


//////////////////////////

            // await new Promise(async(tick)=>{
            //
            //
            // let maxAmount = parseFloat(config.get(`bot:instances:${instanceName}:buy:amountMax`));
            // let minAmount = parseFloat(config.get(`bot:instances:${instanceName}:buy:amountMin`));
            // let decimals = parseFloat(config.get(`bot:instances:${instanceName}:buy:decimals`));
            //
            // let zeroed = Math.pow(10, decimals);
            // minAmount = minAmount * zeroed;
            // maxAmount = maxAmount * zeroed;
            //
            // let realTradeSlots= _.range(_.size(currentOrders)-parseFloat(config.get(`bot:instances:${instanceName}:buy:opsLimit`)), parseFloat(config.get(`bot:instances:${instanceName}:buy:tradingOpsLimit`)));
            // let realTradeSlotsChunks=_.chunk(realTradeSlots,parseInt(config.get(`bot:chunk_size`)));
            //
            //
            // if (_.size(realTradeSlots)>0) {
            //     logger.info(`Required to create ${_.size(realTradeSlots)} slots`);
            //
            //     for await (const realTradeSlotsChunk of realTradeSlotsChunks) {
            //         let promises=[];
            //         for await (const slot of realTradeSlotsChunk) {
            //
            //             let buyAmount = Math.floor(Math.random() * (maxAmount - minAmount + 1)) + minAmount;
            //             buyAmount = (buyAmount / zeroed).toFixed(decimals);
            //
            //             let randPercentage=(Math.floor(Math.random() * (300 - 10 + 1)) + 10 ) / Math.pow(10,3);
            //             let buyPrice=parseFloat(config.get(`bot:instances:${instanceName}:sell:price`));
            //             buyPrice=(buyPrice+buyPrice * randPercentage / 100).toFixed(6);
            //
            //             // console.log('slot buy',slot);
            //
            //             logger.info(`Creating buy operation with params: sell:`+config.get(`bot:instances:${instanceName}:sell:asset`)+
            //                 ", buy:"+config.get(`bot:instances:${instanceName}:buy:asset`)+", price:"
            //                 +buyPrice
            //                 +", sum:"+parseFloat(buyAmount));
            //
            //             try {
            //
            //                 promises.push(
            //                     new Promise((accept,reject)=>{
            //
            //                         let timer = setTimeout(()=>{
            //                             logger.error('Timeout. at sell operation.');
            //                             return reject(new Error('timeout'));
            //                         }, 15000);
            //
            //                         buyer.instance.buy(
            //                             config.get(`bot:instances:${instanceName}:sell:asset`)
            //                             , config.get(`bot:instances:${instanceName}:buy:asset`)
            //                             ,parseFloat(buyAmount)
            //                             , buyPrice
            //
            //                             , false).then(()=>{
            //                             clearTimeout(timer);
            //                             return accept()
            //                         }).catch((e)=>{
            //                             clearTimeout(timer);
            //                             return reject(e);
            //                         })
            //                     }))
            //             }
            //             catch (e) {
            //                 if (e.message.indexOf("insufficient balance")!==-1) {
            //                     logger.error("Cannot create buy operation! No money! Notify!");
            //                 } else {
            //                     logger.error(`Failed to create buy operation! Message: ${e.message}`);
            //                 }
            //
            //             }
            //
            //
            //
            //
            //         }
            //
            //         await Promise.all(promises).then(()=>{
            //
            //         }).catch((data)=>{
            //             console.log('Buy err',data)
            //         });
            //     }
            //
            //
            //     return tick();
            //
            //
            //
            // } else
            // {
            //     logger.info("Buy pull is full.");
            //     return tick();
            // }
            //
            //
            // });
///////////////////////

            // ping-pong

            for await (const buyer of buyers) {
                let associatedBalances = {};

                try {
                    let balances = await buyer.instance.balances();
                    _.each(balances, (row) => {
                        associatedBalances[row['asset']['symbol']] = row
                    });

                    let sellerAsset = config.get(`bot:instances:${instanceName}:sell:asset`);
                    // let buyerAsset=config.get(`bot:instances:${instanceName}:buy:asset`);


                    let buyerAssetBalalanceData = associatedBalances[sellerAsset];

                    if (buyerAssetBalalanceData) {

                        let amountToTransfer=buyerAssetBalalanceData['amount']/Math.pow(10,buyerAssetBalalanceData['asset']['precision']);
                        if (sellerAsset==="DEEX") {
                            amountToTransfer=amountToTransfer-200;
                        }

                        if (amountToTransfer>=parseFloat(config.get(`bot:instances:${instanceName}:buy:ping-pong-amount`))) {
                            let transferToSeller = sellers[0]['login'];
                            let amountToTransfer=buyerAssetBalalanceData['amount']/Math.pow(10,buyerAssetBalalanceData['asset']['precision']);
                            await buyer.instance.transfer(transferToSeller, sellerAsset, amountToTransfer, "");
                            logger.info(`Transfer from Buyer to Seller account: ${amountToTransfer} ${sellerAsset}`);
                        }
                    }


                } catch (e) {
                    console.log('err', e);
                }
            }


            for await (const seller of sellers) {
                let associatedBalances = {};

                try {
                    let balances = await seller.instance.balances();
                    _.each(balances, (row) => {
                        associatedBalances[row['asset']['symbol']] = row
                    });


                    let buyerAsset=config.get(`bot:instances:${instanceName}:buy:asset`);

                    let sellerAssetBalalanceData = associatedBalances[buyerAsset];


                    if (sellerAssetBalalanceData) {
                        let amountToTransfer=sellerAssetBalalanceData['amount']/Math.pow(10,sellerAssetBalalanceData['asset']['precision']);

                        if (buyerAsset==="DEEX") {
                            amountToTransfer=amountToTransfer-200;
                        }

                        if (amountToTransfer>=parseFloat(config.get(`bot:instances:${instanceName}:sell:ping-pong-amount`))) {
                            let transferToSeller = buyers[0]['login'];

                            await seller.instance.transfer(transferToSeller, buyerAsset, amountToTransfer, "");
                            logger.info(`Transfer from Seller to Buyer account: ${amountToTransfer} ${buyerAsset}`);
                        }
                    }


                } catch (e) {
                    console.log('err', e);
                }
            }




            let minWait=2;
            let maxWait=10;

            return setTimeout(round, Math.floor(Math.random() * (20000 - maxWait+ 1)) + minWait);

        })
    }


}).catch((e)=>{
    console.log('cannot connect to node',e);
});

