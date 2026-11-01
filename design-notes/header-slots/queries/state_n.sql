-- Note how-many (clickhouse-refined, one address prefix).
-- Live storage at block 26,300,000 for a header of N slots: nbN = contracts whose live slots all sit below N (no
-- storage bucket), hsN = live slots below N (what their headers would hold). Prefixes can be summed.
WITH
live AS (SELECT address, slot_key, argMax(effective_bytes_to, block_number) AS eb
         FROM mainnet.int_storage_slot_diff_by_address_slot FINAL
         WHERE address LIKE '{PREFIX}%' AND block_number <= 26300000
         GROUP BY address, slot_key HAVING eb > 0),
pa AS (SELECT address, count() AS n,
              countIf(slot_key < {L2}) AS h2, countIf(slot_key < {L4}) AS h4, countIf(slot_key < {L16}) AS h16,
              countIf(slot_key < {L32}) AS h32, countIf(slot_key < {L64}) AS h64, countIf(slot_key < {L128}) AS h128,
              countIf(slot_key < {L192}) AS h192, countIf(slot_key < {L256}) AS h256
       FROM live GROUP BY address)
SELECT count() AS contracts, sum(n) AS slots,
       countIf(h2 = n) AS nb2, countIf(h4 = n) AS nb4, countIf(h16 = n) AS nb16, countIf(h32 = n) AS nb32,
       countIf(h64 = n) AS nb64, countIf(h128 = n) AS nb128, countIf(h192 = n) AS nb192, countIf(h256 = n) AS nb256,
       sum(h2) AS hs2, sum(h4) AS hs4, sum(h16) AS hs16, sum(h32) AS hs32,
       sum(h64) AS hs64, sum(h128) AS hs128, sum(h192) AS hs192, sum(h256) AS hs256
FROM pa
