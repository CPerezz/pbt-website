-- Dates for the chunk, era and window boundaries (clickhouse-raw).
SELECT block_number, toString(block_date_time) AS t, gas_used, gas_limit
FROM canonical_execution_block
WHERE meta_network_name = 'mainnet' AND block_number IN ({BLOCKS})
ORDER BY block_number
