-- Model M input for B1 (clickhouse-raw, one contiguous window).
-- Per contract: blocks where EIP-8297 shares one path for a header change and slot writes (shared64), and blocks
-- where the split of group 0 costs it an extra path (split64). Definitions as in paths_writes.sql.
WITH
sd AS (SELECT block_number AS b, address AS a, slot,
              argMin(from_value, (transaction_index, internal_index)) AS f,
              argMax(to_value,   (transaction_index, internal_index)) AS t
       FROM canonical_execution_storage_diffs WHERE {R}
       GROUP BY b, a, slot HAVING f != t),
bd AS (SELECT b, a FROM (SELECT block_number AS b, address AS a,
                                argMin(from_value, (transaction_index, internal_index)) AS f,
                                argMax(to_value,   (transaction_index, internal_index)) AS t
                         FROM canonical_execution_balance_diffs WHERE {R} GROUP BY b, a HAVING f != t)
       UNION DISTINCT
       SELECT b, a FROM (SELECT block_number AS b, address AS a,
                                argMin(from_value, (transaction_index, internal_index)) AS f,
                                argMax(to_value,   (transaction_index, internal_index)) AS t
                         FROM canonical_execution_nonce_diffs WHERE {R} GROUP BY b, a HAVING f != t)),
pa AS (SELECT b, a,
              countIf(slot < {L256})                                                   AS n0,
              minIf(reinterpretAsUInt8(unhex(substring(slot, 65, 2))), slot < {L256}) AS min0,
              maxIf(reinterpretAsUInt8(unhex(substring(slot, 65, 2))), slot < {L256}) AS max0
       FROM sd GROUP BY b, a),
j AS (SELECT pa.*, (b, a) GLOBAL IN (SELECT b, a FROM bd) AS hc FROM pa)
SELECT a,
       countIf(n0 > 0 AND hc AND max0 < 64)                        AS shared64,
       countIf(n0 > 0 AND NOT hc AND min0 < 64 AND max0 >= 64)     AS split64
FROM j
GROUP BY a
HAVING shared64 > 0 OR split64 > 0
