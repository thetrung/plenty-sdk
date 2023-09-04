import { BigNumber } from 'bignumber.js'
import * as tezallet  from 'tezallet'

let IS_DEBUG = false

export const set_debug_info = () => {
    IS_DEBUG = !IS_DEBUG
    console.log({IS_DEBUG: IS_DEBUG})
    return IS_DEBUG
}

export const get_data = async (link) => {
    let res = await fetch(link)
    if (res.ok) {
        let data = JSON.parse(await res.text())
        // console.log(data)
        return data
    }
}

/**
 * @description get pools of Plenty Network.
 * @return pools data.
 */
export const get_pools = async () => {
    const tokens = await get_data('https://config.mainnet.plenty.network/tokens')
    if(!tokens) throw new Error(`can't fetch tokens`)
    return tokens
}

/**
 * @description find pairs of a token in Plenty pools
 * @param {*} pools :list - available pools
 * @param {*} token :string - token to find pairs
 * @returns list of pairs
 */
export const pairs_of = (pools, token) => {
    const result = pools[token]
    if (result) {
        console.log(`found pairs:`, result.pairs) 
        return result.pairs // as list [...]
    }
    else {
        console.log(`pairs not found.`)
        return null
    }
}

/**
 * @description Find a Dex to swap token A -> token B.
 * @param {*} token_in :string - token to swap-in.
 * @param {*} token_out :string - token receive after swap.
 * @returns DEX data
 */
export const find_dex = async (token_in, token_out) => {
    /**
     * FINDING DEX
     */
    const pools = await get_data('https://config.mainnet.plenty.network/pools')

    let dex = Object.values(pools).find(pool =>
        (pool.token1.symbol == token_in && pool.token2.symbol == token_out) ||
        (pool.token1.symbol == token_out && pool.token2.symbol == token_in))
    return dex
}

/**
 * @description fetch supply of given DEX for token in/out.
 * @param {*} dex :list - dex data - which can be fetched with find_dex ()
 * @param {*} token_in :string - symbol to swap-in
 * @param {*} token_out :string - symbol to swap-out
 * @returns supply of liquidity pool, tokens along with fees & price.
 */
export const get_supply = async (dex, token_in, token_out) => {
    if (dex) {
        // log 
        if(IS_DEBUG) console.log(`found DEX: [${dex.address}],dex`)
        const dex_contract = dex.address
        /**
         * CHECK SUPPLY 
         */
        let storage = await fetch(`https://api.tzkt.io/v1/contracts/${dex.address}/storage`)

        if (storage.ok) {
           const supply = JSON.parse(await storage.text())
            if(IS_DEBUG) console.log(supply)

            const token1_pool = new BigNumber(supply.token1_pool)
            const token2_pool = new BigNumber(supply.token2_pool)
            const total_supply = new BigNumber(supply.totalSupply)
            const lp_fees = new BigNumber(supply.lpFee).dividedBy(new BigNumber(10).pow(dex.lpToken.decimals))

            let token_in_supply = new BigNumber(0)
            let token_out_supply = new BigNumber(0)
            let lp_token_supply = total_supply
            let token_in_decimals = 0
            let token_out_decimals = 0

            switch (token_out) {
                case dex.token2.symbol:
                    token_out_decimals = dex.token2.decimals
                    token_in_decimals = dex.token1.decimals
                    token_out_supply = token2_pool
                    token_in_supply = token1_pool
                    break

              case dex.token1.symbol:
                    token_out_decimals = dex.token1.decimals
                    token_in_decimals = dex.token2.decimals
                    token_out_supply = token1_pool
                    token_in_supply = token2_pool
                    break

                default: console.log(`can't match ${token_out} symbol.`); break
            }

            // div by decimals :
            token_in_supply = token_in_supply.dividedBy(new BigNumber(10).pow(token_in_decimals))
            token_out_supply = token_out_supply.dividedBy(new BigNumber(10).pow(token_out_decimals))
            lp_token_supply = lp_token_supply.dividedBy(new BigNumber(10).pow(dex.lpToken.decimals))
            // price :
            const price = token_out_supply.dividedBy(token_in_supply)

            // summary :
            const result = {
                success: true,
                price,
                token_in_supply,
                token_out_supply,
                lp_token_supply,
                lp_fees,
                dex_contract
            }
            // log :
            if(IS_DEBUG) console.log(`[get_supply] `, result)

            // ret 
            return result
        }
    }
    else {
        console.log(`can't find pair ${token_in}-${token_out}`)
        return { success: false }
    }
}

/**
 * @description swap FA1.2 token-token within Plenty Network pools. 
 * @param {*} address_recipient string - often user tezos address or sender.
 * @param {*} address_dex :string - dex address of a given pool.
 * @param {*} address_token_in :string - contract address of token to swap-in.
 * @param {*} address_token_out :string - contract address of token to swap-out.
 * @param {*} amount_in :nat - amount of token to swap-in.
 * @param {*} amount_out :nat - amount of token to swap-out.
 * @param {*} slippage :number - 0.5% by default. 
 * @param {*} token_out_id :number - 0 by default.
 */
export const swap_tokens = async (
    toolkit,
    address_dex, 
    address_token_in, 
    address_token_out,
    amount_in, amount_out,
    is_estimation = false,  
    token_out_id = 0) => {
    
    if(IS_DEBUG) console.log(`\n[swap_tokens]`)
    
    // get address :
    const address_recipient = await toolkit.signer.publicKeyHash()
    if(IS_DEBUG){
        console.log(`\nSOURCE\n`, {source: address_recipient})
        console.log(`\nCONTRACTS\n`,{
           dex: address_dex,
           address_token_in: address_token_in
        })
    }
    const contract_dex = await toolkit.wallet.at(address_dex)
    const contract_token_in = await toolkit.wallet.at(address_token_in)
    // check on available contracts :
    if(!contract_dex || !contract_token_in) {
        const message = {success: false, 
            error: `error: can't fetch contracts of DEX & token-in.`}
        console.error(message)
        return message
    }
    // check on valid Swap(..) methods :
    if(!contract_dex.methods.Swap || !contract_token_in.methods.approve){
        const message = {success: false, 
            error: `error: contracts doesn't have approve(..) or Swap(..) method.`}
        console.error(message)
        return message
    }
    // approve ( else "Allowance" error will occurs. )
    const op_approve = await contract_token_in.methods.approve(
        address_dex, // "spender:address": sender/caller address.
        amount_in    // "value:nat": unsigned BigInt.
    ).toTransferParams()
    if(IS_DEBUG) console.log(`[swap_tokens] approve(..)`,op_approve)

    // swap (...)
    const op_swap = await contract_dex.methods.Swap(
        amount_out,         // MinimumTokenOut:nat - Unsigned BigInt, no point.
        address_recipient,  // recipient:address - sender/caller address
        address_token_out,  // requiredTokenAddress: address - swap-out-contract.
        token_out_id,       // requiredTokenId: 0 by default.
        amount_in           // tokenAmountIn: nat
    ).toTransferParams()
    if(IS_DEBUG) console.log(`[swap_tokens] Swap(..)`,op_swap)

    // batch (operations..)
    const TRANSACTION = "transaction"
    let batch_ops = []
    batch_ops.push({ kind: TRANSACTION, ...op_approve })
    batch_ops.push({ kind: TRANSACTION, ...op_swap })
    if(IS_DEBUG) console.log(`[swap_tokens] batch_ops: `,batch_ops)
    
    // errors 
    let not_revealed = false
    let not_enough_tez = false
    let not_enough_balance = false

    // estimate approve + Swap
    const limits = await toolkit.estimate
    .batch(batch_ops)
    .then(limit => limit)
    .catch(err => {
        console.error(`[swap_tokens] ERROR on estimate.batch(..)`,err.message)
        const err_m = err.message
        not_revealed = err_m.includes("reveal")
        not_enough_tez = err_m.includes("storage_exhausted")
        not_enough_balance = 
            err_m.includes("subtraction_underflow")
            || err_m.includes("balance_too_low")
            || err_m.includes("NotEnoughBalance")
        const message = {success: false, 
            error: err.message}
        console.error(message)
        return message
    })
    if(IS_DEBUG) console.log(`\nESTIMATE\n`, limits ? limits : 'error.')
    if(!limits) return undefined // can't proceed with error.

    // add gas & storage fees limits : 
    const limited_fees_batch = [];
    if (limits !== undefined) {
        batch_ops.forEach((op, index) => {
            // summary fees :
            const gasLimit = limits[index].gasLimit
            const storageLimit = limits[index].storageLimit
            const feesLimit = gasLimit + storageLimit
            // log to check in case Tx didn't pass :
            console.log(`[batch_op] ` + 
            `${batch_ops[index].parameter.entrypoint}(..) = ${feesLimit}`)
            // push back to batch :
            limited_fees_batch.push({...op, gasLimit, storageLimit})
        })
        // add total fees to match with balance :
        const max_fees = limited_fees_batch[0].gasLimit +  
        limited_fees_batch[0].storageLimit + 
        limited_fees_batch[1].gasLimit + 
        limited_fees_batch[1].storageLimit
        // send back estimation :
        if(is_estimation) {

            if(IS_DEBUG) console.log(`\nGAS_LIMIT & STORAGE_LIMIT\n`, {
                max_fees: max_fees,
                op_approve: { 
                    GAS_LIMIT: limited_fees_batch[0].gasLimit, 
                    STORAGE_LIMIT: limited_fees_batch[0].storageLimit
                },
                op_swap: { 
                    GAS_LIMIT: limited_fees_batch[1].gasLimit, 
                    STORAGE_LIMIT: limited_fees_batch[1].storageLimit
                }
            })
        // }
            return {
                success: true,
                max_fees: max_fees,
                detailed_batch: limited_fees_batch
            }
        } else {
            
            // show executing batch :
            if(IS_DEBUG) console.log(`EXECUTE\n`,limited_fees_batch)
            
            // execute 
            const op = await toolkit.batch(limited_fees_batch).send()
            
            // op_hash to check in log :
            if(IS_DEBUG) console.log(`OP_HASH:\n`, {hash: op.hash})

            // feedback
            return { 
                success: true, 
                hash: op.hash,
                max_fees: max_fees
            }
        }
    } else {
        console.error(`[swap_tokens] can't estimate batches > can't update gas/fees limits.`)
        return undefined
    }
}

/**
 * @description Swap token A -> B with amount in [nat]
 * @param {*} toolkit :instance - TezosToolkit instance.
 * @param {*} token_in :string - symbol of swap-in token.
 * @param {*} token_out :string - symbol of swap-out token.
 * @param {*} amount_token_in :nat - amount of token to swap-in.
 * @param {*} is_estimation :boolean - is estimation or swapping now ? (true by default)
 * @param {*} slippage :number - slippage allowed on DEX (0.5% by default)
 * @returns a operations list of [estimation or execution hash].
 */
export const swap_token_in = async (toolkit, 
    token_in, token_out, 
    amount_token_in, 
    is_estimation = true,
    slippage = 0.005) => {
    //
    // Process 
    //
    // 1. we fetch all pools for possible trading pairs 
    const pools = await get_pools()
    if( !pools[token_in] || 
        !pools[token_out] ||
        !pools[token_in].address || 
        !pools[token_out].address){
        const message = {success: false, error: `can't find pool for ${token_in}/${token_out}`}
        console.error(message)
        return message
    }
    const address_token_in = pools[token_in].address
    const address_token_out = pools[token_out].address
    
    // 2. we find which dex can execute the trade for each pair 
    const dex = await find_dex(token_in, token_out)
    if(!dex){
        const message = {success: false, error: `can't find DEX for ${token_in}/${token_out}`}
        console.error(message)
        return message
    }

    // 3. we get supply, price/ratio, fees, of tokens & LP
    const supply = await get_supply(dex, token_in, token_out)
    if(!supply){
        const message = {success: false, error: `can't find supply for ${token_in}/${token_out}`}
        console.error(message)
        return message
    }

    // 4. compute amount in/out by price from (2) + slippage 
    const decimals_in = new BigNumber(10).pow(pools[token_in].decimals)
    const decimals_out = new BigNumber(10).pow(pools[token_out].decimals)
    const amount_token_out = new BigNumber(amount_token_in)
    .dividedBy(decimals_in)
    .multipliedBy(supply.price)
    .multipliedBy(decimals_out)
    .multipliedBy(1-slippage)
    .decimalPlaces(0,1)
    .toNumber()

    // 5. log params to double check in terminal :
    console.log(`\n[swap_token_in]\n`,{
        pair : token_in + `/` + token_out,
        foundDex : dex.address,
        addressTokenIn : address_token_in,
        addressTokenOut : address_token_out,
        tokenAmountIn : amount_token_in,
        minAmountOut : amount_token_out,
        isEstimation : is_estimation
    })

    // 6. call swap :
    return swap_tokens(
        toolkit,
        dex.address,
        address_token_in, 
        address_token_out,
        amount_token_in, 
        amount_token_out, 
        is_estimation)
}

export default {}