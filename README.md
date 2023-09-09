# plenty-sdk
[![NPM](https://img.shields.io/npm/v/plenty-sdk.svg)](https://www.npmjs.org/package/plenty-sdk)
[![maintainability](https://img.shields.io/codeclimate/maintainability-percentage/thetrung/plenty-sdk?logo=code-climate&style=flat-square)](https://codeclimate.com/github/thetrung/plenty-sdk)

access Plenty Network DEX on Tezos with ease.

### API USAGE 
```javascript
    import * as plentySdk from "plenty-sdk"
    import * as tezallet from "tezallet"
    
    //
    // init tezallet w/ custom RPC_URL
    //
    const mnemonic = '...'
    tezallet.init_tezos_toolkit(tezallet.RPC_URL.Marigold_Mainnet)

    // create signer & use index[0]
    tezallet.create_signer(mnemonic, 0)

    // show debug info
    plentySdk.set_debug_info()

    //
    // swap: 27.7 PLY -> 0.091 CTez 
    //
    const swap_test = await plentySdk.swap_token_in(tezallet.toolkit, 
        'CTez', // Token A
        'PLY',  // Token B
        '89464',// Amount A
        true)   // is estimation or real swap ?

    // => expecting amount-out: 89060 
    console.log(`TEST_RESULT\n`,swap_test)
```

### NOTE
I made this in a morning to understand how this DEX work while waiting for other DEX like QuipuSwap upgrade its package deps. So eventually, after some days I come back to polish it to the point of stable and make it public. Real usage could be applied into my Tezos Tipbot name "Gonut_bot" on Telegram.

USE AT YOUR OWN RISK.
