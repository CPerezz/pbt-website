-- Note in-the-header (clickhouse-raw, one W_R chunk): top 100 contracts by cold charges on slots 0-63.
SELECT contract_address AS a,
       count()          AS hdr_access,
       uniqExact(slot)  AS hdr_slots_used,
       arrayStringConcat(arrayMap(x -> toString(x),
         topK(6)(reinterpretAsUInt8(unhex(substring(slot, 65, 2))))), ' ') AS top_slots
FROM (SELECT DISTINCT transaction_hash, contract_address, slot
      FROM canonical_execution_storage_reads WHERE {R} AND slot < {L64})
GROUP BY a ORDER BY hdr_access DESC LIMIT 100
