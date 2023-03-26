// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// dBashar contract interface used at the time of delegaion.
interface IDBashar {
    function delegateBySig(
        address delegatee,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

// Governance contract interface used at the time of voting.

interface IGovernance {
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

contract BatchVote is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable
{
    // Governance contract address
    address public governance;
    // dBashar contract address
    address public dBashar;

    // Structure used for batch delegate
    struct DelegateSignature {
        address delegatee;
        uint256 nonce;
        uint256 expiry;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // Structure used for batch vote
    struct CastVoteSignature {
        uint256 proposalId;
        uint8 support;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // Update contract addresses Event
    event UpdatedDbasharAddress(address indexed _dBashar);
    event UpdatedGovernanceAddress(address indexed _governance);

    function initialize(address _governance, address _dBashar)
        public
        initializer
    {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        require(_dBashar != address(0), "updatedBasharAddress: Zero address");
        require(
            _governance != address(0),
            "updatedGovernanceAddress: Zero address"
        );
        governance = _governance;
        dBashar = _dBashar;
    }

    /**
     * @notice Update dBashar contract address.
     * @dev Owner can update the dBashar contract address.
     */
    function updatedDbasharAddress(address _dBashar) external onlyOwner {
        require(_dBashar != address(0), "updatedBasharAddress: Zero address");
        dBashar = _dBashar;
        emit UpdatedDbasharAddress(_dBashar);
    }

    /**
     * @notice Update Governance contract address.
     * @dev Owner can update the governance contract address.
     */
    function updatedGovernanceAddress(address _governance) external onlyOwner {
        require(
            _governance != address(0),
            "updatedGovernanceAddress: Zero address"
        );
        governance = _governance;
        emit UpdatedGovernanceAddress(_governance);
    }

    /**
     * @notice Pause batch vote contract.
     * @dev Owner can pause the contract.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause batch vote contract.
     * @dev Owner can un-pause the contract.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Batch delegate using user signatures.
     * @dev Any user can call this function to delegate the user addresses.
     */
    function delegateBySigs(DelegateSignature[] memory sigs)
        external
        whenNotPaused
    {
        for (uint256 i = 0; i < sigs.length; i++) {
            DelegateSignature memory sig = sigs[i];
            IDBashar(dBashar).delegateBySig(
                sig.delegatee,
                sig.nonce,
                sig.expiry,
                sig.v,
                sig.r,
                sig.s
            );
        }
    }

    /**
     * @notice Batch voting using user signatures.
     * @dev Any user can call this function to cast votes in batch.
     */
    function castVoteBySigs(CastVoteSignature[] memory sigs)
        external
        whenNotPaused
    {
        for (uint256 i = 0; i < sigs.length; i++) {
            CastVoteSignature memory sig = sigs[i];
            IGovernance(governance).castVoteBySig(
                sig.proposalId,
                sig.support,
                sig.v,
                sig.r,
                sig.s
            );
        }
    }

    /**
     * @dev Authorize contract upgrade so that only owner can update.
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
}
