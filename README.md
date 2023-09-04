# plenty-sdk
To access Plenty Network DEX on Tezos with ease.

### API
1. `pairs_of (symbol) -> symbols`
- To get all pairs of a certain symbol.

2. `find_dex (token_in, token_out) -> {
    success: boolean, 
    price, 
    token_in_supply, 
    token_out_supply, 
    lp_token_supply, 
    lp_fees, 
    dex_contract
}`
- To find a DEX with its contract
