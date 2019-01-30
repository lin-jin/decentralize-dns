pragma solidity >=0.5.0 < 0.6.0;

import './DomainToken.sol';

contract DDNS{
    
<<<<<<< HEAD
    address constant tokenContractAddr = 0xe394b960F825d4b3B8BBe413BfA2da6771f83077;
=======
    address constant tokenContractAddr = 0x15e08fa9FE3e3aa3607AC57A29f92b5D8Cb154A2;
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
    DomainToken token = DomainToken(tokenContractAddr);
    
    enum Stage {Init, Vote, Done}
    enum Type {None, Propose, Claim}
    enum Strength {None, VL, L, M, H, VH}
    
    
<<<<<<< HEAD
    event NewRequest (bytes32 hash);
=======
    event newRequest (bytes32 hash);
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
    
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
<<<<<<< HEAD
        bytes domain;
=======
        string domain;
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
        uint256 cost;
        uint256 totalStake;
        Stage stage;
        uint256 votingWeight;
<<<<<<< HEAD
        int256 result;
=======
        uint256 result;
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
        bytes15[] candidates;
        mapping (bytes15 => uint256) votes;
        address[] committees;
        mapping (address => uint256) weights;
        mapping (address => bool) redeemed;
    }


    uint256 public totalStake;
    mapping(address => uint256) public stakes;
    mapping(address => uint256) public lastChange;
    
    mapping (bytes32 => Voting) public votingTable;
<<<<<<< HEAD
    mapping (bytes => Record) dnsTable;
=======
    mapping (string => Record) dnsTable;
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
    
    uint256 requestInterval;
    uint256 maxRequestTime;
    uint8 validThreshold;
    uint16 committeeSize;
    
    
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
    
    
<<<<<<< HEAD
    function request (Type _requestType, bytes memory _domain, uint256 _cost) public {
=======
    function request (Type _requestType, string memory _domain, uint256 _cost) public {
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
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
        
<<<<<<< HEAD
        emit NewRequest(hash);
=======
        emit newRequest(hash);
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
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
                uint256 random = uint256(keccak256(abi.encodePacked(_hash, msg.sender, _keys[i] + uint256(_hash))));
                if (115792089237316195423570985008687907853269984665640564039457584007913129639935 / votingTable[_hash].totalStake * stakes[msg.sender] > random) {
                    weight += 1;
                }
            }
        }
        
        return weight;
    }
    
    
    function vote (bytes32 _hash, uint256[] memory _keys, bytes15[] memory _candidates) public {
        require(votingTable[_hash].stage == Stage.Vote, 'not in voting stage');
        require(block.timestamp > lastChange[msg.sender], 'Stake has changed since the vote begins, not allow to vote');
        uint256 weight = getWeight(_hash, _keys);
        require(weight > 0, 'voter is not in the committee');
        
        if (votingTable[_hash].requestType == Type.Claim) {
            // vote for claim
<<<<<<< HEAD
            if (_candidates[0] == bytes15('true')) {
                votingTable[_hash].result += int256(weight) / validThreshold;
            }
            else if (_candidates[0] == bytes15('false')) {
                votingTable[_hash].result -= int256(weight);
=======
            if (_candidates[0] == 'true') {
                votingTable[_hash].result += weight / validThreshold;
            }
            else if (_candidates[0] == 'false') {
                votingTable[_hash].result -= weight;
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
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
<<<<<<< HEAD
            bytes memory domain = votingTable[_hash].domain;
=======
            string memory domain = votingTable[_hash].domain;
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
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
    
    
<<<<<<< HEAD
    function delegate (bytes memory _domain, address _agent) public {
=======
    function delegate (string memory _domain, address _agent) public {
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
        require(msg.sender == dnsTable[_domain].owner, "Only domain owner can delegate ownership.");
        dnsTable[_domain].agent = _agent;
    }
    
    
<<<<<<< HEAD
    function withdraw (bytes memory _domain) public {
=======
    function withdraw (string memory _domain) public {
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
        require(msg.sender == dnsTable[_domain].owner, "Only domain owner can withdraw ownership.");
        delete dnsTable[_domain];
    }
    
    
<<<<<<< HEAD
    function update (bytes memory _domain, bytes memory _record) public {
=======
    function update (string memory _domain, bytes memory _record) public {
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
        require(msg.sender == dnsTable[_domain].owner || msg.sender == dnsTable[_domain].agent, "Only domain owner or agent can update");
        dnsTable[_domain].record = _record;
        dnsTable[_domain].lastUpdate = block.timestamp;
    }
    
    
<<<<<<< HEAD
    function lookup (bytes memory _domain) view public returns (uint8, bytes memory) {
=======
    function lookup (string memory _domain) view public returns (uint8, bytes memory) {
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
        if (dnsTable[_domain].owner != address(0x0)) {
            return (1, dnsTable[_domain].record);
        }
        else {
            bytes memory result;
            
            //concatenate histogram
            for (uint256 i = 0; i < votingTable[dnsTable[_domain].request].candidates.length; i++) {
                bytes15 candidate = votingTable[dnsTable[_domain].request].candidates[i];
                
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
<<<<<<< HEAD
        return s;
=======
        return bytes(string(s));
>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
    }
    
    
    // function getWeights (bytes32 _hash) view public returns (uint256 _weight) {
    //     return votingTable[_hash].weights[msg.sender];
    // }
    
    
    // function getVotes (bytes32 _hash, bytes15 _candidate) view public returns (uint256 _vote) {
    //     return votingTable[_hash].votes[_candidate];
    // }
}




<<<<<<< HEAD
=======


>>>>>>> b1eae7dd3340514e477b716d2bc9100a2a2eb047
