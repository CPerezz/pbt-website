-- Note proxy-slots (clickhouse-raw, one W_R chunk): top 100 contracts by cold charges on the EIP-1967 proxy slots.
SELECT contract_address AS a, count() AS proxy_access, uniqExact(block_number) AS blocks
FROM (SELECT DISTINCT block_number, transaction_hash, contract_address, slot
      FROM canonical_execution_storage_reads WHERE {R} AND slot IN ({PROXY}))
GROUP BY a ORDER BY proxy_access DESC LIMIT 100
