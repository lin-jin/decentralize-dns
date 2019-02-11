// web3.utils.hexToString('hex').replace(/[^ -~]+/g, "");


const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8545')

const fs = require('fs')
const dns = require('dns')
const BigNumber = require('bignumber.js');

const max_num = new BigNumber('115792089237316195423570985008687907853269984665640564039457584007913129639935')
const account_index = process.argv[2]

if (isNaN(account_index) || account_index > 6 || account_index < 0) {
	console.log("wrong account index")
	process.exit()
}



const token_contract_addr = '0xdb328c5a3cee2a9d6e4bb92ea43b2228283261e5'
const token_contract_abi = JSON.parse(fs.readFileSync('../contract_info/token_contract_abi.json', 'utf8'))

const ddns_contract_addr = '0x3d760469a504bcb7329a8f11d538c271174c33fc'
const ddns_contract_abi = JSON.parse(fs.readFileSync('../contract_info/ddns_contract_abi.json', 'utf8'))

const token_contract = new web3.eth.Contract(token_contract_abi, token_contract_addr)
const ddns_contract = new web3.eth.Contract(ddns_contract_abi, ddns_contract_addr)



web3.eth.getAccounts((err, result) => {
	web3.eth.defaultAccount = result[account_index]
	console.log("the default account is account" + account_index + ":", web3.eth.defaultAccount)
})	


// ddns_contract.methods.committeeSize().call((err, result) => {
// 	const committeeSize = result
// })

// token_contract.methods.balanceOf(web3.eth.defaultAccount).call((err, result) => {
// 	if (!err) {
// 		token_contract.methods.approve(ddns_contract_addr, result).send({
// 		from: web3.eth.defaultAccount,
// 		gas:3000000
// 		}, (err, res) => {
// 			ddns_contract.methods.sendStakes(result).send({
// 				from: web3.eth.defaultAccount,
// 				gas:3000000
// 			}, (err, res) => {
// 				if (!err) {
// 					console.log("send stake", result)
// 					console.log("")
// 				}
// 				else {
// 					console.log(err)
// 				}
// 			})
// 		})
// 	}
// 	else {
// 		console.log("no balanceof", err)
// 	}


ddns_contract.events.NewRequest({fromBlock: 0})
	.on('data', (event) => {handle_request(event)})
	.on('changed', (event) => {handle_request_changed(event)})
	.on('error', (event) => {console.error})


async function handle_request(event) {
	let hash = event.returnValues.hash
	console.log(hash)
	
	let voting_args = await ddns_contract.methods.votingTable(hash).call()
	console.log(voting_args)
	let stake = await ddns_contract.methods.stakes(web3.eth.defaultAccount).call()
	console.log("stake: ", stake)
	
	let keys = self_selection(hash, voting_args, stake)
	
	if (keys.length > 0) {
		console.log("Selected as a committee member for voting", hash)
		if (voting_args.requestType == 1) {
			handle_record_request(hash, voting_args, keys)
		}
		if (voting_args.requestType == 2) {
			// handle_claim_request(hash, voting_args, keys)
		}
	}
	else {
		console.log("Not a committee member for voting", hash)
	}



	// ddns_contract.methods.votingTable(hash).call((err, voting_args) => {
	// 	console.log(voting_args)
	// 	ddns_contract.methods.stakes(web3.eth.defaultAccount).call((err, stake) => {
	// 		var keys = self_selection(hash, voting_args, stake)
	// 		if (keys.length > 0) {
	// 			console.log("Selected as a committee member for voting", hash)
	// 			if (voting_args.requestType == 1) {
	// 				handle_record_request(hash, voting_args, keys)
	// 			}
	// 			if (voting_args.requestType == 2) {
	// 				handle_claim_request(hash, voting_args, keys)
	// 			}
	// 		}
	// 		else {
	// 			console.log("Not a committee member for voting", hash)
	// 		}
	// 	})
	// })
}





// need to test *************************************************************
function self_selection(hash, voting_args, stake) {
	keys = [0]
	// for (let i = 0; i < committeeSize; i++) {
	// 	hex = web3.utils.soliditySha(hash, web3.eth.defaultAccount, i)
	// 	rand = new BN(hex.substring(2,66), 16)
	// 	total_stake = new BN(voting_args.totalStake, 10)
	// 	stake = new BN(stake, 10)
	// 	if(max_num.div(totalStake).mul(stake).gt(rand)) {
	// 		keys.push(i)
	// 	}
	// }
	
	return keys
}


function handle_record_request(hash, voting_args, keys) {
	const domain = web3.utils.toAscii(voting_args.domain)
	console.log("new record request on domain", domain)

	setTimeout(() => {
		dns.resolve4(domain, (err, records) => {
			if (!err) {
				vote(hash, keys, records)
			}
			else {
				console.log("retrive A record error", err)
			}
		})
	}, 2000)

}



// function handle_claim_request(hash, voting_args, keys) {
// 	const sender = voting_args.sender
// 	const domain = voting_args.domain
// 	const cost = voting_args.cost
// 	console.log("new ownership claim request on domain", domain)


// }



function vote(hash, keys, records) {
	candidates = records.map((x) => {
		return padding_bytes32(web3.utils.toHex(x))
	})

	ddns_contract.methods.vote(hash, keys, candidates).send({
		from: web3.eth.defaultAccount,
		gas:3000000
	}, (err, result) => {
		if (!err) {
			console.log("vote for", hash, candidates)
		}
		else {
			console.log(err)
		}
	})
}

function padding_bytes32(input) {
	return input.padEnd(66, '0')
}




