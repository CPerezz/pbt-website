-- D1 (clickhouse-raw, the W_L ranges: 200 blocks every 250,000 from block 1,000,000).
-- Share of net per-tx slot writes that land in slots 0-63, by million-block era.
SELECT intDiv(block_number, 1000000)                         AS mblock,
       count()                                               AS writes,
       countIf(slot < {L64})                                 AS hdr_writes,
       uniqExact(block_number, address)                      AS contract_blocks,
       uniqExactIf((block_number, address), slot < {L64})    AS contract_blocks_hdr
FROM (SELECT DISTINCT block_number, transaction_hash, address, slot
      FROM canonical_execution_storage_diffs WHERE {R})
GROUP BY mblock ORDER BY mblock
