const wallet = require('ethereumjs-wallet')
const util = require('ethereumjs-util')


const private_key = process.argv[2]

let private_key_buffer = util.toBuffer(private_key)
let public_key = wallet.fromPrivateKey(private_key_buffer).getPublicKeyString()

console.log(public_key)