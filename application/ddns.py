from web3 import Web3, HTTPProvider, TestRPCProvider
import dns.resolver
import json
import sys

subdomain = '_ddns'


def verify_ownership(sender, domain):

	vote = False
	host = subdomain + '.' + domain
	
	try:
		results = dns.resolver.query(host, "TXT")
	except:
		return vote

	if len(results.response.answer) == 1:
		record = results.response.answer[0].to_text()
		if sender == record.split('"')[-2]:
			vote = True

	return vote



def verify_A_record(ip_addr, domain):

	vote = False
	
	try:
		results = dns.resolver.query(domain, "A")
	except:
		return vote

	for answer in results.response.answer:
		record = answer.to_text()
		if " A " in record:
			if ip_addr == record.split()[-1]:
				vote = True

	return vote

'''
    function totalSupply() public view returns (uint256);
    function balanceOf(address _owner) public view returns (uint256 balance);
    function transfer(address _to, uint256 _value) public returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);
    function approve(address _spender, uint256 _value) public returns (bool success);
    function allowance(address _owner, address _spender) public view returns (uint256 remaining);
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
'''

def totalSupply():
	return token_contract.functions.totalSupply().call()

def balanceOf(_owner):
	return token_contract.functions.balanceOf(_owner).call()

def transfer(_to, _value):
	return token_contract.functions.transfer(_to, _value).transact()

def transfer_from(_from, _to, _value):
	return token_contract.functions.transferFrom(_from, _to, _value).transact()

def approve(_spender, _value):
	return token_contract.functions.approve(_spender, _value).transact()

def allowance(_owner, _spender):
	return token_contract.functions.allowance(_owner, _spender).call()

def transfer_event(tx_hash):
	tx_receipt = web3.eth.getTransactionReceipt(tx_hash)
	logs = token_contract.events.Transfer().processReceipt(tx_receipt)
	_from = logs[0]['args']['_from']
	_to = logs[0]['args']['_to']
	_value = logs[0]['args']['_value']
	return _from, _to, _value

def approval_event(tx_hash):
	tx_receipt = web3.eth.getTransactionReceipt(tx_hash)
	logs = token_contract.events.Transfer().processReceipt(tx_receipt)
	_from = logs[0]['args']['_owner']
	_to = logs[0]['args']['_spender']
	_value = logs[0]['args']['_value']
	return _owner, _spender, _value

def supply_domaintokens(num):
	return token_contract.functions.supplyDomainTokens(num).transact()

def deduct_domaintokens(num):
	return token_contract.functions.deductDomainTokens(num).transact()



web3 = Web3(HTTPProvider("http://127.0.0.1:8545"))

account = sys.argv[1]
if not account in web3.eth.accounts:
	sys.exit()
web3.eth.defaultAccount = web3.toChecksumAddress(account)

token_contract_addr = web3.toChecksumAddress('0x95befd09e2af01a17ffac5ae6ab71b22a1cd31a3')
with open('token_contract_abi.json', 'r') as file:
	token_contract_abi = file.read()

ddns_contract_addr = web3.toChecksumAddress('0x1c5b7b794a1b419e557ea59475667a3e5684d384')
with open('ddns_contract_abi.json', 'r') as file:
	ddns_contract_abi = file.read()

token_contract = web3.eth.contract(token_contract_addr, abi = token_contract_abi)
ddns_contract = web3.eth.contract(ddns_contract_addr, abi = ddns_contract_abi)

to = web3.toChecksumAddress('0xee4dfee3f626b72c8acb16302ed1d525456951a7')
value = 2
tx_hash = transfer(to, value)
tx_receipt = web3.eth.getTransactionReceipt(tx_hash)
logs = token_contract.events.Transfer().processReceipt(tx_receipt)

print(logs)


