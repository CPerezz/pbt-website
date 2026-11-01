-- Notes gas-rule, how-many (clickhouse-raw, one W_R chunk).
-- Net per-tx slot writes per (tx, contract). A write is a "create" if the slot was zero before the tx (EIP-2200 set,
-- state growth), else a "change". dirty: the contract's nonce or balance also changed in that tx, so its header is
-- re-hashed anyway. The write rule: the first header change in a tx pays as today unless dirty; every further one pays the
-- warm-write price. discN: the changes that rule discounts if the header held slots < N.
WITH
sd AS (
  SELECT transaction_hash AS h, address AS a,
    toInt64(countIf(slot < {L64}))                           AS w64,
    toInt64(countIf(slot < {L64} AND from_value = {ZERO}))   AS create64,
    toInt64(countIf(slot < {L4}   AND from_value != {ZERO})) AS c4,
    toInt64(countIf(slot < {L16}  AND from_value != {ZERO})) AS c16,
    toInt64(countIf(slot < {L32}  AND from_value != {ZERO})) AS c32,
    toInt64(countIf(slot < {L64}  AND from_value != {ZERO})) AS c64,
    toInt64(countIf(slot < {L128} AND from_value != {ZERO})) AS c128,
    toInt64(countIf(slot < {L192} AND from_value != {ZERO})) AS c192,
    toInt64(countIf(from_value != {ZERO}))                   AS c_all
  FROM (SELECT DISTINCT transaction_hash, address, slot, from_value
        FROM canonical_execution_storage_diffs WHERE {R})
  GROUP BY h, a),
hd AS (
  SELECT DISTINCT transaction_hash AS h, address AS a FROM canonical_execution_balance_diffs WHERE {R}
  UNION DISTINCT
  SELECT DISTINCT transaction_hash AS h, address AS a FROM canonical_execution_nonce_diffs WHERE {R}),
j AS (SELECT sd.*, (h, a) GLOBAL IN (SELECT h, a FROM hd) AS dirty FROM sd)
SELECT
  sum(c_all)                 AS changes_all,
  sum(w64)                   AS hdr_writes64,
  sum(create64)              AS hdr_creates64,
  sum(c64)                   AS hdr_changes64,
  countIf(w64 > 0)           AS pairs64,
  countIf(w64 >= 2)          AS pairs64_2plus,
  countIf(w64 > 0 AND dirty) AS pairs64_dirty,
  sum(if(dirty, c4,   greatest(c4   - 1, toInt64(0)))) AS disc4,
  sum(if(dirty, c16,  greatest(c16  - 1, toInt64(0)))) AS disc16,
  sum(if(dirty, c32,  greatest(c32  - 1, toInt64(0)))) AS disc32,
  sum(if(dirty, c64,  greatest(c64  - 1, toInt64(0)))) AS disc64,
  sum(if(dirty, c128, greatest(c128 - 1, toInt64(0)))) AS disc128,
  sum(if(dirty, c192, greatest(c192 - 1, toInt64(0)))) AS disc192,
  sumIf(if(dirty, c64, greatest(c64 - 1, toInt64(0))), a = {USDT}) AS disc64_usdt
FROM j
