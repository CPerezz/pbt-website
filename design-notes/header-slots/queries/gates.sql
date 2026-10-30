-- Completeness gates (clickhouse-raw, one W_R chunk). Both *_missing columns must be 0:
-- every written slot appears among the tx's touched slots, and every tx has its touched-account rows.
WITH
r  AS (SELECT transaction_hash AS h, contract_address AS a, slot FROM canonical_execution_storage_reads WHERE {R}),
d  AS (SELECT transaction_hash AS h, address AS a, slot FROM canonical_execution_storage_diffs WHERE {R}),
br AS (SELECT DISTINCT transaction_hash AS h FROM canonical_execution_balance_reads WHERE {R}),
tx AS (SELECT transaction_hash AS h FROM canonical_execution_transaction WHERE {R})
SELECT
  (SELECT count() FROM d WHERE (h, a, slot) GLOBAL NOT IN (SELECT h, a, slot FROM r)) AS diffs_missing_from_reads,
  (SELECT count() FROM tx WHERE h GLOBAL NOT IN (SELECT h FROM br))                   AS txs_missing_balance_reads,
  (SELECT count() FROM tx) AS txs,
  (SELECT count() FROM r)  AS reads,
  (SELECT count() FROM d)  AS diffs
