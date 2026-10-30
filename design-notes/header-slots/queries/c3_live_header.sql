-- C3 (clickhouse-refined): live slots 0-63 per contract at block {X}, for a batch of accounts.
SELECT address AS a, countIf(eb > 0) AS h
FROM (SELECT address, slot_key, argMax(effective_bytes_to, block_number) AS eb
      FROM mainnet.int_storage_slot_diff_by_address_slot FINAL
      WHERE address IN ({ADDRS}) AND slot_key < {L64} AND block_number <= {X}
      GROUP BY address, slot_key)
GROUP BY a
