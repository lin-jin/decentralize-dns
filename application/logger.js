const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8545')

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
	ddns_contract.methods.votingTable(hash).call().then((voting_args) => {
		voting_logs[hash].request_type = (voting_args.requestType == '1') ? 'ip' : 'ownership'
		voting_logs[hash].domain = web3.utils.toAscii(voting_args.domain)
		voting_logs[hash].offer = voting_args.offer
		voting_logs[hash].total_stake = voting_args.totalStake
	})
	web3.eth.getBlock(event.blockHash).then((block) => {
		voting_logs[hash].start_time = block.timestamp
	})
 	web3.eth.getTransactionReceipt(event.transactionHash).then((receipt) => {
 		voting_logs[hash].request_gas = web3.utils.toBN(receipt.gasUsed).toString()
 	})
}



function log_new_vote(event) {
	let hash = event.returnValues.hash
	let voter = {}
	voter.weight = web3.utils.toBN(event.returnValues.weight).toString()
	voter.candidates = event.returnValues.candidates.map((x) => {
		return web3.utils.hexToString(x).replace(/[^ -~]+/g, "");
	})
	web3.eth.getBlock(event.blockHash).then((block) => {
		voter.timestamp = block.timestamp
		web3.eth.getTransaction(event.transactionHash).then((tx) => {
			voter.address = tx.from
			web3.eth.getTransactionReceipt(event.transactionHash).then((receipt) => {
				voter.gas = web3.utils.toBN(receipt.gasUsed).toString()
				voting_logs[hash].voter.push(voter)
			})
		})
	})
}



function log_vote_complete(event) {
	let hash = event.returnValues.hash
	web3.eth.getBlock(event.blockHash).then((block) => {
		voting_logs[hash].end_time = block.timestamp
		setTimeout(() => {console.log(JSON.stringify(voting_logs[hash], null, '\t'))}, 2000)
		
	})
}