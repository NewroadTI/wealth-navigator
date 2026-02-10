SELECT 
    a.description AS asset_name, 
    a.symbol,
    p.*
FROM positions p
JOIN assets a ON p.asset_id = a.asset_id
WHERE p.currency != 'USD';