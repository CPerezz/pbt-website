-- A3 (clickhouse-raw, one W_R chunk): top 100 tx targets by gas saved at the default prices
-- (2,000 per cold charge on slots 0-63, 2,800 per header change rule A2 discounts; see tx_savings.sql).
WITH
r AS (SELECT transaction_hash AS h, toInt64(countIf(slot < {L64})) AS t_hdr
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
w AS (SELECT h, sum(if(dirty, c64, greatest(c64 - 1, toInt64(0)))) AS t_disc
      FROM (SELECT sd.*, (h, a) GLOBAL IN (SELECT h, a FROM hd) AS dirty FROM sd) GROUP BY h),
tx AS (SELECT DISTINCT transaction_hash AS h, toInt64(gas_used) AS g, ifNull(to_address, '') AS target
       FROM canonical_execution_transaction WHERE {R})
SELECT tx.target AS target, count() AS txs, sum(tx.g) AS gas,
       sum(2000 * r.t_hdr + 2800 * w.t_disc) AS saved
FROM tx GLOBAL LEFT JOIN r ON tx.h = r.h GLOBAL LEFT JOIN w ON tx.h = w.h
GROUP BY target ORDER BY saved DESC LIMIT 100
