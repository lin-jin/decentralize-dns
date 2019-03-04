// web3.utils.hexToString('hex').replace(/[^ -~]+/g, "");


const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8545')

const fs = require('fs')
const dns = require('dns')
const BN = web3.utils.BN;

const max_num = web3.utils.toBN('115792089237316195423570985008687907853269984665640564039457584007913129639935')
const account_index = process.argv[2]


if (parseInt(account_index) == NaN) {
	console.log('wrong account index')
	process.exit()
}


const contract_info = JSON.parse(fs.readFileSync('../smart-contract/contract_info.json', 'utf8'))
const domain_token_contract_address = contract_info['domain_token_contract_address']
const domain_token_contract_abi = contract_info['domain_token_contract_abi']
const ddns_contract_address = contract_info['ddns_contract_address']
const ddns_contract_abi = contract_info['ddns_contract_abi']


const domain_token_contract = new web3.eth.Contract(domain_token_contract_abi, domain_token_contract_address)
const ddns_contract = new web3.eth.Contract(ddns_contract_abi, ddns_contract_address)



let committeeSize
ddns_contract.methods.committeeSize().call()
.then((value) => {
	committeeSize = value
})
.catch((err) => {
	console.log('Cannot get committee size', err)
	process.exit()
})



let account_flag = false
let open_resolver_flag = false


const tokens = Math.floor(Math.random() * 10000)
web3.eth.getAccounts()
.then((value) => {
	web3.eth.defaultAccount = value[account_index]
	console.log('the default account is account' + account_index + ':', web3.eth.defaultAccount)
	domain_token_contract.methods.supplyDomainTokens(tokens).send({
		from: web3.eth.defaultAccount,
		gas: 3000000
	})
	.on('receipt', receipt => {
		domain_token_contract.methods.approve(ddns_contract_address, tokens).send({
			from: web3.eth.defaultAccount,
			gas: 3000000
		})
		.on('receipt', receipt => {
			ddns_contract.methods.sendStakes(tokens).send({
				from: web3.eth.defaultAccount,
				gas: 3000000
			})
			.on('receipt', receipt => {
				console.log('stakes: ', tokens)
				account_flag = true
			})
			.on('error', error => {
				console.log('Cannot send stake', err)
				process.exit()
			})
		})
		.on('error', receipt => {
			console.log('Approve token error')
			process.exit()
		})
	})
	.on('error', error => {
		console.log('Supply token error')
		process.exit()
	})

})
.catch((err) => {
	console.log('Cannot get accounts', err)
	process.exit()
})




// web3.eth.getAccounts()
// .then((value) => {
// 	web3.eth.defaultAccount = value[account_index]
// 	console.log('the default account is account' + account_index + ':', web3.eth.defaultAccount)

// 	console.log('supplying tokens')
// 	domain_token_contract.methods.supplyDomainTokens(tokens).send({
// 		from: web3.eth.defaultAccount,
// 		gas: 3000000
// 	})
// 	.then(() => {
// 		console.log('approving tokens')
// 		domain_token_contract.methods.approve(ddns_contract_address, tokens).send({
// 			from: web3.eth.defaultAccount,
// 			gas: 3000000
// 		})
// 		.then(() => {
// 			console.log('sending tokens')
// 			ddns_contract.methods.sendStakes(tokens).send({
// 				from: web3.eth.defaultAccount,
// 				gas: 3000000
// 			})
// 			.then(() => {
// 				console.log('stakes: ', tokens)
// 				account_flag = true
// 			})
// 			.catch((err) => {
// 				console.log('Cannot send stake', err)
// 			})
// 		})
// 		.catch((err) => {
// 			console.log('Cannot approve stake', err)
// 		})
// 	})
// 	.catch((err) => {
// 		console.log('Cannot supply stake', err)
// 	})
// })
// .catch((err) => {
// 	console.log('Cannot get accounts', err)
// })






let open_resolvers = fs.readFileSync('../../experiment/open_resolvers/open_resolver_geo.txt', 'utf-8').trim().split('\n')
let open_resolver = open_resolvers[Math.floor(Math.random() * open_resolvers.length)].trim().split('***').map((x) => x.trim())
open_resolvers = []

dns.setServers([open_resolver[0]])
dns.resolve4('www.dnsoneth.xyz', (err, records) => {
	if(!err && records[0] == '184.72.203.80') {
		console.log('open resolver is', open_resolver)
		open_resolver_flag = true
	}
	else {
		console.log('open resolver is not working')
		process.exit()
	}
})



ddns_contract.events.NewRequest({
	filter: {},
	fromBlock: 'latest'
}, (err, event) => {
	if(err) {
		console.log('NEW REQUEST ERROR: ', err)
	}
})
.on('data', (event) => {
	console.log('')
	if(account_flag == true && open_resolver_flag == true) {
		handle_request(event)
	}
	else{
		console.log('voter has not set up')
	}
})
.on('changed', (event) => {handle_request_changed(event)})
.on('error', (event) => {console.error})



let voting_logs = {}
async function handle_request(event) {
	let hash = event.returnValues.hash
	
	voting_logs[hash] = {}
	voting_logs[hash].hash = hash
	
	let voting_args = await ddns_contract.methods.votingTable(hash).call()
	let stake = await ddns_contract.methods.stakes(web3.eth.defaultAccount).call()
	
	let keys = self_selection(hash, voting_args, stake)
	
	if (keys.length > 0) {
		if (voting_args.requestType == 1) {
			handle_IP_request(hash, voting_args, keys)
		}
		if (voting_args.requestType == 2) {
			handle_claim_request(hash, voting_args, keys)
		}
	}

}



function self_selection(hash, voting_args, stake) {
	keys = []
	
	for (let i = 0; i < committeeSize; i++) {
		hex = web3.utils.soliditySha3(hash, web3.eth.defaultAccount, web3.utils.toBN(hash).add(web3.utils.toBN(i)))
		rand = web3.utils.toBN(hex)
		total_stake = web3.utils.toBN(voting_args.totalStake)
		stake = web3.utils.toBN(stake)

		if(max_num.div(total_stake).mul(stake).gt(rand)) {
			keys.push(i)
		}
	}

	if(keys.length > 0) {
		voting_logs.is_committee = true
	}
	else{
		voting_logs.is_committee = false
	}
	
	voting_logs[hash].voting_weight = keys.length
	voting_logs[hash].stake_percentage = (stake.toNumber() / total_stake.toNumber() * 100).toFixed(2) + '%'
	
	return keys
}



function handle_IP_request(hash, voting_args, keys) {
	const domain = web3.utils.toAscii(voting_args.domain)
	voting_logs[hash].domain = domain

	dns.resolve4(domain, (err, records) => {
		if (!err) {
			vote(hash, keys, records)
		}
		else {
			console.log('retrive A record error', err)
		}
	})
	
}



function handle_claim_request(hash, voting_args, keys) {
	const domain = web3.utils.toAscii(voting_args.domain)

	dns.resolveTxt(domain, (err, record) =>{
		if (!err) {
			let verifed = 'false'
			try {
				if(voting_args.sender.toLowerCase() == record[0][0].toLowerCase()) {
					verifed = 'true'
				}
			}
			catch(err) {}

			vote(hash, keys, [verifed])
		}
		else {
			console.log('retrieve TXT record error')
		}
	})
	
}



function vote(hash, keys, records) {
	candidates = records.map((x) => {
		return web3.utils.toHex(x).padEnd(66, '0')
	})

	ddns_contract.methods.vote(hash, keys, candidates).send({
		from: web3.eth.defaultAccount,
		gas:3000000
	})
	.on('receipt', (receipt) => {
		voting_logs[hash].votes = records
		voting_logs[hash].block_number = receipt.blockNumber
		voting_logs[hash].gas_used = web3.utils.toBN(receipt.gasUsed).toString()
	})
	.then(() => {})
	.catch((error) => {
		voting_logs[hash].error_msg = JSON.parse(error.message.substr(12, error.message.length)).message
	})
	.then(() => {
		console.log(voting_logs[hash])
	})
}


