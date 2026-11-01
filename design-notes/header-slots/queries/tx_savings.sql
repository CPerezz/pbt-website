-- Note gas-rule (clickhouse-raw, one W_R chunk).
-- Per tx: t_hdr = cold charges on slots 0-63 (the read rule); t_disc = header changes the write rule discounts (see write_totals.sql).
-- Savings at the default prices (header-slot read 100, further header write 100) are 2,000 per t_hdr
-- (2,100 cold -> 100) and 2,800 per t_disc (2,900 change -> 100). Shares are binned so chunks can be summed.
-- Sources are read through DISTINCT: the canonical_* tables carry exact duplicate rows for some ranges.
WITH
r AS (SELECT transaction_hash AS h,
             toInt64(countIf(slot < {L64}))                                AS t_hdr,
             toInt64(countIf(slot < {L64} AND contract_address != {USDT})) AS t_hdr_nousdt
      FROM (SELECT DISTINCT transaction_hash, contract_address, slot
            FROM canonical_execution_storage_reads WHERE {R})
      GROUP BY h),
sd AS (SELECT transaction_hash AS h, address AS a, toInt64(countIf(from_value != {ZERO})) AS c64
       FROM (SELECT DISTINCT transaction_hash, address, slot, from_value
             FROM canonical_execution_storage_diffs WHERE {R} AND slot < {L64})
       GROUP BY h, a),
hd AS (SELECT DISTINCT transaction_hash AS h, address AS a FROM canonical_execution_balance_diffs WHERE {R}
       UNION DISTINCT
       SELECT DISTINCT transaction_hash AS h, address AS a FROM canonical_execution_nonce_diffs WHERE {R}),
w AS (SELECT h,
             sum(if(dirty, c64, greatest(c64 - 1, toInt64(0))))                AS t_disc,
             sumIf(if(dirty, c64, greatest(c64 - 1, toInt64(0))), a != {USDT}) AS t_disc_nousdt
      FROM (SELECT sd.*, (h, a) GLOBAL IN (SELECT h, a FROM hd) AS dirty FROM sd) GROUP BY h),
tx AS (SELECT DISTINCT transaction_hash AS h, toInt64(gas_used) AS g
       FROM canonical_execution_transaction WHERE {R}),
j AS (SELECT tx.g AS g, r.t_hdr AS t_hdr, r.t_hdr_nousdt AS t_hdr_nousdt, w.t_disc AS t_disc,
             w.t_disc_nousdt AS t_disc_nousdt, (2000 * r.t_hdr + 2800 * w.t_disc) / tx.g AS s
      FROM tx GLOBAL LEFT JOIN r ON tx.h = r.h GLOBAL LEFT JOIN w ON tx.h = w.h
      WHERE tx.g > 0)
SELECT
  count() AS txs, sum(g) AS gas,
  sum(t_hdr) AS hdr_access, sum(t_hdr_nousdt) AS hdr_access_nousdt,
  sum(t_disc) AS disc, sum(t_disc_nousdt) AS disc_nousdt,
  countIf(t_hdr > 0) AS txs_hdr, countIf(t_disc > 0) AS txs_disc, countIf(s > 0) AS txs_gain,
  countIf(s = 0) AS b0,
  countIf(s > 0    AND s <= 0.01) AS b1,
  countIf(s > 0.01 AND s <= 0.02) AS b2,
  countIf(s > 0.02 AND s <= 0.05) AS b5,
  countIf(s > 0.05 AND s <= 0.10) AS b10,
  countIf(s > 0.10 AND s <= 0.20) AS b20,
  countIf(s > 0.20)               AS b100
FROM j
