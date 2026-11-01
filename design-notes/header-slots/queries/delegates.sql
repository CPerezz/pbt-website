-- Note gas-rule (clickhouse-raw, one contiguous window).
-- EOAs with a live EIP-7702 delegation (latest authorization before {T_END} points to a non-zero target), their net
-- per-tx slot writes in the window by delegate, and how many came in a tx that also changed the EOA's nonce.
WITH
auth AS (SELECT lower(a) AS authority, argMax(lower(tgt), slot) AS target
         FROM canonical_beacon_block_execution_transaction
         ARRAY JOIN authorization_authorities AS a, authorization_addresses AS tgt
         WHERE meta_network_name = 'mainnet' AND slot_start_date_time >= '2025-05-07'
           AND slot_start_date_time < '{T_END}' AND type = 4 AND a != ''
         GROUP BY authority
         HAVING target != '0x0000000000000000000000000000000000000000'),
sd AS (SELECT DISTINCT transaction_hash AS h, address AS a, slot FROM canonical_execution_storage_diffs
       WHERE {R} AND address GLOBAL IN (SELECT authority FROM auth)),
nd AS (SELECT DISTINCT transaction_hash AS h, address AS a FROM canonical_execution_nonce_diffs
       WHERE {R} AND address GLOBAL IN (SELECT authority FROM auth))
SELECT auth.target                                              AS target,
       uniqExact(sd.a)                                          AS accounts,
       count()                                                  AS slot_writes,
       countIf(sd.slot < {L64})                                 AS hdr_writes,
       countIf((sd.h, sd.a) GLOBAL IN (SELECT h, a FROM nd))    AS writes_with_nonce_change,
       (SELECT count() FROM auth)                               AS delegated_eoas
FROM sd GLOBAL INNER JOIN auth ON sd.a = auth.authority
GROUP BY target ORDER BY slot_writes DESC
