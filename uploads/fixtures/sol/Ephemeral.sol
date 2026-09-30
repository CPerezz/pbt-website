// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.30;

/// @notice Tiny, distinct-bytecode contract used only for the J11
/// SELFDESTRUCT-in-creating-tx demo where code is NOT shared with any other
/// account, so its code-zone leaves are removed (contrast with a
/// VaultTemplate instance, whose code chunks survive because 2 siblings
/// still reference the same code_hash).
contract Ephemeral {
    uint256 public x = 1;

    function poke() external {
        x++;
    }
}
