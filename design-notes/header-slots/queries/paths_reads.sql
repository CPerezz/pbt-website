-- Notes in-the-header (witness), how-many, proxy-slots, flat-record (clickhouse-raw, one W_R chunk).
-- Per block and contract: the slots the block reads. Under EIP-8297 slots 0-63 sit in the contract's header stem,
-- which the block already opens to run its code. With no header slots they would sit in storage group 0 (slots
-- 0-255) of its bucket, a separate path. sN: contracts whose group-0 path a header of N slots avoids (every slot
-- below 256 they read is below N). g_other: storage groups above slot 255 the contract opens in the same block.
-- Per-block values are prefixed pb_; the output sums them over the chunk.
WITH
acc AS (SELECT DISTINCT block_number AS b, contract_address AS a, slot
        FROM canonical_execution_storage_reads WHERE {R}),
pa AS (
  SELECT b, a,
    countIf(slot < {L256})                                                     AS n0,
    maxIf(reinterpretAsUInt8(unhex(substring(slot, 65, 2))), slot < {L256})   AS max0,
    uniqExactIf(substring(slot, 1, 64), slot >= {L256})                        AS g_other,
    countIf(slot IN ({PROXY}))                                                 AS n_px,
    countIf(slot < {L64})                                                      AS n_hdr,
    count()                                                                    AS n_slots
  FROM acc GROUP BY b, a),
pb AS (
  SELECT b,
    count() AS pb_storage_accounts, sum(n_slots) AS pb_slots, sum(n_hdr) AS pb_hdr_slots,
    countIf(n0 > 0 AND max0 < 2)   AS pb_s2,
    countIf(n0 > 0 AND max0 < 4)   AS pb_s4,
    countIf(n0 > 0 AND max0 < 16)  AS pb_s16,
    countIf(n0 > 0 AND max0 < 32)  AS pb_s32,
    countIf(n0 > 0 AND max0 < 64)  AS pb_s64,
    countIf(n0 > 0 AND max0 < 128) AS pb_s128,
    countIf(n0 > 0 AND max0 < 192) AS pb_s192,
    countIf(n0 > 0)                AS pb_s256,
    countIf(n0 > 0 AND max0 < 64 AND g_other = 0)          AS pb_s64_no_other,
    sum(g_other) + countIf(n0 > 0 AND max0 >= 64)          AS pb_zone_8297,
    sum(g_other) + countIf(n0 > 0)                         AS pb_zone_no_header,
    countIf(g_other > 0 OR (n0 > 0 AND max0 >= 64))        AS pb_buckets_8297,
    countIf(n_px > 0)                                      AS pb_px_contracts,
    sum(n_px)                                              AS pb_px_paths,
    countIf(n_px > 0 AND g_other = n_px AND NOT (n0 > 0 AND max0 >= 64)) AS pb_px_whole_bucket
  FROM pa GROUP BY b),
hs AS (SELECT block_number AS b, uniqExact(address) AS pb_accounts
       FROM canonical_execution_balance_reads WHERE {R} GROUP BY b)
SELECT
  count() AS blocks, sum(hs.pb_accounts) AS header_stems,
  sum(pb_storage_accounts) AS storage_accounts, sum(pb_slots) AS slots, sum(pb_hdr_slots) AS hdr_slots,
  sum(pb_s2) AS s2, sum(pb_s4) AS s4, sum(pb_s16) AS s16, sum(pb_s32) AS s32, sum(pb_s64) AS s64,
  sum(pb_s128) AS s128, sum(pb_s192) AS s192, sum(pb_s256) AS s256, sum(pb_s64_no_other) AS s64_no_other,
  sum(pb_zone_8297) AS zone_paths_8297, sum(pb_zone_no_header) AS zone_paths_no_header,
  sum(pb_buckets_8297) AS buckets_8297,
  sum(pb_px_contracts) AS px_contracts, sum(pb_px_paths) AS px_paths, sum(pb_px_whole_bucket) AS px_whole_bucket,
  quantileExact(0.1)(pb_s64) AS s64_p10, quantileExact(0.5)(pb_s64) AS s64_p50, quantileExact(0.9)(pb_s64) AS s64_p90
FROM pb GLOBAL LEFT JOIN hs ON pb.b = hs.b
