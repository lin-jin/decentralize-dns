const Web3 = require('web3')
const fs = require('fs')
const dns = require('dns')


const account_index = process.argv[2]

if (isNaN(account_index) || account_index > 6 || account_index < 0) {
	console.log("wrong account index")
	process.exit()
}

const web3 = new Web3('ws://127.0.0.1:8545')

const token_contract_addr = '0xbf3cb493b5989e866ac5392ec5ded7561d4437c7'
const token_contract_abi = JSON.parse(fs.readFileSync('../contract_info/token_contract_abi.json', 'utf8'))

const ddns_contract_addr = '0xea5d72734e6e4f6c8a57ab539c013bc32919c89d'
const ddns_contract_abi = JSON.parse(fs.readFileSync('../contract_info/ddns_contract_abi.json', 'utf8'))

const token_contract = new web3.eth.Contract(token_contract_abi, token_contract_addr)
const ddns_contract = new web3.eth.Contract(ddns_contract_abi, ddns_contract_addr)



web3.eth.getAccounts((err, result) => {
	web3.eth.defaultAccount = result[account_index]
	console.log("the default account is account" + account_index + ":", web3.eth.defaultAccount)
})




ddns_contract.events.NewUpdate({fromBlock: 0})
	.on('data', (event) => {handle_update(event)})
	.on('changed', (event) => {handle_update_changed(event)})
	.on('error', (event) => {console.error})

function handle_update(event) {

	const domain = event.returnValues.domain
	const record = event.returnValues.record
	var is_valid = false
	console.log("new update", domain, record)

	setTimeout(() => {
		dns.resolve4(domain, (err, result) => {
			if (!err) {
				if (result.includes(record)) {
					is_valid = true
				}
				vote_for_update(domain, is_valid)
			}
			else {
				console.log("retrive A record error", err)
			}
		})
	}, 2000)

}

function handle_update_changed(event) {
	console.log("handle_update_changed")
}

function vote_for_update(domain, is_valid) {
	const nounce = Math.random().toString()
	ddns_contract.methods.voteForUpdate(domain, nounce, is_valid).send({
		from: web3.eth.defaultAccount,
		gas: 3000000
	}, (err, result) => {
		if (!err) {
			console.log("vote for", domain, ":", is_valid)
		}
		else{
			console.log(err)
		}
	})
}





ddns_contract.events.NewOwnershipClaim({fromBlock: 0})
	.on('data', (event) => {handle_owership_claim(event)})
	.on('changed', (event) => {handle_ownership_claim_changed(event)})
	.on('error', (event) => {console.error})



function handle_owership_claim(event) {

	const proposer = event.returnValues.proposer
	const domain = event.returnValues.domain
	var is_valid = false
	console.log("new_ownership_claim", proposer, domain)

	setTimeout(() => {
		dns.resolveTxt(domain, (err, result) => {
			if (!err) {
				if (result[0][0] == proposer) {
					is_valid = true
				}
			vote_for_ownership(domain, is_valid)
			}
			else {
				console.log("retrieve TXT error", err)
			}
		})
	}, 2000)

}

function handle_owership_claim_changed(event) {
	console.log("handle_ownership_claim_changed")

}

function vote_for_ownership(domain, is_valid) {
	const nounce = Math.random().toString()
	ddns_contract.methods.voteForOwnership(domain, nounce, is_valid).send({
		from: web3.eth.defaultAccount,
		gas: 3000000
	}, (err, result) => {
		if (!err) {
			console.log("vote for", domain, ":", is_valid)
			console.log("tx_hash", result)
		}
		else {
			console.log(err)
		}
	})
}
// token_contract.events.Transfer({fromBlock: 0})
// 	.on('data', (event) => {handle_transfer_data(event)})
// 	.on('changed', (event) => {handle_transfer_changed(event)})
// 	.on('error', (event) => {console.error})


// token_contract.events.Approval({fromBlock: 0})
// 	.on('data', (event) => {handle_approval_data(event)})
// 	.on('changed', (event) => {handle_approval_changed(event)})
// 	.on('error', (event) => {console.error})





// function handle_transfer_data(event) {
	
// 	const event_name = event.event
// 	const return_value = event.returnValues

// 	console.log(event_name)
// 	console.log(return_value)
	
// }

// function handle_transfer_changed(event) {
// 	console.log("handle_transfer_changed")
// }



// function handle_approval_data(event) {
// 	const event_name = event.event
// 	const return_value = event.returnValues


// 	console.log(event_name)
// 	console.log(return_value)
// }


// function handle_approval_changed(event) {
// 	console.log("handle_approval_changed")
// }





