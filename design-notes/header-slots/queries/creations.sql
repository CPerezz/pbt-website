-- Note in-the-header (clickhouse-raw, a W_R chunk or the W_L ranges).
-- New contracts, classed by the storage they hold when their creation tx ends:
-- header_only = every non-zero slot is below 64 (EIP-8297 never creates a storage bucket for them).
-- empty_code: created with no code (or destroyed in the same tx); kept apart.
WITH
c AS (SELECT DISTINCT block_number AS b, transaction_hash AS h, contract_address AS a, n_code_bytes
      FROM canonical_execution_contracts WHERE {R}),
s AS (SELECT block_number AS b, transaction_hash AS h, address AS a, slot,
             argMax(to_value, internal_index) AS t
      FROM canonical_execution_storage_diffs
      WHERE {R} AND (block_number, transaction_hash, address) GLOBAL IN (SELECT b, h, a FROM c)
      GROUP BY b, h, a, slot HAVING t != {ZERO}),
per AS (SELECT c.b AS b, c.a AS a, any(c.n_code_bytes) AS code_bytes,
               countIf(s.slot != '')                      AS n_slots,
               countIf(s.slot != '' AND s.slot < {L64})   AS n_hdr,
               countIf(s.slot >= {L64})                   AS n_over
        FROM c GLOBAL LEFT JOIN s ON c.b = s.b AND c.h = s.h AND c.a = s.a
        GROUP BY c.b, c.a)
SELECT
  intDiv(b, 1000000) AS mblock,
  count()                                                AS creations,
  countIf(code_bytes = 0)                                AS empty_code,
  countIf(code_bytes > 0 AND n_slots = 0)                AS no_storage,
  countIf(code_bytes > 0 AND n_slots > 0 AND n_over = 0) AS header_only,
  countIf(code_bytes > 0 AND n_hdr = 0 AND n_over > 0)   AS zone_only,
  countIf(code_bytes > 0 AND n_hdr > 0 AND n_over > 0)   AS both
FROM per
GROUP BY mblock ORDER BY mblock
