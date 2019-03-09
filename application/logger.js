const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8546')

const fs = require('fs')
const BN = web3.utils.BN;


const contract_info = JSON.parse(fs.readFileSync('../smart-contract/contract_info.json', 'utf8'))
const domain_token_contract_address = contract_info['domain_token_contract_address']
const domain_token_contract_abi = contract_info['domain_token_contract_abi']
const ddns_contract_address = contract_info['ddns_contract_address']
const ddns_contract_abi = contract_info['ddns_contract_abi']

const domain_token_contract = new web3.eth.Contract(domain_token_contract_abi, domain_token_contract_address)
const ddns_contract = new web3.eth.Contract(ddns_contract_abi, ddns_contract_address)



let voting_logs = {}
ddns_contract.events.NewRequest({
	filter: {},
	fromBlock: 'latest'
}, (err, event) => {
	if(err) {
		console.log('NEW REQUEST ERROR:', err)
	}
})
.on('data', (event) => {
	log_new_request(event)
})
.on('changed', (event) => {console.log('Changed', event.event, event.returnValues.hash)})
.on('error', (event) => {console.error})



ddns_contract.events.NewVoteForIP({
	filter: {},
	fromBlock: 'latest'
}, (err, event) => {
	if(err) {
		console.log('NEW VOTE ERROR:', err)
	}
})
.on('data', (event) => {
	log_new_vote_for_ip(event)
})
.on('changed', (event) => {console.log('Changed', event.event, event.returnValues.hash)})
.on('error', (event) => {console.error})




ddns_contract.events.NewVote({
	filter: {},
	fromBlock: 'latest'
}, (err, event) => {
	if(err) {
		console.log('NEW VOTE ERROR:', err)
	}
})
.on('data', (event) => {
	log_new_vote(event)
})
.on('changed', (event) => {console.log('Changed', event.event, event.returnValues.hash)})
.on('error', (event) => {console.error})




ddns_contract.events.VoteComplete({
	filter: {},
	fromBlock: 'latest'
}, (err, event) => {
	if(err) {
		console.log('VOTE COMPLETE ERROR:', err)
	}
})
.on('data', (event) => {
	log_vote_complete(event)
})
.on('changed', (event) => {console.log('Changed', event.event, event.returnValues.hash)})
.on('error', (event) => {console.error})




function log_new_request(event) {
	let hash = event.returnValues.hash
	voting_logs[hash] = {}
	voting_logs[hash].voter = []
	ddns_contract.methods.votingTable(hash).call()
	.then((voting_args) => {
		voting_logs[hash].request_type = (voting_args.requestType == '1') ? 'ip' : 'ownership'
		voting_logs[hash].domain = web3.utils.toAscii(voting_args.domain)
		voting_logs[hash].offer = voting_args.offer
		voting_logs[hash].total_stake = voting_args.totalStake
		return web3.eth.getBlock(event.blockHash)
	})
	.then((block) => {
		voting_logs[hash].start_time = block.timestamp
		return web3.eth.getTransactionReceipt(event.transactionHash)
	})
	.then((receipt) => {
		voting_logs[hash].request_gas = web3.utils.toBN(receipt.gasUsed).toString()
		export_voting_logs()
	})
	.catch((err) => {
		console.log('log_new_request error', err)
	})
}


function log_new_vote(event) {
	let hash = event.returnValues.hash
	let voter = {}
	voter.weight = web3.utils.toBN(event.returnValues.weight).toString()
	voter.verified = event.returnValues.verified
	web3.eth.getBlock(event.blockHash)
	.then((block) => {
		voter.timestamp = block.timestamp
		return web3.eth.getTransaction(event.transactionHash)
	})
	.then((tx) => {
		voter.address = tx.from
		return web3.eth.getTransactionReceipt(event.transactionHash)
	})
	.then((receipt) => {
		voter.gas = web3.utils.toBN(receipt.gasUsed).toString()
		return ddns_contract.methods.stakes(voter.address).call()
	})
	.then((stake) => {
		voter.stake = stake
		voting_logs[hash].voter.push(voter)
		export_voting_logs()
	})
	.catch((err) => {
		console.log('log_new_vote error', err)
	})
}


function log_new_vote_for_ip(event) {
	let hash = event.returnValues.hash
	let voter = {}
	voter.weight = web3.utils.toBN(event.returnValues.weight).toString()
	voter.ips = event.returnValues.ips.map((x) => {
		try {
			return web3.utils.hexToString(x).replace(/[^ -~]+/g, "")
		}
		catch (err) {
			return x
		}
	})
	web3.eth.getBlock(event.blockHash)
	.then((block) => {
		voter.timestamp = block.timestamp
		return web3.eth.getTransaction(event.transactionHash)
	})
	.then((tx) => {
		voter.address = tx.from
		return web3.eth.getTransactionReceipt(event.transactionHash)
	})
	.then((receipt) => {
		voter.gas = web3.utils.toBN(receipt.gasUsed).toString()
		return ddns_contract.methods.stakes(voter.address).call()
	})
	.then((stake) => {
		voter.stake = stake
		voting_logs[hash].voter.push(voter)
		export_voting_logs()
	})
	.catch((err) => {
		console.log('log_new_vote error', err)
	})
}



function log_vote_complete(event) {
	let hash = event.returnValues.hash
	web3.eth.getBlock(event.blockHash)
	.then((block) => {
		voting_logs[hash].end_time = block.timestamp
		export_voting_logs()
	})
}



function export_voting_logs() {
	let data = JSON.stringify(voting_logs, null, '\t')
	fs.writeFileSync('../../experiment/testnet/voting_logs.json', data)
}


