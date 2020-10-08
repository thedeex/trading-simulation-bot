
## Deex blockchaing trade simulation bot  
  
  
### Configuration  
``config/app_config.json``  
  

    {  
      "bot": {  
        "node": "wss://node6p.deexnodes.net/ws",  
        // Use local instance.  
        "chunk_size": 20,  
        "accounts": [  
     { "login": "login_bot1", "key": "___PRIVATE_ACTIVE_KEY" }, { "login": "login_bot2", "key": "___PRIVATE_ACTIVE_KEY" }, ],  
        "instances": {  
          "simple-trading-test1": {  
            "mode": "trading",  
            "allow_sell": true,  
            "allow_buy": true,  
            "allow_cleanup": true,  
            "sell": {  
              "ping-pong-amount": 1000,  
              "asset": "ASSET_NAME_TRT",  
              "opsLimit": 40,  
              "price": 1.05,  
              "amountMin": 10,  
              "amountMax": 60,  
              "decimals": 2  
            },  
            "buy": {  
              "tradingOpsLimit": 2,  
              "ping-pong-amount": 1000,  
              "asset": "ASSET_NAME_CBM",  
              "opsLimit": 70,  
              "price": 1.04,  
              "amountMin": 1,  
              "amountMax": 5,  
              "decimals": 2  
            },  
            "accounts": {  
              "seller": [0],  
              "buyer": [1]  
      }  
          },  
        }  
      }  
    }  

  
  

 - **simple-trading-test1** trading instance name (logging title)  
  - **allow_sell** Allow bot for creating sell orders  
  - **allow_buy** Allow bot for creating buy orders  
  - **allow_cleanup** Allow for destroy lots for instance market  
  - **sell ping pong amount **   Operation will send token for buyer account  
  - **sell asset** Asset name for sell  
  - **sell opsLimit** Limits operations for sell
  - ** sell price ** Price for lot
  - All operations has random amount (set minAmount& maxAmount)

### Requirements
- Nodejs (11 +)
- Ram 256MB+
- Stable network

### Setup
 - Clone source from github to your directory
 - Install requrements `npm install`

### Run
npm run bot
