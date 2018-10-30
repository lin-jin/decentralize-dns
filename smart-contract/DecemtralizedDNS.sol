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
        uint256 weight;
    }
    
    struct Voting {
        address proposer;
        string domain;
        string record;
        uint256 cost;
        Stage stage;
        uint256 weightForValid;
        uint256 weightForInvalid;
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
    
    mapping (bytes32 => Voting) ownershipClaimTable;
    mapping (bytes32 => Voting) updatesTable;
    mapping (bytes32 => RecordSet) dnsRecordSets;
    
    event NewUpdate (address proposer, string domain, bool needVote);
    event NewOwnershipClaim (address proposer, string domain);
    event OwnershipTransfer (string domain, address nextOwner);
    event VoteResult (string domain, bool isValid);
    event RecordDeleted (string domain);
    event VoteForOwnerSuccess (string domain, string nounce, bool isValid, uint256 weight);
    event VoteForOwnerFailure (string domain, string nounce, bool isValid);
    event VoteForUpdateSuccess (string domain, string nounce, bool isValid, uint256 weight);
    event VoteForUpdateFailure (string domain, string nounce, bool isValid);
    
    
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
    
    
    function addOwner (bytes32 _domainHash) private {
        
        dnsRecordSets[_domainHash].owner = ownershipClaimTable[_domainHash].proposer;
        dnsRecordSets[_domainHash].domain = ownershipClaimTable[_domainHash].domain;
        dnsRecordSets[_domainHash].record = "";
        numberOfClaimedDomains += 1;
    }
    
    
    function addRecordSet (bytes32 _domainHash) private {
        
        dnsRecordSets[_domainHash].domain = updatesTable[_domainHash].domain;
        dnsRecordSets[_domainHash].record = updatesTable[_domainHash].record;
    }
    
    
    function deleteRecordSet (string _domain) public returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        require(msg.sender == dnsRecordSets[domainHash].owner, "Only domain owner can delete.");
        
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
    
    
    function deleteOwnershipClaim (bytes32 _domainHash) private {
        
        uint i;
        for (i = 0; i < ownershipClaimTable[_domainHash].committeeForValid.length; i++) {
            delete ownershipClaimTable[_domainHash].committee[ownershipClaimTable[_domainHash].committeeForValid[i]];
        }
        for (i = 0; i < ownershipClaimTable[_domainHash].committeeForInvalid.length; i++) {
            delete ownershipClaimTable[_domainHash].committee[ownershipClaimTable[_domainHash].committeeForInvalid[i]];
        }
        delete ownershipClaimTable[_domainHash];
        
    }
    
    // msg.sender deposite tokens in the contract to claim the domain ownership
    function deposite (uint256 _cost) private returns (bool) {
        
        require(token.allowance(msg.sender, this) >= _cost, "DMTs for update is not enough.");
        token.transferFrom(msg.sender, this, _cost); //escrow transaction
        return true;
    }
    
    
    // reward voters for ownership claim according to their voting weight
    function rewardVotersForOwnership (bytes32 _domainHash, bool result) private returns (bool) {
        
        uint256 totalRewards = ownershipClaimTable[_domainHash].cost;
        uint256 tip = totalRewards;
        
        uint i;
        uint256 reward;
        if (result = true) {
            for (i = 0; i < ownershipClaimTable[_domainHash].committeeForValid.length; i++) {
                reward = ownershipClaimTable[_domainHash].committee[ownershipClaimTable[_domainHash].committeeForValid[i]].weight * totalRewards / ownershipClaimTable[_domainHash].weightForValid;
                token.transfer(ownershipClaimTable[_domainHash].committeeForValid[i], reward);
                tip -= reward;
            }
            
        }
        else {
            for (i = 0; i < ownershipClaimTable[_domainHash].committeeForInvalid.length; i++) {
                reward = ownershipClaimTable[_domainHash].committee[ownershipClaimTable[_domainHash].committeeForInvalid[i]].weight * totalRewards / ownershipClaimTable[_domainHash].weightForInvalid;
                token.transfer(ownershipClaimTable[_domainHash].committeeForInvalid[i], reward);
                tip -= reward;
            }
        }
        
        tips += tip;
        
        return true;
    }
    
    
    // reward voters for update according to their voting weight
    function rewardVotersForUpdate (bytes32 _domainHash, bool result) private returns (bool) {
        //
    }
    
    
    // proof of work check
    function voteValidity (bytes32 _domainHash, string _nounce) private returns (bool) {
        return true;
    } 
    
    
    // vote complete check
    function isVoteForOwnershipComplete (bytes32 _domainHash) private returns (bool) {
        return false;
    }
    
    function isVoteForUpdateComplete (bytes32 _domainHash) private returns (bool) {
        return false;
    }
    
    
    // reward helper to change the vote stage
    function rewardHelper (address _helper) private {
        
    }
    
    
    function ownershipTransfer (string _domain, address _nextOwner) public returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        require(msg.sender == dnsRecordSets[domainHash].owner, "Only domain owner can transfer ownership.");
        
        dnsRecordSets[domainHash].owner = _nextOwner;
        dnsRecordSets[domainHash].record = "";
        
        emit OwnershipTransfer (_domain, _nextOwner);
        return true;
    }
    
    
    function claimOwnership (string _domain, uint256 _cost) public returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        
        require (ownershipClaimTable[domainHash].stage == Stage.Init, "Ownership claim is in progress.");
        require(deposite(_cost) == true);
        
        ownershipClaimTable[domainHash].proposer = msg.sender;
        ownershipClaimTable[domainHash].domain = _domain;
        ownershipClaimTable[domainHash].cost = _cost;
        ownershipClaimTable[domainHash].stage = Stage.Vote;

            
        emit NewOwnershipClaim (msg.sender, _domain);
    }
    
    
    function voteForOwnership (string _domain, string _nounce, bool _isValid) public returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        uint256 weight = token.balanceOf(msg.sender);
        
        require(ownershipClaimTable[domainHash].stage == Stage.Vote, "Not in the voting stage.");
        require(ownershipClaimTable[domainHash].existingNounce[_nounce] == false, "Nounce already exists.");
        require(weight > 0, "Voter has no weight.");
        require(voteValidity(domainHash, _nounce) == true, "Vote is invalid.");
        
        ownershipClaimTable[domainHash].existingNounce[_nounce] = true;
        
        if (isVoteForOwnershipComplete(domainHash) == true) {
            ownershipClaimTable[domainHash].helper = msg.sender;
            changeVotingStageForOwnership(_domain, Stage.Done);
            voteCompleteForOwnership(domainHash);
            return true;
        }
        
        Votes result;
        if (_isValid == true) {
            result = Votes.Valid;
        }
        else {
            result = Votes.Invalid;
        }
        
        if (ownershipClaimTable[domainHash].committee[msg.sender].result == Votes.None) {
            ownershipClaimTable[domainHash].committee[msg.sender].result = result;
            ownershipClaimTable[domainHash].committee[msg.sender].weight = weight;
            if (_isValid == true) {
                ownershipClaimTable[domainHash].committeeForValid.push(msg.sender);
                ownershipClaimTable[domainHash].weightForValid += weight;
            }
            else {
                ownershipClaimTable[domainHash].committeeForInvalid.push(msg.sender);
                ownershipClaimTable[domainHash].weightForInvalid += weight;
            }
            emit VoteForOwnerSuccess (_domain, _nounce, _isValid, weight);
            return true;
        }
        // every address can only vote once, such restrict need to be deleted later.
        else {
            emit VoteForOwnerFailure (_domain, _nounce, _isValid);
            return false;
        }
    }
    
    
    function voteCompleteForOwnership (bytes32 _domainHash) private returns (bool) {
        
        bool result;

        if (ownershipClaimTable[_domainHash].weightForValid / validThrehold > ownershipClaimTable[_domainHash].weightForInvalid ) {
            result = true;
            addOwner(_domainHash);
        }
        else {
            result = false;
        }
        
        rewardVotersForOwnership(_domainHash, result);
        emit VoteResult(ownershipClaimTable[_domainHash].domain, result);
        
        deleteOwnershipClaim(_domainHash);
    }
    
    
    function sendUpdate (string _domain, string _record) public returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        
        if (msg.sender == dnsRecordSets[domainHash].owner) {
            dnsRecordSets[domainHash].record = _record;
            emit NewUpdate (msg.sender, _domain, false);
        }
        else{
            require(dnsRecordSets[domainHash].owner == 0x0, "Domain already has owner.");
            require(updatesTable[domainHash].stage == Stage.Init, "Domain update in progress.");

            updatesTable[domainHash].domain = _domain;
            updatesTable[domainHash].record = _record;
            updatesTable[domainHash].stage = Stage.Vote;
            
            emit NewUpdate (msg.sender, _domain, true);
        }
        
        return true;
    }
    
    
    function voteForUpdate (string _domain, string _nounce, bool _isValid) public returns (bool)  {
        
        bytes32 domainHash = keccak256(_domain);
        uint256 weight = token.balanceOf(msg.sender);
        
        require(updatesTable[domainHash].stage == Stage.Vote, "Not in the voting stage.");
        require(updatesTable[domainHash].existingNounce[_nounce] == false, "Nounce already exists.");
        require(weight > 0, "Voter has no weight.");
        require(voteValidity(domainHash, _nounce) == true, "Vote is invalid.");
        
        updatesTable[domainHash].existingNounce[_nounce] = true;
        
        if (isVoteForUpdateComplete(domainHash) == true) {
            updatesTable[domainHash].helper = msg.sender;
            changeVotingStageForUpdate(_domain, Stage.Done);
            voteCompleteForUpdate(domainHash);
            return true;
        }
        
        Votes result;
        if (_isValid == true) {
            result = Votes.Valid;
        }
        else {
            result = Votes.Invalid;
        }
        
        if (updatesTable[domainHash].committee[msg.sender].result == Votes.None) {
            updatesTable[domainHash].committee[msg.sender].result = result;
            updatesTable[domainHash].committee[msg.sender].weight = weight;
            if (_isValid == true) {
                updatesTable[domainHash].committeeForValid.push(msg.sender);
                updatesTable[domainHash].weightForValid += weight;
            }
            else {
                updatesTable[domainHash].committeeForInvalid.push(msg.sender);
                updatesTable[domainHash].weightForInvalid += weight;
            }
            emit VoteForUpdateSuccess (_domain, _nounce, _isValid, weight);
            return true;
        }
        else {
            emit VoteForUpdateFailure (_domain, _nounce, _isValid);
            return false;
        }
    }
    
    
    function voteCompleteForUpdate (bytes32 _domainHash) private returns (bool) {
        
        bool result;

        if (updatesTable[_domainHash].weightForValid / validThrehold > updatesTable[_domainHash].weightForInvalid ) {
            result = true;
            addRecordSet(_domainHash);
        }
        else {
            result = false;
        }
        
        rewardVotersForUpdate(_domainHash, result);
        emit VoteResult(updatesTable[_domainHash].domain, result);
        
        deleteUpdate(_domainHash);
    }
    
    
    function getOwnershipClaim (string _domain) public view returns (address, string, string, Stage, address[], uint256, address[], uint256) {
        
        bytes32 domainHash = keccak256(_domain);
        
        return (
            ownershipClaimTable[domainHash].proposer, 
            ownershipClaimTable[domainHash].domain, 
            ownershipClaimTable[domainHash].record, 
            ownershipClaimTable[domainHash].stage, 
            ownershipClaimTable[domainHash].committeeForValid,
            ownershipClaimTable[domainHash].weightForValid,
            ownershipClaimTable[domainHash].committeeForInvalid,
            ownershipClaimTable[domainHash].weightForInvalid);
    }
    
    
    function getVoterForOnwershipInfo (string _domain, address _committeeMember) public view returns (Votes, uint256) {
        
        bytes32 domainHash = keccak256(_domain);
        
        return (
            ownershipClaimTable[domainHash].committee[_committeeMember].result, 
            ownershipClaimTable[domainHash].committee[_committeeMember].weight);
    }
    
    
    function getUpdate (string _domain) public view returns (string, string, Stage, address[], uint256, address[], uint256) {
        
        bytes32 domainHash = keccak256(_domain);
        
        return (
            updatesTable[domainHash].domain, 
            updatesTable[domainHash].record, 
            updatesTable[domainHash].stage, 
            updatesTable[domainHash].committeeForValid,
            updatesTable[domainHash].weightForValid,
            updatesTable[domainHash].committeeForInvalid,
            updatesTable[domainHash].weightForInvalid);
    }
    
    
    
    function getVoterForUpdateInfo (string _domain, address _committeeMember) public view returns (Votes, uint256) {
        
        bytes32 domainHash = keccak256(_domain);
        
        return (
            updatesTable[domainHash].committee[_committeeMember].result, 
            updatesTable[domainHash].committee[_committeeMember].weight);
    }
    
    
    function getDNSRecordSet (string _domain) public view returns (address, string) {
            
        bytes32 domainHash = keccak256(_domain);
        
        return (dnsRecordSets[domainHash].owner, dnsRecordSets[domainHash].record);
    }
    
    
    //for test purpose, need automatic solution
    function changeVotingStageForUpdate (string _domain, Stage _stage) public ownerPrivilege returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        
        updatesTable[domainHash].stage = _stage;
        if (_stage == Stage.Done) {
            voteCompleteForUpdate(domainHash);
        }
        
        return true;
    }
    
    function changeVotingStageForOwnership (string _domain, Stage _stage) public ownerPrivilege returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        
        ownershipClaimTable[domainHash].stage = _stage;
        if (_stage == Stage.Done) {
            voteCompleteForOwnership(domainHash);
        }
        
        return true;
    }
    
}