pragma solidity >=0.5.0 < 0.6.0;

import './DomainToken.sol';

contract DDNS{
    
    address tokenContractAddr;
    DomainToken token;
    
    enum Stage {Init, Vote, Done}
    enum Type {None, IP, Ownership}
    enum Mode {None, Claim, Secure}
    
    
    event NewRequest (bytes32 hash);
    event NewVoteForIP (bytes32 hash, uint96 weight, bytes32[] ips);
    event NewVote (bytes32 hash, uint96 weight, bool verified);
    event VoteComplete (bytes32 hash);

    
    struct Record {
        address owner;
        address agent;
        uint256 lastVote;
        Mode mode;
        bytes record;
        uint256 lastUpdate;
        bytes32 request;
    }
    
    
    struct Voting {
        uint256 timestamp;
        Type requestType;
        address sender;
        bytes domain;
        uint256 offer;
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
    
    
    uint8 validThreshold; 
    uint16 public committeeSize;
    uint16 public committeeThreshold;
    
    
    constructor (address _tokenContractAddr) public {
        tokenContractAddr = _tokenContractAddr;
        token = DomainToken(tokenContractAddr);
        validThreshold = 4; // 80% of the voters verifies the ownership.
        committeeSize = 10;
        committeeThreshold = 8;
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
                totalRedeemed += votingTable[_voting[i]].weights[msg.sender] * votingTable[_voting[i]].offer / votingTable[_voting[i]].votingWeight;
                votingTable[_voting[i]].redeemed[msg.sender] = true;
            }
        }
        
        token.transfer(msg.sender, totalRedeemed);
        return totalRedeemed;
    }
    
    
    function request (Type _requestType, bytes memory _domain, uint256 _offer) public {
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, _requestType, _domain, _offer, block.timestamp));
        require(votingTable[hash].timestamp == 0, 'duplicate request');
        
        if (_requestType == Type.Ownership) {
            votingTable[hash].sender = msg.sender;
        }
        else if (_requestType == Type.IP){
            require(dnsTable[_domain].owner == address(0x0), 'domain has owner, only owner can make changes');
            // require(block.timestamp - votingTable[dnsTable[_domain].request].timestamp > requestInterval, 'please wait for request interval for the next request');
            dnsTable[_domain].request = hash;
        }
        else {
            revert("request type is not correct");
        }

        require(deposite(_offer) == true);
        votingTable[hash].requestType = _requestType;
        votingTable[hash].timestamp = block.timestamp;
        votingTable[hash].domain = _domain;
        votingTable[hash].offer = _offer;
        votingTable[hash].stage = Stage.Vote;
        votingTable[hash].totalStake = totalStake;
        
        emit NewRequest(hash);
    }
    
    
    function getWeight (bytes32 _hash, uint256[] memory _keys) private view returns (uint96) {
        uint96 weight = 0;
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
                uint256 random = uint256(keccak256(abi.encodePacked(_hash, msg.sender, uint256(_hash) + _keys[i])));
                if (115792089237316195423570985008687907853269984665640564039457584007913129639935 / votingTable[_hash].totalStake * stakes[msg.sender] > random) {
                    weight += 1;
                }
            }
        }
        
        return weight;
    }
    
    
    
    modifier eligibleVote (bytes32 _hash, Type _type) {
        require(votingTable[_hash].requestType == _type, 'Using wrong vote function');
        require(votingTable[_hash].stage == Stage.Vote, 'This voting is not in voting stage');
        require(block.timestamp > lastChange[msg.sender], 'Stake has changed since the vote begins, not allow to vote');
        require(votingTable[_hash].weights[msg.sender] == 0, 'Duplicate Vote');
        _;
    }
    
    
    function addVoter (bytes32 _hash, uint96 weight) private {
        // bytes memory committee = abi.encodePacked(bytes20(msg.sender), weight);
        votingTable[_hash].weights[msg.sender] = weight;
        votingTable[_hash].committees.push(msg.sender);
        votingTable[_hash].votingWeight += weight;
    }
    
    
    
    function vote (bytes32 _hash, uint256[] memory _keys, bytes32 _msg, uint8 _v, bytes32 _r, bytes32 _s) eligibleVote (_hash, Type.Ownership) public {
        uint96 weight = getWeight(_hash, _keys);
        require(weight > 0, 'Voter is not in the committee');
        
        bool verified = getSigner(_msg, _v, _r, _s) == votingTable[_hash].sender;
        
        if (verified) {
            votingTable[_hash].result += int96(weight);
        }
        else {
            votingTable[_hash].result -= int96(weight) * validThreshold;
        }

        addVoter(_hash, weight);
        emit NewVote(_hash, weight, verified);
        
        if (votingTable[_hash].votingWeight > committeeThreshold) {
            votingTable[_hash].stage = Stage.Done;
            voteComplete(_hash);
        }
    }
    
    
    
    function voteForIP (bytes32 _hash, uint256[] memory _keys, bytes32[] memory _ips) eligibleVote (_hash, Type.IP) public {
        uint96 weight = getWeight(_hash, _keys);
        require(weight > 0, 'Voter is not in the committee');
        
        for (uint8 i = 0; i < _ips.length; i++) {
            bool dup = false;
            for (uint8 j = i + 1; j < _ips.length; j++) {
                if (_ips[i] == _ips[j]) {
                    dup = true;
                }
            }
            if (!dup) {
                if (votingTable[_hash].votes[_ips[i]] == 0) {
                    votingTable[_hash].candidates.push(_ips[i]);
                }
                votingTable[_hash].votes[_ips[i]] += weight;
            }
        }
        
        addVoter(_hash, weight);
        emit NewVoteForIP(_hash, weight, _ips);
        
        if (votingTable[_hash].votingWeight > committeeThreshold) {
            votingTable[_hash].stage = Stage.Done;
            voteComplete(_hash);
        }
    }
    
    
    
    
    function voteComplete (bytes32 _hash) private {
        if (votingTable[_hash].requestType == Type.Ownership && votingTable[_hash].result > 0) {
            bytes memory domain = votingTable[_hash].domain;
            
            if (dnsTable[domain].mode == Mode.Claim) {
                dnsTable[domain].owner = msg.sender;
                dnsTable[domain].mode = Mode.Secure;
                dnsTable[domain].lastVote = votingTable[_hash].timestamp;
            }
            else if (dnsTable[domain].owner != msg.sender) {
                dnsTable[domain].mode = Mode.Claim;
            }
            else {
                dnsTable[domain].lastVote = votingTable[_hash].timestamp;
            }
        }
        emit VoteComplete(_hash);
    }
    
    
    function transfer (bytes memory _domain, address _nextOwner) public {
        require(msg.sender == dnsTable[_domain].owner, "Only domain owner can transfer ownership.");
        dnsTable[_domain].owner = _nextOwner;
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
    
    
    function getSigner(bytes32 hash, uint8 v, bytes32 r, bytes32 s) public pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hash));
        return ecrecover(prefixedHash, v, r, s);
    }
    

    
    // function bytesToBytes32(bytes memory input) private pure returns (bytes32) {
    //     bytes32 output;
    //     assembly {
    //         output := mload(add(output, 32))
    //     }
    //     return output;
    // }
    
    
    // function committeeSplit(bytes32 committee) private pure returns (address, uint96) {
    //     bytes20 part1;
    //     bytes12 part2;
    //     assembly {
    //       let ptr := mload(0x40)
    //       mstore(add(ptr,0x00), committee)
    //       part1 := mload(add(ptr,0x00))
    //       part2 := mload(add(ptr,0x14))
    //     }
        
    //     return (address(part1), uint96(part2));
    // }
    
    // function getWeights (bytes32 _hash) view public returns (uint256 _weight) {
    //     return votingTable[_hash].weights[msg.sender];
    // }
    
    
    // function getVotes (bytes32 _hash, bytes15 _candidate) view public returns (uint256 _vote) {
    //     return votingTable[_hash].votes[_candidate];
    // }
}






