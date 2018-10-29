pragma solidity ^0.4.25;

import './DomainToken.sol';

contract DecentralizedDNS {
    
    address constant tokenContractAddr = 0x692a70d2e424a56d2c6c27aa97d1a86395877b3a;
    DomainToken token = DomainToken(tokenContractAddr);
    
    address contractOwner;
    uint64 public numberOfClaimedDomains;
    uint8 public validThrehold;
    uint256 public tips;
    
    enum Stage {Init, Vote, Done}
    enum Votes {None, Valid, Invalid}
    
    
    struct CommitteeMember {
        Votes result;
        uint256 weightedVote;
    }
    
    struct Update {
        address proposer;
        string domain;
        string record;
        uint256 cost;
        Stage stage;
        uint256 weightedVoteForValid;
        uint256 weightedVoteForInvalid;
        address[] committeeForValid;
        address[] committeeForInvalid;
        mapping (address => CommitteeMember) committee;
        mapping (string => bool) existingNounce;
        address helper;
    }
    
    struct RecordSet {
        address owner;
        string domain;
        string record;
    }
    
    mapping (bytes32 => Update) updatesTable;
    mapping (bytes32 => RecordSet) dnsRecordSets;
    
    event NewUpdate (address proposer, string domain, bool needVote);
    event VoteResult (string domain, bool isValid);
    event RecordDeleted (string domain);
    event VoteFailure (string domain, bool domainVerified);
    
    
    modifier ownerPrivilege {
        require (msg.sender == contractOwner);
        _;
    }
    
    
    constructor () {
        contractOwner = msg.sender;
        numberOfClaimedDomains = 0;
        validThrehold = 1; // verified weighted votes is at least validThrehold times unverified weighted votes
        tips = 0;
    }
    
    
    function addRecordSet (bytes32 _domainHash) private {
        
        dnsRecordSets[_domainHash].owner = updatesTable[_domainHash].proposer;
        dnsRecordSets[_domainHash].domain = updatesTable[_domainHash].domain;
        dnsRecordSets[_domainHash].record = updatesTable[_domainHash].record;
        
        numberOfClaimedDomains += 1;
    }
    
    
    function deleteRecordSet (string _domain) public returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        require(msg.sender == dnsRecordSets[domainHash].owner);
        
        delete dnsRecordSets[domainHash].owner;
        delete dnsRecordSets[domainHash].domain;
        delete dnsRecordSets[domainHash].record;
        numberOfClaimedDomains -= 1;
        
        emit RecordDeleted(_domain);
    }
    
    
    function deleteUpdate (bytes32 _domainHash) private {
        
        uint i;
        for (i = 0; i < updatesTable[_domainHash].committeeForValid.length; i++) {
            delete updatesTable[_domainHash].committee[updatesTable[_domainHash].committeeForValid[i]];
        }
        for (i = 0; i < updatesTable[_domainHash].committeeForInvalid.length; i++) {
            delete updatesTable[_domainHash].committee[updatesTable[_domainHash].committeeForInvalid[i]];
        }
        delete updatesTable[_domainHash];
        
    }
    
    
    // msg.sender deposite tokens in the contract to claim the domain ownership
    function deposite (uint256 _cost) private returns (bool) {
        
        require(token.allowance(msg.sender, this) >= _cost, "DMTs for update is not enough.");
        token.transferFrom(msg.sender, this, _cost); //escrow transaction
        return true;
    }
    
    
    // reward voters according to their voting weight
    function rewardVoters (bytes32 _domainHash, bool result) private returns (bool) {
        
        uint256 totalRewards = updatesTable[_domainHash].cost;
        uint256 tip = totalRewards;
        
        uint i;
        uint256 reward;
        if (result = true) {
            for (i = 0; i < updatesTable[_domainHash].committeeForValid.length; i++) {
                reward = updatesTable[_domainHash].committee[updatesTable[_domainHash].committeeForValid[i]].weightedVote * totalRewards / updatesTable[_domainHash].weightedVoteForValid;
                token.transfer(updatesTable[_domainHash].committeeForValid[i], reward);
                tip -= reward;
            }
            
        }
        else {
            for (i = 0; i < updatesTable[_domainHash].committeeForInvalid.length; i++) {
                reward = updatesTable[_domainHash].committee[updatesTable[_domainHash].committeeForInvalid[i]].weightedVote * totalRewards / updatesTable[_domainHash].weightedVoteForInvalid;
                token.transfer(updatesTable[_domainHash].committeeForInvalid[i], reward);
                tip -= reward;
            }
        }
        
        tips += tip;
        
        return true;
    }
    
    
    // proof of work check
    function voteValidity (bytes32 _domainHash, string _nounce) private returns (bool) {
        return true;
    } 
    
    
    // vote complete check
    function isVoteComplete (bytes32 _domainHash) private returns (bool) {
        return false;
    }
    
    
    // reward helper to change the vote stage
    function rewardHelper (address _helper) private {
        
    }
    
    function sendUpdate (string _domain, string _record, uint256 _cost) public {
        
        bytes32 domainHash = keccak256(_domain);
        
        if (msg.sender == dnsRecordSets[domainHash].owner) {
            dnsRecordSets[domainHash].record = _record;
            emit NewUpdate (msg.sender, _domain, false);
        }
        else{
            require(updatesTable[domainHash].stage == Stage.Init, "Domain update in progress.");
            require(deposite(_cost) == true);

            updatesTable[domainHash].proposer = msg.sender;
            updatesTable[domainHash].domain = _domain;
            updatesTable[domainHash].record = _record;
            updatesTable[domainHash].cost = _cost;
            updatesTable[domainHash].stage = Stage.Vote;
            
            emit NewUpdate (msg.sender, _domain, true);
        }
    }
    
    
    function vote (string _domain, string _nounce, bool _domainVerified) public returns (bool)  {
        
        bytes32 domainHash = keccak256(_domain);
        uint256 weight = token.balanceOf(msg.sender);
        
        require(updatesTable[domainHash].stage == Stage.Vote, "Not in the voting stage.");
        require(updatesTable[domainHash].existingNounce[_nounce] == false, "Nounce already exists.");
        require(weight > 0, "Voter has no weight.");
        require(voteValidity(domainHash, _nounce) == true, "Vote is invalid.");
        
        updatesTable[domainHash].existingNounce[_nounce] = true;
        
        if (isVoteComplete(domainHash) == true) {
            updatesTable[domainHash].helper = msg.sender;
            changeVotingStage(_domain, Stage.Done);
            voteComplete(domainHash);
            return true;
        }
        
        Votes result;
        if (_domainVerified == true) {
            result = Votes.Valid;
        }
        else {
            result = Votes.Invalid;
        }
        
        if (updatesTable[domainHash].committee[msg.sender].result == Votes.None) {
            updatesTable[domainHash].committee[msg.sender].result = result;
            updatesTable[domainHash].committee[msg.sender].weightedVote = weight;
            if (_domainVerified == true) {
                updatesTable[domainHash].committeeForValid.push(msg.sender);
                updatesTable[domainHash].weightedVoteForValid += weight;
            }
            else {
                updatesTable[domainHash].committeeForInvalid.push(msg.sender);
                updatesTable[domainHash].weightedVoteForInvalid += weight;
            }
            return true;
        }
        else {
            emit VoteFailure (_domain, _domainVerified);
            return false;
        }
    }
    
    
    function voteComplete (bytes32 _domainHash) private returns (bool) {
        
        bool result;

        if (updatesTable[_domainHash].weightedVoteForValid / validThrehold >= updatesTable[_domainHash].weightedVoteForInvalid ) {
            result = true;
            addRecordSet(_domainHash);
        }
        else {
            result = false;
        }
        
        rewardVoters(_domainHash, result);
        emit VoteResult(updatesTable[_domainHash].domain, result);
        
        deleteUpdate(_domainHash);
    }
    
    
    function getUpdate (string _domain) public view returns (address, string, string, Stage, address[], uint256, address[], uint256) {
        
        bytes32 domainHash = keccak256(_domain);
        
        return (
            updatesTable[domainHash].proposer, 
            updatesTable[domainHash].domain, 
            updatesTable[domainHash].record, 
            updatesTable[domainHash].stage, 
            updatesTable[domainHash].committeeForValid,
            updatesTable[domainHash].weightedVoteForValid,
            updatesTable[domainHash].committeeForInvalid,
            updatesTable[domainHash].weightedVoteForInvalid);
    }
    
    
    function getDNSRecordSet (string _domain) public view returns (string) {
            
        bytes32 domainHash = keccak256(_domain);
        
        return (dnsRecordSets[domainHash].record);
    }
    
    
    //for test purpose, need automatic solution
    function changeVotingStage (string _domain, Stage _stage) public ownerPrivilege returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        
        updatesTable[domainHash].stage = _stage;
        if (_stage == Stage.Done) {
            voteComplete(domainHash);
        }
        
        return true;
    }
    
}