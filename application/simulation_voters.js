// web3.utils.hexToString('hex').replace(/[^ -~]+/g, "");


const Web3 = require('web3')
const web3 = new Web3('ws://127.0.0.1:8546')

const fs = require('fs')
const { Resolver } = require('dns').promises
const BN = web3.utils.BN;

const max_num = web3.utils.toBN('115792089237316195423570985008687907853269984665640564039457584007913129639935')
const voter_num = process.argv[2]



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


let open_resolvers = fs.readFileSync('../../experiment/open_resolvers/open_resolver_geo.txt', 'utf-8').trim().split('\n')

let voters = []
web3.eth.getAccounts()
.then((accounts) => {
	addresses = accounts.slice(0, voter_num)
	addresses.forEach((address, index) => {
		ddns_contract.methods.stakes(address).call()
		.then((stakes) => {
			if (stakes == 0) {
				init_stakes(address, index)
			}
			else {
				voter = {address: address, open_resolver: open_resolvers[index].trim().split('***')[0].trim()}
				voters.push(voter)
			}
		})
	})
})
.catch((err) => {
	console.log('Cannot get accounts', err)
	process.exit()
})




function init_stakes(address, index) {
	let stakes = Math.floor(Math.random() * 90000) + 10000
	domain_token_contract.methods.supplyDomainTokens(stakes).send({
		from: address,
		gas: 3000000
	})
	.then(() => {
		return domain_token_contract.methods.approve(ddns_contract_address, stakes).send({
			from: address,
			gas: 3000000
		})
	})
	.then(() => {
		return ddns_contract.methods.sendStakes(stakes).send({
			from: address,
			gas: 3000000
		})
	})
	.then(() => {
		voter = {address: address, open_resolver: open_resolvers[index].trim().split('***')[0].trim()}
		voters.push(voter)
	})
	.catch('error', error => {
		console.log('init stake error', address)
	})
}




let vote_info = {}

ddns_contract.events.NewRequest({
	filter: {},
	fromBlock: 'latest'
}, (err, event) => {
	if(err) {
		console.log('NEW REQUEST ERROR: ', err)
	}
})
.on('data', (event) => {
	voters.forEach((voter) => {
		handle_request(event, voter)
	})
})
.on('changed', (event) => {console.log('New Request Changed', event)})
.on('error', (event) => {console.error})








async function handle_request(event, voter) {
	let hash = event.returnValues.hash
	
	let voting_args = await ddns_contract.methods.votingTable(hash).call()
	let stake = await ddns_contract.methods.stakes(voter.address).call()
	
	let keys = self_selection(hash, voting_args, stake, voter)
	
	if (keys.length > 0) {
		if (voting_args.requestType == 1) {
			// handle_IP_request(hash, voting_args, keys, voter)
			console.log('Request type is wrong!!!')
		}
		if (voting_args.requestType == 2) {
			console.log('voter:',voter)
			console.log('keys:', keys)
			handle_ownership_request(hash, voting_args, keys, voter)
		}
	}

}





function self_selection(hash, voting_args, stake, voter) {
	keys = []
	
	for (let i = 0; i < committeeSize; i++) {
		hex = web3.utils.soliditySha3(hash, voter.address, web3.utils.toBN(hash).add(web3.utils.toBN(i)))
		rand = web3.utils.toBN(hex)
		total_stake = web3.utils.toBN(voting_args.totalStake)
		stake = web3.utils.toBN(stake)

		if(max_num.div(total_stake).mul(stake).gt(rand)) {
			keys.push(i)
		}
	}
	
	return keys
}



function handle_ownership_request(hash, voting_args, keys, voter) {
	const domain = web3.utils.toAscii(voting_args.domain)
	const resolver = new Resolver()
	resolver.setServers([voter.open_resolver])

	let nounce = web3.utils.randomHex(32)
	let v = 0
	let r = '0x0000000000000000000000000000000000000000000000000000000000000000'
	let s = '0x0000000000000000000000000000000000000000000000000000000000000000'
	let commitment = web3.utils.soliditySha3({type: 'uint8', value: v},r,s,nounce).slice(0,42)
	
	if (vote_info[voter.address] == undefined) {
		vote_info[voter.address] = {}
	}


	resolver.resolveTxt(domain)
	.then((records) => {
		let sig = records[0][0]

		if (sig.startsWith('0x') && sig.length == 132) {
			r = sig.slice(0, 66)
			s = '0x' + sig.slice(66, 130)
			v = web3.utils.toDecimal('0x' + sig.slice(130, 132)) + 27
		}
		commitment = web3.utils.soliditySha3({type: 'uint8', value: v},r,s,nounce).slice(0,42)
		commit(hash, keys, commitment, voter)

		vote_info[voter.address][hash] = {v: v, r: r, s: s, nounce: nounce}

		console.log('commitment:', commitment)
		console.log('info:', {v: v, r: r, s: s, nounce: nounce})

	})
	.catch((err) => {
		commit(hash, keys, commitment, voter)
		vote_info[voter.address][hash] = {v: v, r: r, s: s, nounce: nounce}
		// console.log('retrive TXT record error', err)
	})
}



function commit(hash, keys, commitment, voter) {
	ddns_contract.methods.commit(hash, keys, commitment).send({
		from: voter.address,
		gas: 3000000
	})
	.catch((error) => {
		console.log(voter.address, 'commit error', error)
	})
}
// function handle_ownership_request(hash, voting_args, keys, voter) {
// 	const domain = web3.utils.toAscii(voting_args.domain)
// 	const resolver = new Resolver()
// 	resolver.setServers([voter.open_resolver])

// 	resolver.resolveTxt(domain)
// 	.then((records) => {
// 		let record0 = records[0][0]
// 		let record1 = records[1][0]
// 		let msg = '0x0000000000000000000000000000000000000000000000000000000000000000'
// 		let v = 0
// 		let r = '0x0000000000000000000000000000000000000000000000000000000000000000'
// 		let s = '0x0000000000000000000000000000000000000000000000000000000000000000'
// 		if(record0.startsWith('msg') && record1.startsWith('sig')) {
// 			msg = record0.slice(4)
// 			sig = record1.slice(4)
// 			r = sig.slice(0, 66)
// 			s = '0x' + sig.slice(66, 130)
// 			v = web3.utils.toDecimal('0x' + sig.slice(130, 132)) + 27
// 		}
// 		if(record1.startsWith('msg') && record0.startsWith('sig')) {
// 			sig = record0.slice(4)
// 			msg = record1.slice(4)
// 			r = sig.slice(0, 66)
// 			s = '0x' + sig.slice(66, 130)
// 			v = web3.utils.toDecimal('0x' + sig.slice(130, 132)) + 27
// 		}
// 		vote(hash, keys, msg, v, r, s, voter)
// 	})
// 	.catch((err) => {
// 		console.log('retrive TXT record error', err)
// 	})
// }






ddns_contract.events.VoteBegin({
	filter: {},
	fromBlock: 'latest'
}, (err, event) => {
	if(err) {
		console.log('VOTE BEGIN ERROR: ', err)
	}
})
.on('data', (event) => {
	voters.forEach((voter) => {
		handle_vote_begin(event, voter)
	})
})
.on('changed', (event) => {console.log('Vote Begin Changed', event)})
.on('error', (event) => {console.error})



function handle_vote_begin(event, voter) {
	let hash = event.returnValues.hash

	if (vote_info[voter.address][hash] != undefined) {
		let v = vote_info[voter.address][hash].v
		let r = vote_info[voter.address][hash].r
		let s = vote_info[voter.address][hash].s
		let nounce = vote_info[voter.address][hash].nounce
		vote(hash, v, r, s, nounce, voter)
		console.log('voted!!!')
	}
}




function vote(hash, v, r, s, nounce, voter) {

	ddns_contract.methods.vote(hash, v, r, s, nounce).send({
		from: voter.address,
		gas:3000000
	})
	// .on('receipt', receipt => {
	// 	console.log(receipt)
	// })
	.catch((error) => {
		// console.log(voter.address, 'Error', JSON.parse(error.message.substr(12, error.message.length)).message)
		console.log(voter.address, 'Error', error)
	})
}



// function handle_IP_request(hash, voting_args, keys, voter) {
// 	const domain = web3.utils.toAscii(voting_args.domain)
// 	const resolver = new Resolver()
// 	resolver.setServers([voter.open_resolver])

// 	resolver.resolve4(domain)
// 	.then((records) => {
// 		voteForIP(hash, keys, records, voter)
// 	})
// 	.catch((err) => {
// 		console.log('retrive A record error', err)
// 	})	
// }





// function voteForIP(hash, keys, records, voter) {
// 	ips = records.map((x) => {
// 		return web3.utils.toHex(x).padEnd(66, '0')
// 	})

// 	ddns_contract.methods.voteForIP(hash, keys, ips).send({
// 		from: voter.address,
// 		gas:3000000
// 	})
// 	// .on('receipt', (receipt) => {
// 	// 	console.log(voting_logs[hash])
// 	// })
// 	.catch((error) => {
// 		console.log(voter.address, 'Error', JSON.parse(error.message.substr(12, error.message.length)).message)
// 	})

// }


