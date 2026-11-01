-- Notes in-the-header, gas-rule, how-many, proxy-slots (clickhouse-raw, one W_R chunk).
-- storage_reads holds one row per (tx, contract, slot) the tx touched, written slots included: one row = one
-- EIP-2929 cold charge. hdrN counts the charges on slots < N, the slots a header of N slots would hold.
-- The canonical_* tables carry exact duplicate rows for some ranges, so every source is read through DISTINCT.
SELECT
  count()                     AS accesses,
  uniqExact(transaction_hash) AS txs_with_storage,
  countIf(slot < {L2})        AS hdr2,
  countIf(slot < {L4})        AS hdr4,
  countIf(slot < {L16})       AS hdr16,
  countIf(slot < {L32})       AS hdr32,
  countIf(slot < {L64})       AS hdr64,
  countIf(slot < {L128})      AS hdr128,
  countIf(slot < {L192})      AS hdr192,
  countIf(slot < {L256})      AS hdr256,
  countIf(slot < {L64} AND contract_address = {USDT}) AS hdr64_usdt,
  countIf(slot IN ({PROXY}))  AS proxy
FROM (SELECT DISTINCT transaction_hash, contract_address, slot
      FROM canonical_execution_storage_reads WHERE {R})
