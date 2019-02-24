// web3.utils.hexToString('hex').replace(/[^ -~]+/g, "");


const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8545')

const fs = require('fs')
const dns = require('dns')
const BN = web3.utils.BN;

const max_num = web3.utils.toBN('115792089237316195423570985008687907853269984665640564039457584007913129639935')
const account_index = process.argv[2]
// const tokens = process.argv[3]

if (isNaN(account_index) || account_index > 10 || account_index < 0) {
	console.log("wrong account index")
	process.exit()
}



const token_contract_addr = '0xe78a0f7e598cc8b0bb87894b0f60dd2a88d6a8ab'
const token_contract_abi = JSON.parse(fs.readFileSync('../contract_info/token_contract_abi.json', 'utf8'))

const ddns_contract_addr = '0x5b1869d9a4c187f2eaa108f3062412ecf0526b24'
const ddns_contract_abi = JSON.parse(fs.readFileSync('../contract_info/ddns_contract_abi.json', 'utf8'))

const token_contract = new web3.eth.Contract(token_contract_abi, token_contract_addr)
const ddns_contract = new web3.eth.Contract(ddns_contract_abi, ddns_contract_addr)



const tokens = Math.floor(Math.random() * 10000)
web3.eth.getAccounts()
.then((value) => {
	web3.eth.defaultAccount = value[account_index]
	console.log("the default account is account" + account_index + ":", web3.eth.defaultAccount)
})
.catch((err) => {
	console.log('Cannot get accounts', err)
})
.then(() => {
	token_contract.methods.supplyDomainTokens(tokens).send({
		from: web3.eth.defaultAccount,
		gas: 3000000
	})
})
.catch((err) => {
	console.log('Cannot assign default account.', err)
})
.then(() => {
	console.log('Supplied tokens')
	token_contract.methods.approve(ddns_contract_addr, tokens).send({
		from: web3.eth.defaultAccount,
		gas: 3000000
	})
})
.catch((err) => {
	console.log('Cannot supply tokens', err)
})
.then(() => {
	console.log('Approved tokens')
	ddns_contract.methods.sendStakes(tokens).send({
		from: web3.eth.defaultAccount,
		gas: 3000000
	})
})
.catch((err) => {
	console.log('Cannot approve stake', err)
})
.then(() => {
	console.log('Sent stake')
	console.log('Voter initialization is complete')
})
.catch((err) => {
	console.log('Cannot send stake', err)
})





let committeeSize
ddns_contract.methods.committeeSize().call()
.then((value) => {
	committeeSize = value
})
.catch((err) => {
	console.log('Cannot get committee size', err)
})



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

}





function self_selection(hash, voting_args, stake) {
	keys = []
	
	for (let i = 0; i < committeeSize; i++) {
		hex = web3.utils.soliditySha3(hash, web3.eth.defaultAccount, i)
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

	console.log('keys', keys)
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
		return web3.utils.toHex(x).padEnd(66, '0')
	})

	ddns_contract.methods.vote(hash, keys, candidates).send({
		from: web3.eth.defaultAccount,
		gas:3000000
	})
	.on('receipt', (receipt) => {
		console.log('block number: ', receipt.blockNumber)
		console.log('gas used:', web3.utils.toBN(receipt.gasUsed).toString())
	})	
	.then(() => {
		console.log("vote for", hash, candidates)
	}, err => {
		console.log(err)
	}) 
}





