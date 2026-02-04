-- Cambiar trade_date de timestamp a date en trades y fx_transactions
-- Esto elimina las horas y solo conserva la fecha

-- Para trades
ALTER TABLE trades ALTER COLUMN trade_date TYPE date USING trade_date::date;

-- Para fx_transactions  
ALTER TABLE fx_transactions ALTER COLUMN trade_date TYPE date USING trade_date::date;
