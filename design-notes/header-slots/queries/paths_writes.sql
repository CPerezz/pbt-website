-- B1, C1 (clickhouse-raw, one W_R chunk).
-- Net changes per block. hc: the contract's nonce or balance changed in the block, so its header path is re-hashed.
-- sharedN: hc, and every changed slot below 256 is below N -> one path instead of two (slide-21 claim 1).
-- splitN: no hc, and changed slots on both sides of N inside 0-255 -> two paths instead of one.
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
         maxIf(reinterpretAsUInt8(unhex(substring(slot, 65, 2))), slot < {L256}) AS max0,
         uniqExactIf(substring(slot, 1, 64), slot >= {L256})                      AS g_other
       FROM sd GROUP BY b, a),
j AS (SELECT pa.*, (b, a) GLOBAL IN (SELECT b, a FROM bd) AS hc FROM pa)
SELECT
  (SELECT count() FROM bd)                     AS header_changed,
  count()                                      AS contracts_written,
  countIf(n0 > 0 AND min0 < 64 AND NOT hc)     AS header_dirty_by_slots64,
  sum(g_other)                                 AS zone_groups_other,
  countIf(n0 > 0 AND max0 >= 64)               AS g0_zone_8297,
  countIf(n0 > 0)                              AS g0_zone_no_header,
  countIf(n0 > 0 AND hc AND max0 < 2)   AS shared2,   countIf(n0 > 0 AND NOT hc AND min0 < 2   AND max0 >= 2)   AS split2,
  countIf(n0 > 0 AND hc AND max0 < 4)   AS shared4,   countIf(n0 > 0 AND NOT hc AND min0 < 4   AND max0 >= 4)   AS split4,
  countIf(n0 > 0 AND hc AND max0 < 16)  AS shared16,  countIf(n0 > 0 AND NOT hc AND min0 < 16  AND max0 >= 16)  AS split16,
  countIf(n0 > 0 AND hc AND max0 < 32)  AS shared32,  countIf(n0 > 0 AND NOT hc AND min0 < 32  AND max0 >= 32)  AS split32,
  countIf(n0 > 0 AND hc AND max0 < 64)  AS shared64,  countIf(n0 > 0 AND NOT hc AND min0 < 64  AND max0 >= 64)  AS split64,
  countIf(n0 > 0 AND hc AND max0 < 128) AS shared128, countIf(n0 > 0 AND NOT hc AND min0 < 128 AND max0 >= 128) AS split128,
  countIf(n0 > 0 AND hc AND max0 < 192) AS shared192, countIf(n0 > 0 AND NOT hc AND min0 < 192 AND max0 >= 192) AS split192,
  countIf(n0 > 0 AND hc)                AS shared256
FROM j
