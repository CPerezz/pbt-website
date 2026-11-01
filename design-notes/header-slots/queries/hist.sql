-- Note how-many (clickhouse-raw, one W_R chunk).
-- Cold charges (reads, written slots included) and net per-tx changes (writes) by slot number, slots 0-255.
SELECT 'read' AS kind, reinterpretAsUInt8(unhex(substring(slot, 65, 2))) AS idx, count() AS n
FROM (SELECT DISTINCT transaction_hash, contract_address, slot
      FROM canonical_execution_storage_reads WHERE {R} AND slot < {L256})
GROUP BY idx
UNION ALL
SELECT 'write' AS kind, reinterpretAsUInt8(unhex(substring(slot, 65, 2))) AS idx, count() AS n
FROM (SELECT DISTINCT transaction_hash, address, slot
      FROM canonical_execution_storage_diffs WHERE {R} AND slot < {L256})
GROUP BY idx
