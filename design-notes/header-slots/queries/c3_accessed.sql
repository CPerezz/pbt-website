-- C3 (clickhouse-raw, one contiguous window, one address prefix).
-- Accounts the block touches (their header stem is read) and in how many blocks.
SELECT address AS a, uniqExact(block_number) AS blocks
FROM canonical_execution_balance_reads
WHERE {R} AND address LIKE '{PREFIX}%'
GROUP BY a
