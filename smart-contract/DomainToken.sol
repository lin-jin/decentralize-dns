pragma solidity >=0.5.0 < 0.6.0;

import "./Token.sol";

contract DomainToken is Token {
    
    string constant public name  = "DomainToken";
    string constant public symbol = "DMT";
    uint8 constant public decimals = 18;
    
    address contractOwner;
    uint256 public totalDomainToken;
    
    mapping (address => uint256) balances;
    mapping (address => mapping (address => uint256)) approved;
    
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
    
    constructor () public {
        contractOwner = msg.sender;
        totalDomainToken = 0;
    }
    
    
    function totalSupply() public view returns (uint256) {
        return totalDomainToken;
    }
    
    function balanceOf(address _owner) public view returns (uint256 balance) {
        return balances[_owner];
    }
    
    function transfer(address _to, uint256 _value) public returns (bool success) {
        require (balances[msg.sender] >= _value, 'balance is not enough');
        balances[msg.sender] -= _value;
        balances[_to] += _value;
        // emit Transfer(msg.sender, _to, _value);
        return true;
    }
    
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        require (approved[_from][msg.sender] >= _value && balances[_from] >= _value, 'allowance is not enough');
        balances[_from] -= _value;
        balances[_to] += _value;
        approved[_from][msg.sender] -= _value;
        // emit Transfer(_from, _to, _value);
        return true;
    }
    
    function approve(address _spender, uint256 _value) public returns (bool success) {
        approved[msg.sender][_spender] = _value;
        // emit Approval(msg.sender, _spender, _value);
        return true;
    }
    
    function allowance(address _owner, address _spender) public view returns (uint256 remaining) {
        return approved[_owner][_spender];
    }
    
    
    
    
    //supply tokens for experiment
    function supplyDomainTokens (uint256 tokens) public {
        balances[msg.sender] += tokens;
        totalDomainToken += tokens;
    }
    
    //deduct tokens for experiment
    function deductDomainTokens (uint256 tokens) public {
        require (balanceOf(msg.sender) >= tokens);
        balances[msg.sender] -= tokens;
        totalDomainToken -= tokens;
    }
}