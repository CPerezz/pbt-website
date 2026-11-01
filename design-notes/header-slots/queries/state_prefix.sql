-- Notes in-the-header, flat-record (clickhouse-refined, one address prefix).
-- Live storage at block 26,300,000 per contract: h = live slots 0-63, o = live slots from 64 up, groups = the
-- storage groups those slots fill (one bucket per contract with o > 0). Grouped by h so prefixes can be summed.
WITH
live AS (SELECT address, slot_key, argMax(effective_bytes_to, block_number) AS eb
         FROM mainnet.int_storage_slot_diff_by_address_slot FINAL
         WHERE address LIKE '{PREFIX}%' AND block_number <= 26300000
         GROUP BY address, slot_key HAVING eb > 0),
pa AS (SELECT address,
              countIf(slot_key < {L64})                                AS h,
              countIf(slot_key >= {L64})                               AS o,
              uniqExactIf(substring(slot_key, 1, 64), slot_key >= {L64}) AS groups
       FROM live GROUP BY address)
SELECT h, o > 0 AS has_bucket, count() AS contracts, sum(o) AS zone_slots, sum(groups) AS zone_groups
FROM pa GROUP BY h, has_bucket ORDER BY h, has_bucket
