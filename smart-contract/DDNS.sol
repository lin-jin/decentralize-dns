pragma solidity >=0.5.0 < 0.6.0;

import './DomainToken.sol';

contract DDNS{
    
    address constant tokenContractAddr = 0x4295EcBE401d165E4FA9D05BdE084A961f01990b;
    DomainToken token = DomainToken(tokenContractAddr);
    
    enum Stage {Init, Vote, Done}
    enum Type {None, Propose, Claim}
    enum Strength {None, VL, L, M, H, VH}
    
    
    event NewRequest (bytes32 hash);

    
    struct Record {
        address owner;
        address agent;
        uint256 lastVote;
        Strength strength;
        bytes record;
        uint256 lastUpdate;
        bytes32 request;
    }
    
    
    struct Voting {
        uint256 timestamp;
        Type requestType;
        address sender;
        bytes domain;
        uint256 cost;
        uint256 totalStake;
        Stage stage;
        uint256 votingWeight;
        int256 result;
        bytes32[] candidates;
        mapping (bytes32 => uint256) votes;
        address[] committees;
        mapping (address => uint256) weights;
        mapping (address => bool) redeemed;
    }


    uint256 public totalStake;
    mapping(address => uint256) public stakes;
    mapping(address => uint256) public lastChange;
    
    mapping (bytes32 => Voting) public votingTable;
    mapping (bytes => Record) dnsTable;
    
    uint256 requestInterval;
    uint256 maxRequestTime;
    uint8 validThreshold;
    uint16 public committeeSize;
    
    
    constructor () public {
        requestInterval = 0;
        maxRequestTime = 60;
        validThreshold = 4;
        committeeSize = 1;
    }
    
    
    function sendStakes(uint256 _stake) public {
        token.transferFrom(msg.sender, address(this), _stake);
        stakes[msg.sender] += _stake;
        totalStake += _stake;
        lastChange[msg.sender] = block.timestamp;
    }
    
    
    function retrieveStakes(uint256 _stake) public {
        require(stakes[msg.sender] >= _stake, "You don have that amount of stake!");
        token.transfer(msg.sender, _stake);
        stakes[msg.sender] -= _stake;
        totalStake -= _stake;
        lastChange[msg.sender] = block.timestamp;
    }
    
        
    function deposite (uint256 _cost) private returns (bool) {
        token.transferFrom(msg.sender, address(this), _cost); //escrow transaction
        return true;
    }
    
    
    function redeem (bytes32 [] memory _voting) public returns (uint256) {
        uint256 totalRedeemed = 0;
        for (uint i = 0; i< _voting.length; i++) {
            if(votingTable[_voting[i]].redeemed[msg.sender] == false) {
                totalRedeemed += votingTable[_voting[i]].weights[msg.sender] * votingTable[_voting[i]].cost / votingTable[_voting[i]].votingWeight;
                votingTable[_voting[i]].redeemed[msg.sender] = true;
            }
        }
        
        token.transfer(msg.sender, totalRedeemed);
        return totalRedeemed;
    }
    
    
    function request (Type _requestType, bytes memory _domain, uint256 _cost) public {
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, _requestType, _domain, _cost, block.timestamp));
        require(votingTable[hash].timestamp == 0, 'duplicate request');
        
        if (_requestType == Type.Claim) {
            votingTable[hash].sender = msg.sender;
        }
        else if (_requestType == Type.Propose){
            require(dnsTable[_domain].owner == address(0x0), 'domain has owner, only owner can make changes');
            require(block.timestamp - votingTable[dnsTable[_domain].request].timestamp > requestInterval, 'please wait for request interval for the next request');
            dnsTable[_domain].request = hash;
        }
        else {
            revert("request type is not correct");
        }

        require(deposite(_cost) == true);
        votingTable[hash].requestType = _requestType;
        votingTable[hash].timestamp = block.timestamp;
        votingTable[hash].domain = _domain;
        votingTable[hash].cost = _cost;
        votingTable[hash].stage = Stage.Vote;
        votingTable[hash].totalStake = totalStake;
        
        emit NewRequest(hash);
    }
    
    
    function getWeight (bytes32 _hash, uint256[] memory _keys) private returns (uint256) {
        uint256 weight = 0;
        bool dup;
        
        for (uint256 i = 0; i < _keys.length; i++) {
            dup = false;
            for (uint256 j = 0; j < i; j++) {
                if (_keys[i] == _keys[j]) {
                    dup = true;
                    break;
                }
            }
            if(_keys[i] < committeeSize && !dup) {
                uint256 random = uint256(keccak256(abi.encodePacked(_hash, msg.sender, _keys[i])));
                if (115792089237316195423570985008687907853269984665640564039457584007913129639935 / votingTable[_hash].totalStake * stakes[msg.sender] > random) {
                    weight += 1;
                }
            }
        }
        
        return weight;
    }
    
    
    function vote (bytes32 _hash, uint256[] memory _keys, bytes32[] memory _candidates) public {
        require(votingTable[_hash].stage == Stage.Vote, 'not in voting stage');
        require(block.timestamp > lastChange[msg.sender], 'Stake has changed since the vote begins, not allow to vote');
        uint256 weight = getWeight(_hash, _keys);
        require(weight > 0, 'voter is not in the committee');
        
        if (votingTable[_hash].requestType == Type.Claim) {
            // vote for claim
            if (_candidates[0] == bytes15('true')) {
                votingTable[_hash].result += int256(weight) / validThreshold;
            }
            else if (_candidates[0] == bytes15('false')) {
                votingTable[_hash].result -= int256(weight);
            }
            else {
                revert("vote is either not true or false");
            }
        }
        else {
            // vote for request
            for (uint8 i = 0; i < _candidates.length; i++) {
                bool dup = false;
                for (uint8 j = i + 1; j < _candidates.length; j++) {
                    if (_candidates[i] == _candidates[j]) {
                        dup = true;
                    }
                }
                if (!dup) {
                    if (votingTable[_hash].votes[_candidates[i]] == 0) {
                        votingTable[_hash].candidates.push(_candidates[i]);
                    }
                    // didn't check if it's a valid address
                    votingTable[_hash].votes[_candidates[i]] += weight;
                }
            }
        }
        
        votingTable[_hash].weights[msg.sender] = weight;
        votingTable[_hash].committees.push(msg.sender);
        votingTable[_hash].votingWeight += weight;
        
        
        // determine if the voting process is complete
        if (block.timestamp - votingTable[_hash].timestamp >= maxRequestTime) {
            votingTable[_hash].stage = Stage.Done;
            voteComplete(_hash);
        }
    }
    
    
    function voteComplete (bytes32 _hash) private {
        if (votingTable[_hash].requestType == Type.Claim && votingTable[_hash].result > 0) {
            bytes memory domain = votingTable[_hash].domain;
            if (dnsTable[domain].owner == address(0x0)) {
                dnsTable[domain].owner = votingTable[_hash].sender;
                dnsTable[domain].strength = Strength.VL;
                dnsTable[domain].lastVote = votingTable[_hash].timestamp;
            }
            else if (dnsTable[domain].owner == msg.sender) {
                // increase strength
                

            }
            else {
                // decrease strength
            }
        }
    }
    
    
    function delegate (bytes memory _domain, address _agent) public {
        require(msg.sender == dnsTable[_domain].owner, "Only domain owner can delegate ownership.");
        dnsTable[_domain].agent = _agent;
    }
    
    
    function withdraw (bytes memory _domain) public {
        require(msg.sender == dnsTable[_domain].owner, "Only domain owner can withdraw ownership.");
        delete dnsTable[_domain];
    }
    
    
    function update (bytes memory _domain, bytes memory _record) public {
        require(msg.sender == dnsTable[_domain].owner || msg.sender == dnsTable[_domain].agent, "Only domain owner or agent can update");
        dnsTable[_domain].record = _record;
        dnsTable[_domain].lastUpdate = block.timestamp;
    }
    
    
    function lookup (bytes memory _domain) view public returns (uint8, bytes memory) {
        if (dnsTable[_domain].owner != address(0x0)) {
            return (1, dnsTable[_domain].record);
        }
        else {
            bytes memory result;
            
            //concatenate histogram
            for (uint256 i = 0; i < votingTable[dnsTable[_domain].request].candidates.length; i++) {
                bytes32 candidate = votingTable[dnsTable[_domain].request].candidates[i];
                
                result = abi.encodePacked(result, candidate, " ", uintToAscii(votingTable[dnsTable[_domain].request].votes[candidate]), "|");
            }
            
            return (2, result);
        }
    }
    
    
    function uintToAscii(uint v) private pure returns (bytes memory) {
        if(v == 0) {
            return "0";
        }
        uint maxlength = 100;
        bytes memory reversed = new bytes(maxlength);
        uint i = 0;
        while (v != 0) {
            uint remainder = v % 10;
            v = v / 10;
            reversed[i++] = byte(int8(48 + remainder));
        }
        bytes memory s = new bytes(i + 1);
        for (uint j = 0; j <= i; j++) {
            s[j] = reversed[i - j];
        }
        return s;
    }
    
    
    // function getWeights (bytes32 _hash) view public returns (uint256 _weight) {
    //     return votingTable[_hash].weights[msg.sender];
    // }
    
    
    // function getVotes (bytes32 _hash, bytes15 _candidate) view public returns (uint256 _vote) {
    //     return votingTable[_hash].votes[_candidate];
    // }
}






