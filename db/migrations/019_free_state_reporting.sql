-- Free State ECD statutory reporting support.
--
-- 1. Per-child subsidy flag. The "ECD Subsidy: Monthly attendance report/record"
--    asks for attendance days split between children funded by an ECD subsidy and
--    all children, which cannot be derived from anything already stored.
--    Defaults to 0 so no child is claimed as funded until the centre says so.
ALTER TABLE children ADD COLUMN subsidised INTEGER NOT NULL DEFAULT 0;

-- 2. Settings keys the two forms print. Inserted empty so they appear in Settings
--    for someone to fill in; the report flags each one that is still blank.
--    registered_capacity        - registered capacity of the ECD centre
--    subsidised_places          - number of places funded by ECD subsidy
--    dept_reference_number      - departmental reference number for the centre
--    transfer_agreement_number  - Annexure B transfer agreement number
--    transfer_agreement_date    - date the transfer agreement was signed
--    transfer_agreement_value   - rand value of the transfer agreement
--    serving_district           - district serving the centre
--    reporting_department       - department the statement is submitted to
INSERT INTO settings (centre_id, setting_key, setting_value)
SELECT centre_id, k, ''
FROM centres
CROSS JOIN (
  SELECT 'registered_capacity' AS k UNION ALL SELECT 'subsidised_places'
  UNION ALL SELECT 'dept_reference_number' UNION ALL SELECT 'transfer_agreement_number'
  UNION ALL SELECT 'transfer_agreement_date' UNION ALL SELECT 'transfer_agreement_value'
)
WHERE 1=1
ON CONFLICT(centre_id, setting_key) DO NOTHING;
