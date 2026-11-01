-- Path-model input (clickhouse-refined): live storage slots per contract at block {X}, for a batch of contracts.
-- For mapping-heavy contracts this is close to the number of storage groups in the contract's bucket.
SELECT address AS a, argMax(active_slots, block_number) AS slots
FROM mainnet.int_storage_slot_state_by_address FINAL
WHERE address IN ({ADDRS}) AND block_number <= {X}
GROUP BY address
