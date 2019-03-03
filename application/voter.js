// web3.utils.hexToString('hex').replace(/[^ -~]+/g, "");


const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8545')

const fs = require('fs')
const dns = require('dns')
const BN = web3.utils.BN;

const max_num = web3.utils.toBN('115792089237316195423570985008687907853269984665640564039457584007913129639935')
const account_index = process.argv[2]


if (account_index > 99 || account_index < 0) {
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
	.then(() => {
		domain_token_contract.methods.approve(ddns_contract_address, tokens).send({
			from: web3.eth.defaultAccount,
			gas: 3000000
		})
		.then(() => {
			ddns_contract.methods.sendStakes(tokens).send({
				from: web3.eth.defaultAccount,
				gas: 3000000
			})
			.then(() => {
				console.log('stakes: ', tokens)
				account_flag = true
			})
			.catch((err) => {
				console.log('Cannot send stake', err)
			})
		})
		.catch((err) => {
			console.log('Cannot approve stake', err)
		})
	})
	.catch((err) => {
		console.log('Cannot supply stake', err)
	})
})
.catch((err) => {
	console.log('Cannot get accounts', err)
})




// web3.eth.getAccounts()
// .then((value) => {
// 	web3.eth.defaultAccount = value[account_index]
// 	console.log('the default account is account' + account_index + ':', web3.eth.defaultAccount)
// })
// .catch((err) => {
// 	console.log('Cannot get accounts', err)
// })
// .then(() => {
// 	domain_token_contract.methods.supplyDomainTokens(tokens).send({
// 		from: web3.eth.defaultAccount,
// 		gas: 3000000
// 	})
// })
// .catch((err) => {
// 	console.log('Cannot assign default account.', err)
// })
// .then(() => {
// 	domain_token_contract.methods.approve(ddns_contract_address, tokens).send({
// 		from: web3.eth.defaultAccount,
// 		gas: 3000000
// 	})
// })
// .catch((err) => {
// 	console.log('Cannot supply tokens', err)
// })
// .then(() => {
// 	ddns_contract.methods.sendStakes(tokens).send({
// 		from: web3.eth.defaultAccount,
// 		gas: 3000000
// 	})
// })
// .catch((err) => {
// 	console.log('Cannot approve stake', err)
// })
// .then(() => {
// 	console.log('stakes: ', tokens)
// 	account_flag = true
// })
// .catch((err) => {
// 	console.log('Cannot send stake', err)
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
	console.log('========================================NEW VOTING REQUEST========================================')
	if(account_flag == true && open_resolver_flag == true) {
		handle_request(event)
	}
	else{
		console.log('voter has not set up')
	}
})
.on('changed', (event) => {handle_request_changed(event)})
.on('error', (event) => {console.error})



async function handle_request(event) {
	let hash = event.returnValues.hash
	
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


		// console.log('***********************************************************************')
		// console.log('hash', hash)
		// console.log('account', web3.eth.defaultAccount)
		// console.log('key', i)
		// console.log('rand', rand.toString())	
		// console.log('totalStake', total_stake.toString())
		// console.log('stake', stake.toString())
		// console.log('value', max_num.div(total_stake).mul(stake).toString())
		// console.log('***********************************************************************')


		if(max_num.div(total_stake).mul(stake).gt(rand)) {
			keys.push(i)
		}
	}

	if(keys.length > 0) {
		console.log('committee member for voting: ', hash)
		console.log('stake percentage: ', (stake.toNumber() / total_stake.toNumber() * 100).toFixed(2), '%' )
		console.log('voting weight: ', keys.length)
	}
	else{
		console.log("not a committee member for voting: ", hash)
		console.log('stake percentage: ', (stake.toNumber() / total_stake.toNumber() * 100).toFixed(2), '%' )
	}
	
	return keys
}



function handle_IP_request(hash, voting_args, keys) {
	const domain = web3.utils.toAscii(voting_args.domain)
	console.log("IP request on domain: ", domain)

	// setTimeout(() => { dns.resolver4...... }, 1000)
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
	console.log('ownership claim request on domain: ', domain)

	setTimeout(() => {
		dns.resolveTxt(domain, (err, record) =>{
			if (!err) {
				let verifed = 'false'
				if(voting_args.sender.toLowerCase() == record[0][0].toLowerCase()) {
					verifed = 'true'
				}
				vote(hash, keys, [verifed])
			}
			else {
				console.log('retrieve TXT record error')
			}
		})
	}, 1000)
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
		console.log("vote: ", records)
		console.log('block number: ', receipt.blockNumber)
		console.log('gas used:', web3.utils.toBN(receipt.gasUsed).toString())
	})
	.then(() => {})
	.catch((error) => {
		console.log('Error: ', JSON.parse(error.message.substr(12, error.message.length)).message)
	})
}


