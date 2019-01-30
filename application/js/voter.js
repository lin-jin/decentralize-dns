// web3.utils.hexToString('hex').replace(/[^ -~]+/g, "");


const Web3 = require('web3')
const fs = require('fs')
const dns = require('dns')


const account_index = process.argv[2]

if (isNaN(account_index) || account_index > 6 || account_index < 0) {
	console.log("wrong account index")
	process.exit()
}

const web3 = new Web3('ws://127.0.0.1:8545')

const token_contract_addr = '0xe394b960F825d4b3B8BBe413BfA2da6771f83077'
const token_contract_abi = JSON.parse(fs.readFileSync('../contract_info/token_contract_abi.json', 'utf8'))

const ddns_contract_addr = '0xa49b4b75798e4bddb832d17104a355ac063478fc'
const ddns_contract_abi = JSON.parse(fs.readFileSync('../contract_info/ddns_contract_abi.json', 'utf8'))

const token_contract = new web3.eth.Contract(token_contract_abi, token_contract_addr)
const ddns_contract = new web3.eth.Contract(ddns_contract_abi, ddns_contract_addr)



web3.eth.getAccounts((err, result) => {
	web3.eth.defaultAccount = result[account_index]
	console.log("the default account is account" + account_index + ":", web3.eth.defaultAccount)
	token_contract.methods.balanceOf(web3.eth.defaultAccount).call((err, result) => {
		token_contract.methods.approve(ddns_contract_addr, result).send({
			from: web3.eth.defaultAccount,
			gas:3000000
		}, (err, res) => {
			ddns_contract.methods.sendStakes(result).send({
				from: web3.eth.defaultAccount,
				gas:3000000
			}, (err, res) => {
				if (!err) {
					console.log("send stake", result)
					console.log("")
				}
				else {
					console.log(err)
				}
			})
		})
	})
})	




ddns_contract.events.NewRequest({fromBlock: 0})
	.on('data', (event) => {handle_request(event)})
	.on('changed', (event) => {handle_request_changed(event)})
	.on('error', (event) => {console.error})


function handle_request(event) {
	const hash = event.returnValues.hash
	ddns_contract.methods.votingTable(hash).call((err, voting_args) => {
		
		console.log(voting_args)
		
		var keys = self_selection(hash)
		if (keys.length > 0) {
			console.log("Selected as a committee member for voting", hash)
			if (voting_args.requestType == 1) {
				handle_record_request(hash, voting_args, keys)
			}
			if (voting_args.requestType == 2) {
				handle_claim_request(hash, voting_args, keys)
			}
		}
		else {
			console.log("Not a committee member for voting", hash)
		}
	})
}



function self_selection(hash) {


	keys = ['0']
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



function handle_claim_request(hash, voting_args, keys) {
	const sender = voting_args.sender
	const domain = voting_args.domain
	const cost = voting_args.cost
	console.log("new ownership claim request on domain", domain)


}



function vote(hash, keys, candidates) {
	candidates = candidates.map((x) => {
		return web3.utils.toHex(x)
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


// function handle_request(event) {

// 	const domain = event.returnValues.domain
// 	const record = event.returnValues.record
// 	var is_valid = false
// 	console.log("new update", domain, record)

// 	setTimeout(() => {
// 		dns.resolve4(domain, (err, result) => {
// 			if (!err) {
// 				if (result.includes(record)) {
// 					is_valid = true
// 				}
// 				vote_for_update(domain, is_valid)
// 			}
// 			else {
// 				console.log("retrive A record error", err)
// 			}
// 		})
// 	}, 2000)

// }

// function handle_request_changed(event) {
// 	console.log("handle_update_changed")
// }



// function vote_for_update(domain, is_valid) {
// 	const nounce = Math.random().toString()
// 	ddns_contract.methods.voteForUpdate(domain, nounce, is_valid).send({
// 		from: web3.eth.defaultAccount,
// 		gas: 3000000
// 	}, (err, result) => {
// 		if (!err) {
// 			console.log("vote for", domain, ":", is_valid)
// 		}
// 		else{
// 			console.log(err)
// 		}
// 	})
// }





// function handle_owership_claim(event) {

// 	const proposer = event.returnValues.proposer
// 	const domain = event.returnValues.domain
// 	var is_valid = false
// 	console.log("new_ownership_claim", proposer, domain)

// 	setTimeout(() => {
// 		dns.resolveTxt(domain, (err, result) => {
// 			if (!err) {
// 				if (result[0][0] == proposer) {
// 					is_valid = true
// 				}
// 			vote_for_ownership(domain, is_valid)
// 			}
// 			else {
// 				console.log("retrieve TXT error", err)
// 			}
// 		})
// 	}, 2000)

// }

// function handle_owership_claim_changed(event) {
// 	console.log("handle_ownership_claim_changed")

// }

// function vote_for_ownership(domain, is_valid) {
// 	const nounce = Math.random().toString()
// 	ddns_contract.methods.voteForOwnership(domain, nounce, is_valid).send({
// 		from: web3.eth.defaultAccount,
// 		gas: 3000000
// 	}, (err, result) => {
// 		if (!err) {
// 			console.log("vote for", domain, ":", is_valid)
// 			console.log("tx_hash", result)
// 		}
// 		else {
// 			console.log(err)
// 		}
// 	})
// }





