-- Path-model input for notes in-the-header and proxy-slots (clickhouse-raw, the model windows).
-- Per contract, over (block, contract) pairs:
--   g0_*: pairs whose group-0 path EIP-8297 avoids. "alone": the contract opens no other storage group in that block,
--         so the avoided path runs from the storage-zone top to its bucket; "with": it shares the bucket path.
--   px_*: pairs that read a proxy slot (each one its own storage group). "alone": proxy slots are all the contract
--         opens in the storage zone that block, so aliasing them into the header drops its whole bucket path.
-- k = storage buckets the block opens (those paths share the top ~log2 k levels); g_other = groups above slot 255.
WITH
acc AS (SELECT DISTINCT block_number AS b, contract_address AS a, slot
        FROM canonical_execution_storage_reads WHERE {R}),
pa AS (SELECT b, a,
              countIf(slot < {L256})                                                   AS n0,
              maxIf(reinterpretAsUInt8(unhex(substring(slot, 65, 2))), slot < {L256}) AS max0,
              uniqExactIf(substring(slot, 1, 64), slot >= {L256})                      AS g_other,
              countIf(slot IN ({PROXY}))                                               AS n_px
       FROM acc GROUP BY b, a),
kb AS (SELECT b, countIf(g_other > 0 OR (n0 > 0 AND max0 >= 64)) AS k FROM pa GROUP BY b),
j AS (SELECT pa.*, kb.k AS k,
             n0 > 0 AND max0 < 64                                        AS is_g0,
             n_px > 0 AND g_other = n_px AND NOT (n0 > 0 AND max0 >= 64) AS is_px_alone
      FROM pa GLOBAL INNER JOIN kb ON pa.b = kb.b)
SELECT a,
  countIf(is_g0 AND g_other = 0)                                  AS g0_alone,
  sumIf(log2(greatest(k, 1)), is_g0 AND g_other = 0)              AS g0_alone_log2k,
  countIf(is_g0 AND g_other > 0)                                  AS g0_with,
  sumIf(log2(greatest(g_other, 1)), is_g0 AND g_other > 0)        AS g0_with_log2g,
  countIf(is_px_alone)                                            AS px_alone,
  sumIf(log2(greatest(k, 1)), is_px_alone)                        AS px_alone_log2k,
  sumIf(n_px, is_px_alone)                                        AS px_alone_slots,
  sumIf(n_px, n_px > 0 AND NOT is_px_alone)                       AS px_with_slots,
  sumIf(n_px * log2(greatest(g_other, 1)), n_px > 0 AND NOT is_px_alone) AS px_with_log2g
FROM j
GROUP BY a
HAVING g0_alone + g0_with + px_alone + px_with_slots > 0
