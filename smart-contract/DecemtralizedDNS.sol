pragma solidity ^0.4.25;

contract DecentralizedDNS {
    
    address contractOwner;
    uint64 public numberOfDomains;
    uint64 public constant updatePrice = 1 ether;
    uint64 public constant maxRegTime = 5 minutes;
    uint8 public validThrehold = 4; // verified weighted votes is at least 4 times unverified weighted votes
    
    enum Stage {Init, Reg, Vote, Done}
    
    struct CommitteeMember {
        bool isMember;
        bool voted;
        bool domainVerified;
        uint weight;
    }
    
    struct Update {
        address proposer;
        string domain;
        string record;
        //uint expiration;
        uint time;
        Stage stage;
        mapping (address => CommitteeMember) committee;
        address[] committeeMember;
    }
    
    struct RecordSet {
        address owner;
        string domain;
        //uint expiration;
        string record;
    }
    
    mapping (bytes32 => Update) updatesTable;
    mapping (bytes32 => RecordSet) dnsRecordSets;
    
    
    event NewUpdate (address proposer, string domain, bool needVote);
    event VoteResult (string domain, bool isValid);
    event RecordDeleted (string domain);
    
    
    modifier ownerPrivilege {
        require (msg.sender == contractOwner);
        _;
    }
    
    
    constructor () {
        contractOwner = msg.sender;
    }
    
    
    function addRecordSet (bytes32 _domainHash) private {
        
        dnsRecordSets[_domainHash].owner = updatesTable[_domainHash].proposer;
        dnsRecordSets[_domainHash].domain = updatesTable[_domainHash].domain;
        //dnsRecordSets[_domainHash].expiration = updatesTable[_domainHash].expiration;
        dnsRecordSets[_domainHash].record = updatesTable[_domainHash].record;
        
    }
    
    
    function deleteUpdate (bytes32 _domainHash) private {
        
        for (uint i = 0; i < updatesTable[_domainHash].committeeMember.length; i++) {
            delete updatesTable[_domainHash].committee[updatesTable[_domainHash].committeeMember[i]];
        }
        delete updatesTable[_domainHash];
        
    }
    
    
    function sendUpdate (string _domain, string _record) payable public {
        
        bytes32 domainHash = keccak256(_domain);
        
        if (msg.sender == dnsRecordSets[domainHash].owner) {
            dnsRecordSets[domainHash].record = _record;
            emit NewUpdate (msg.sender, _domain, false);
        }
        else{
            require (msg.value == updatePrice, "Price for update is not enough."); 
            require(updatesTable[domainHash].time == 0, "Domain update in progress.");
            
            updatesTable[domainHash].proposer = msg.sender;
            updatesTable[domainHash].domain = _domain;
            updatesTable[domainHash].record = _record;
            //updatesTable[domainHash].expiration = _expiration;
            updatesTable[domainHash].time = now;
            updatesTable[domainHash].stage = Stage.Reg;
            
            emit NewUpdate (msg.sender, _domain, true);
        }
    }
    
    
    function register (string _domain) public returns (bool) {
        
        bytes32 domainHash = keccak256(_domain);
        
        require (updatesTable[domainHash].stage == Stage.Reg, "Not in registration stage.");
        require(updatesTable[domainHash].time != 0, "Domain update has not started.");
        require(updatesTable[domainHash].committee[msg.sender].isMember == false, "You are already a committee member for this domain update.");
        require(now - updatesTable[domainHash].time <= maxRegTime, "Maximum registration time has reached.");
        
        updatesTable[domainHash].committeeMember.push(msg.sender);
        updatesTable[domainHash].committee[msg.sender].isMember = true;
        
        return true;
    }
    
    
    function vote (string _domain, bool _domainVerified) public returns (bool)  {
        
        bytes32 domainHash = keccak256(_domain);
        
        require(updatesTable[domainHash].stage == Stage.Vote, "Not in the voting stage.");
        require(updatesTable[domainHash].committee[msg.sender].isMember, "You are not the committee member for his domain update."); 
        require(updatesTable[domainHash].committee[msg.sender].voted == false, "You have voted for this domain.");
        
        updatesTable[domainHash].committee[msg.sender].voted = true;
        updatesTable[domainHash].committee[msg.sender].domainVerified = _domainVerified;
        updatesTable[domainHash].committee[msg.sender].weight = msg.sender.balance;
        
        return true;
    }
    
    
    function voteComplete (bytes32 _domainHash) private returns (bool) {
        
        //require(updatesTable[domainHash].stage == Stage.Done, "Voting not yet finished.");
        
        bool result;
        uint totalWeightedVerifiedVotes = 0;
        uint totalWeightedUnverifiedVotes = 0;
        
        for (uint i = 0; i < updatesTable[_domainHash].committeeMember.length; i++) {
            if (updatesTable[_domainHash].committee[updatesTable[_domainHash].committeeMember[i]].isMember == true){
                if (updatesTable[_domainHash].committee[updatesTable[_domainHash].committeeMember[i]].voted == true) {
                    totalWeightedVerifiedVotes += updatesTable[_domainHash].committee[updatesTable[_domainHash].committeeMember[i]].weight;
                }
                else {
                    totalWeightedUnverifiedVotes += updatesTable[_domainHash].committee[updatesTable[_domainHash].committeeMember[i]].weight;
                }
            }
        }
        
        if (totalWeightedVerifiedVotes / validThrehold >= totalWeightedUnverifiedVotes) {
            result = true;
            addRecordSet(_domainHash);
        }
        else {
            result = false;
        }
        
        deleteUpdate(_domainHash);
        
        emit VoteResult(updatesTable[_domainHash].domain, result);
    }
    
    
    function deleteRecord (string _domain) public returns (bool) {
        
        require(msg.sender == dnsRecordSets[domainHash].owner);
        
        bytes32 domainHash = keccak256(_domain);
        delete dnsRecordSets[domainHash].owner;
        delete dnsRecordSets[domainHash].domain;
        delete dnsRecordSets[domainHash].record;
        
        emit RecordDeleted(_domain);
    }
    
    
    function getUpdate (string _domain) public view returns (address, string, string, uint, Stage, address[]) {
        
        bytes32 domainHash = keccak256(_domain);
        
        return (updatesTable[domainHash].proposer, updatesTable[domainHash].domain, updatesTable[domainHash].record, updatesTable[domainHash].time, updatesTable[domainHash].stage, updatesTable[domainHash].committeeMember);
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
