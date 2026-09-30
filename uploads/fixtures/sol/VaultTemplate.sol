// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.30;

/// @notice Minimal factory-deployed template used to demo PBT code
/// deduplication: every deployment shares runtime bytecode (and code_hash)
/// even though constructor args and addresses differ.
contract VaultTemplate {
    address public owner;
    uint256 public balance;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address initialOwner) {
        owner = initialOwner;
    }

    function deposit() external payable {
        balance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "VaultTemplate: not owner");
        require(amount <= balance, "VaultTemplate: insufficient");
        balance -= amount;
        payable(owner).transfer(amount);
        emit Withdrawn(owner, amount);
    }
}
