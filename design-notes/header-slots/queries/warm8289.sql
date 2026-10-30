-- A1 (clickhouse-raw, one contiguous window).
-- Of the cold charges on slots 0-63, how many hit a (contract, slot) the chain read in one of the previous W blocks.
-- Under EIP-8289 (multi-block warming) those would be warm already, so a header-slot discount adds nothing there.
-- Charges in the first 128 blocks of the window only feed the lookback (block_number >= SKIP_FROM below).
WITH
acc AS (SELECT DISTINCT block_number AS b, contract_address AS a, slot
        FROM canonical_execution_storage_reads WHERE {R} AND slot < {L64}),
lg AS (SELECT b, a, slot,
              lagInFrame(b, 1, 0) OVER (PARTITION BY a, slot ORDER BY b
                                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS prev_b
       FROM acc),
tx AS (SELECT DISTINCT block_number AS b, transaction_hash AS h, contract_address AS a, slot
       FROM canonical_execution_storage_reads
       WHERE {R} AND slot < {L64} AND block_number >= {SKIP_FROM})
SELECT count()                                               AS hdr_charges,
       countIf(lg.prev_b > 0 AND tx.b - lg.prev_b <= 8)      AS warm8,
       countIf(lg.prev_b > 0 AND tx.b - lg.prev_b <= 32)     AS warm32,
       countIf(lg.prev_b > 0 AND tx.b - lg.prev_b <= 128)    AS warm128
FROM tx GLOBAL INNER JOIN lg ON tx.b = lg.b AND tx.a = lg.a AND tx.slot = lg.slot
