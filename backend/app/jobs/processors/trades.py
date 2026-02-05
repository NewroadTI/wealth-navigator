"""
Processor para TRADES (reporte de transacciones detalladas de IBKR).
Procesa tanto Trades normales (STK, OPT, BOND) como FX Transactions (CASH/Forex).

REFACTORED: Now uses APIClient instead of direct DB access.

Campos del CSV:
- ClientAccountID, AccountAlias, Symbol, Description, AssetClass, SubCategory
- TradeID, TransactionID, IBExecID, IBOrderID, BrokerageOrderID
- TradeDate, DateTime, SettleDateTarget, ReportDate
- TransactionType, Buy/Sell, Exchange
- Quantity, TradePrice, TradeMoney, NetCash, Proceeds
- IBCommission, IBCommissionCurrency, Taxes
- CostBasis, FifoPnlRealized, MtmPnl
- CurrencyPrimary, Notes/Codes
- Multiplier, Strike, Expiry, Put/Call (para opciones)
- ISIN, CUSIP, FIGI, Conid, SecurityID
"""

import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from app.jobs.api_client import APIClient, get_api_client

logger = logging.getLogger(__name__)

BATCH_SIZE = 500


class TradesProcessor:
    """
    Procesa el reporte TRADES de IBKR via API.
    Separa automáticamente entre:
    - Trades normales (STK, OPT, BOND, etc.) -> tabla trades via /trades/bulk
    - FX Transactions (AssetClass=CASH, Symbol=USD.HKD) -> tabla fx_transactions via /fx-transactions/bulk
    """
    
    def __init__(self, api_client: APIClient = None):
        self.api = api_client or get_api_client()
        self.stats = {
            "trades_created": 0,
            "trades_updated": 0,
            "trades_skipped": 0,
            "fx_created": 0,
            "fx_updated": 0,
            "fx_skipped": 0,
            "errors": 0,
        }
        self.missing_assets: Dict[str, Dict] = {}  # keyed by symbol/isin
        self.missing_accounts: Dict[str, Dict] = {}  # keyed by account_code
        self.skipped_records: List[Dict] = []
        self.failed_records: List[Dict] = []
        self._asset_cache: Dict[str, Optional[int]] = {}
        self._account_cache: Dict[str, Optional[int]] = {}
    
    def process(self, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Procesa todas las filas del CSV de trades via API bulk endpoints.
        
        Args:
            rows: Lista de diccionarios con los datos del CSV
            
        Returns:
            Diccionario con estadísticas y errores
        """
        logger.info(f"📊 Procesando {len(rows)} filas de TRADES via API...")
        
        # Preload caches via API
        self.api.preload_accounts()
        self.api.preload_assets()
        
        # Collect trades and FX for bulk insert
        trades_to_create: List[Dict] = []
        fx_to_create: List[Dict] = []
        
        for idx, row in enumerate(rows):
            try:
                # Determinar si es FX o Trade normal
                asset_class = str(row.get("AssetClass", "")).strip().upper()
                symbol = str(row.get("Symbol", "")).strip()
                
                # Es FX si AssetClass es CASH o el Symbol tiene formato de par (USD.HKD)
                is_fx = asset_class == "CASH" or (
                    "." in symbol and len(symbol.split(".")) == 2 and 
                    all(len(p) == 3 for p in symbol.split("."))
                )
                
                if is_fx:
                    fx_data = self._process_fx_row(row, idx)
                    if isinstance(fx_data, dict) and "error" in fx_data:
                        self.stats["fx_skipped"] += 1
                        self.skipped_records.append({
                            "row_index": idx,
                            "row_data": dict(row),
                            "reason": fx_data["error"],
                            "record_type": "FX"
                        })
                    elif fx_data:
                        fx_to_create.append(fx_data)
                        # Send batch if full
                        if len(fx_to_create) >= BATCH_SIZE:
                            self._send_fx_batch(fx_to_create)
                            fx_to_create = []
                else:
                    trade_data = self._process_trade_row(row, idx)
                    if isinstance(trade_data, dict) and "error" in trade_data:
                        self.stats["trades_skipped"] += 1
                        self.skipped_records.append({
                            "row_index": idx,
                            "row_data": dict(row),
                            "reason": trade_data["error"],
                            "record_type": "TRADE"
                        })
                    elif trade_data:
                        trades_to_create.append(trade_data)
                        # Send batch if full
                        if len(trades_to_create) >= BATCH_SIZE:
                            self._send_trades_batch(trades_to_create)
                            trades_to_create = []
                    
            except Exception as e:
                logger.error(f"❌ Error procesando fila {idx + 2}: {e}")
                self.stats["errors"] += 1
                self.failed_records.append({
                    "row_index": idx,
                    "row_data": dict(row),
                    "error": str(e)
                })
        
        # Send remaining batches
        if trades_to_create:
            self._send_trades_batch(trades_to_create)
        if fx_to_create:
            self._send_fx_batch(fx_to_create)
        
        logger.info(f"✅ Procesamiento completado: {self.stats}")
        
        return {
            "stats": self.stats,
            "missing_assets": list(self.missing_assets.values()),  # Convert dict to list
            "missing_accounts": list(self.missing_accounts.values()),  # Convert dict to list
            "skipped_records": self.skipped_records[:100],  # Limit to first 100
            "failed_records": self.failed_records[:100]  # Limit to first 100
        }
    
    def _send_trades_batch(self, trades: List[Dict]) -> None:
        """Send a batch of trades to the API."""
        if not trades:
            return
        try:
            result = self.api.create_trades_bulk(trades)
            created = result.get("created", 0)
            updated = result.get("skipped", 0)  # skipped = duplicates = updated (not modified)
            self.stats["trades_created"] += created
            self.stats["trades_updated"] += updated
            logger.info(f"📤 Batch trades: {created} created, {updated} updated (duplicates)")
        except Exception as e:
            logger.error(f"❌ Error sending trades batch: {e}")
            self.stats["errors"] += len(trades)
    
    def _send_fx_batch(self, fx_list: List[Dict]) -> None:
        """Send a batch of FX transactions to the API."""
        if not fx_list:
            return
        try:
            result = self.api.create_fx_transactions_bulk(fx_list)
            created = result.get("created", 0)
            updated = result.get("skipped", 0)  # skipped = duplicates = updated (not modified)
            self.stats["fx_created"] += created
            self.stats["fx_updated"] += updated
            logger.info(f"📤 Batch FX: {created} created, {updated} updated (duplicates)")
        except Exception as e:
            logger.error(f"❌ Error sending FX batch: {e}")
            self.stats["errors"] += len(fx_list)
    
    # =========================================================================
    # TRADES NORMALES
    # =========================================================================
    
    def _process_trade_row(self, row: Dict[str, Any], idx: int) -> Optional[Dict]:
        """Procesa una fila como Trade normal (STK, OPT, BOND, etc.). Returns dict for API."""
        
        # Identificar cancelaciones (se insertan igual pero con log)
        transaction_type = str(row.get("TransactionType", "")).strip()
        if transaction_type == "TradeCancel":
            transaction_id = str(row.get("TransactionID", "")).strip()
            logger.info(f"Fila {idx + 2}: TradeCancel (TransactionID: {transaction_id}) - Se registrará como cancelación")
        
        # 1. Obtener account_id
        account_code = str(row.get("ClientAccountID", "")).strip()
        currency = str(row.get("CurrencyPrimary", "USD")).strip()
        account_id = self._get_account_id(account_code, currency)
        
        if not account_id:
            account_key = f"{account_code}_{currency}"
            if account_key not in self.missing_accounts:
                self.missing_accounts[account_key] = {
                    "account_code": account_key,
                    "reason": f"Account not found in database: {account_key}",
                    "count": 0,
                    "done": False  # Track resolution status
                }
            self.missing_accounts[account_key]["count"] += 1
            return {"error": f"Account not found: {account_key}"}
        
        # 2. ib_transaction_id for duplicate checking (done by API)
        ib_transaction_id = str(row.get("TransactionID", "")).strip() or None
        
        # 3. Buscar asset_id
        asset_id = self._find_asset_id(row)
        if not asset_id:
            # Registrar como missing pero NO saltar - guardar el trade sin asset
            symbol = str(row.get("Symbol", "")).strip()
            isin = str(row.get("ISIN", "")).strip()
            asset_key = isin if isin else f"SYMBOL:{symbol}"
            
            if asset_key and asset_key not in self.missing_assets:
                self.missing_assets[asset_key] = {
                    "symbol": symbol,
                    "isin": isin if isin else None,
                    "description": str(row.get("Description", "")).strip(),
                    "currency": str(row.get("CurrencyPrimary", "USD")).strip()[:3],
                    "reason": f"Asset not found in database by {'ISIN (' + isin + ')' if isin else 'Symbol (' + symbol + ')'}",
                    "count": 0,
                    "done": False  # Track resolution status
                }
            if asset_key:
                self.missing_assets[asset_key]["count"] += 1
        
        # 4. Parsear fechas - Usar ReportDate (sin hora) primero, luego TradeDate
        report_date = self._parse_date(row.get("ReportDate"))
        trade_date = report_date or self._parse_date(row.get("TradeDate"))
        if not trade_date:
            logger.warning(f"Fila {idx + 2}: Fecha inválida, saltando")
            self.stats["trades_skipped"] += 1
            return None
        
        settlement_date = self._parse_date(row.get("SettleDateTarget"))
        
        # 5. Parsear datos de opciones
        expiry = self._parse_date(row.get("Expiry"))
        strike = self._parse_decimal(row.get("Strike"))
        multiplier = self._parse_decimal(row.get("Multiplier"))
        put_call = str(row.get("Put/Call", "")).strip() or None
        
        # 6. Create dict for API
        trade_data = {
            "account_id": account_id,
            "asset_id": asset_id,
            
            # Identificadores IBKR
            "ib_transaction_id": ib_transaction_id,
            "ib_exec_id": str(row.get("IBExecID", "")).strip() or None,
            "ib_trade_id": str(row.get("TradeID", "")).strip() or None,
            "ib_order_id": str(row.get("IBOrderID", "")).strip() or str(row.get("BrokerageOrderID", "")).strip() or None,
            
            # Fechas (solo fecha sin hora - trade_date usa ReportDate del CSV)
            "trade_date": str(trade_date) if trade_date else None,
            "settlement_date": str(settlement_date) if settlement_date else None,
            
            # Clasificación
            "transaction_type": str(row.get("TransactionType", "")).strip() or None,
            "side": self._normalize_side(row.get("Buy/Sell")),
            "exchange": str(row.get("Exchange", "")).strip() or None,
            
            # Economía
            "quantity": str(abs(self._parse_decimal(row.get("Quantity")) or Decimal(0))),
            "price": str(abs(self._parse_decimal(row.get("TradePrice")) or Decimal(0))),
            "gross_amount": str(self._parse_decimal(row.get("TradeMoney"))) if self._parse_decimal(row.get("TradeMoney")) else None,
            "net_amount": str(self._parse_decimal(row.get("NetCash"))) if self._parse_decimal(row.get("NetCash")) else None,
            "proceeds": str(self._parse_decimal(row.get("Proceeds"))) if self._parse_decimal(row.get("Proceeds")) else None,
            
            # Costos
            "commission": str(abs(self._parse_decimal(row.get("IBCommission")) or Decimal(0))),
            "tax": str(self._parse_decimal(row.get("Taxes"))) if self._parse_decimal(row.get("Taxes")) else None,
            
            # P&L
            "cost_basis": str(self._parse_decimal(row.get("CostBasis"))) if self._parse_decimal(row.get("CostBasis")) else None,
            "realized_pnl": str(self._parse_decimal(row.get("FifoPnlRealized"))) if self._parse_decimal(row.get("FifoPnlRealized")) else None,
            "mtm_pnl": str(self._parse_decimal(row.get("MtmPnl"))) if self._parse_decimal(row.get("MtmPnl")) else None,
            
            # Opciones
            "multiplier": str(multiplier) if multiplier else None,
            "strike": str(strike) if strike else None,
            "expiry": str(expiry) if expiry else None,
            "put_call": put_call,
            
            # Extras
            "currency": currency[:3] if currency else "USD",
            "description": str(row.get("Description", "")).strip()[:500] or None,
            "notes": str(row.get("Notes/Codes", "")).strip() or None,
        }
        
        logger.debug(f"✅ Trade preparado: {trade_data['side']} {trade_data['quantity']} @ {trade_data['price']}")
        return trade_data
    
    # =========================================================================
    # FX TRANSACTIONS
    # =========================================================================
    
    def _process_fx_row(self, row: Dict[str, Any], idx: int) -> Optional[Dict]:
        """Procesa una fila como FX Transaction. Returns dict for API."""
        
        # Identificar cancelaciones (se insertan igual pero con log)
        transaction_type = str(row.get("TransactionType", "")).strip()
        if transaction_type == "TradeCancel":
            transaction_id = str(row.get("TransactionID", "")).strip()
            logger.info(f"Fila {idx + 2}: TradeCancel FX (TransactionID: {transaction_id}) - Se registrará como cancelación")
        
        # 1. Parsear par de monedas del Symbol (ej: USD.TWD)
        symbol = str(row.get("Symbol", "")).strip()
        if "." not in symbol:
            logger.warning(f"Fila {idx + 2}: Symbol FX inválido '{symbol}'")
            self.stats["fx_skipped"] += 1
            return None
        
        parts = symbol.split(".")
        if len(parts) != 2:
            logger.warning(f"Fila {idx + 2}: Par FX inválido '{symbol}'")
            self.stats["fx_skipped"] += 1
            return None
        
        base_currency, quote_currency = parts[0].strip(), parts[1].strip()
        
        # 2. Obtener account base
        account_code = str(row.get("ClientAccountID", "")).strip()
        
        # 3. ib_transaction_id for duplicate checking (done by API)
        ib_transaction_id = str(row.get("TransactionID", "")).strip() or None
        
        # 4. Parsear fecha - Usar ReportDate (sin hora) primero, luego TradeDate
        report_date = self._parse_date(row.get("ReportDate"))
        trade_date = report_date or self._parse_date(row.get("TradeDate"))
        if not trade_date:
            logger.warning(f"Fila {idx + 2}: Fecha FX inválida")
            self.stats["fx_skipped"] += 1
            return None
        
        # 5. Determinar direccion y montos
        side = self._normalize_side(row.get("Buy/Sell"))
        quantity = self._parse_decimal(row.get("Quantity")) or Decimal(0)
        trade_money = self._parse_decimal(row.get("TradeMoney")) or Decimal(0)
        exchange_rate = self._parse_decimal(row.get("TradePrice")) or Decimal(0)
        
        # Lógica de Source/Target según Buy/Sell
        # SELL USD.TWD: Vendiendo USD para obtener TWD
        #   - Source: USD (sale, negativo), Target: TWD (entra, positivo)
        # BUY USD.TWD: Comprando USD con TWD
        #   - Source: TWD (sale, negativo), Target: USD (entra, positivo)
        
        if side == "SELL":
            # Vendiendo base currency (USD), recibiendo quote (TWD)
            source_currency = base_currency
            source_amount = -abs(quantity)  # Negativo porque sale
            target_currency = quote_currency
            target_amount = abs(trade_money) if trade_money else abs(quantity * exchange_rate)  # Positivo porque entra
        else:
            # Comprando base currency (USD), pagando con quote (TWD)
            source_currency = quote_currency
            source_amount = -(abs(trade_money) if trade_money else abs(quantity * exchange_rate))  # Negativo porque sale
            target_currency = base_currency
            target_amount = abs(quantity)  # Positivo porque entra
        
        # 6. Obtener account_ids
        source_account_id = self._get_account_id(account_code, source_currency)
        target_account_id = self._get_account_id(account_code, target_currency)
        
        if not source_account_id:
            account_key = f"{account_code}_{source_currency}"
            if account_key not in self.missing_accounts:
                self.missing_accounts[account_key] = {
                    "account_code": account_key,
                    "reason": f"Account not found in database: {account_key}",
                    "count": 0,
                    "done": False  # Track resolution status
                }
            self.missing_accounts[account_key]["count"] += 1
            return {"error": f"Source account not found: {account_key}"}
        
        # 7. Comisión
        commission = abs(self._parse_decimal(row.get("IBCommission")) or Decimal(0))
        commission_currency = str(row.get("IBCommissionCurrency", "")).strip()[:3] or None
        
        # 8. Create dict for API
        fx_data = {
            "trade_date": str(trade_date) if trade_date else None,
            "account_id": source_account_id,
            "target_account_id": target_account_id,
            
            "source_currency": source_currency,
            "source_amount": str(source_amount),
            "target_currency": target_currency,
            "target_amount": str(target_amount),
            
            "side": side,
            "exchange_rate": str(exchange_rate) if exchange_rate else None,
            
            "commission": str(commission) if commission else None,
            "commission_currency": commission_currency,
            
            "ib_transaction_id": ib_transaction_id,
            "ib_exec_id": str(row.get("IBExecID", "")).strip() or None,
            "ib_order_id": str(row.get("IBOrderID", "")).strip() or None,
            
            "exchange": str(row.get("Exchange", "")).strip() or None,
            "transaction_type": transaction_type or None,
            "notes": str(row.get("Notes/Codes", "")).strip() or None,
            
            # external_id único para evitar duplicados
            "external_id": f"FX_{ib_transaction_id}" if ib_transaction_id else None,
        }
        
        logger.debug(f"✅ FX preparado: {side} {source_currency}->{target_currency}")
        return fx_data
    
    # =========================================================================
    # HELPERS
    # =========================================================================
    
    def _find_asset_id(self, row: Dict[str, Any]) -> Optional[int]:
        """
        Busca el asset_id usando el cache del APIClient.
        Lógica:
        1. Si hay isin.csv: buscar isin.db, si no -> symbol.db con isin.csv, si no -> description.db con isin.csv
        2. Si no hay isin.csv: buscar symbol.csv con symbol.db, después con description.db
        """
        isin = str(row.get("ISIN", "")).strip()
        symbol = str(row.get("Symbol", "")).strip()
        description = str(row.get("Description", "")).strip()
        
        # Cache key local (sin conid)
        cache_key = f"{isin}|{symbol}|{description}"
        if cache_key in self._asset_cache:
            return self._asset_cache[cache_key]
        
        asset_id = None
        
        # 1. Si hay ISIN en CSV
        if isin:
            # 1.1 Buscar por isin.db
            asset_id = self.api.get_asset_id_by_isin(isin)
            
            if not asset_id:
                # 1.2 Buscar isin.csv -> symbol.db
                asset_id = self.api.get_asset_id_by_symbol(isin)
            
            if not asset_id:
                # 1.3 Buscar isin.csv -> description.db (búsqueda por descripción con isin)
                # Esta búsqueda no está implementada en cache, se omite por ahora
                pass
        
        # 2. Si no hay ISIN en CSV, buscar por Symbol
        if not asset_id and symbol:
            # Limpiar symbol para opciones (quitar espacios extra)
            clean_symbol = symbol.split()[0] if " " in symbol else symbol
            
            # 2.1 Buscar symbol.csv -> symbol.db
            asset_id = self.api.get_asset_id_by_symbol(clean_symbol)
            
            if not asset_id and clean_symbol != symbol:
                # Intentar con symbol completo
                asset_id = self.api.get_asset_id_by_symbol(symbol)
            
            # 2.2 Buscar symbol.csv -> description.db (búsqueda por descripción con symbol)
            # Esta búsqueda no está implementada en cache, se omite por ahora
        
        self._asset_cache[cache_key] = asset_id
        return asset_id
    
    def _get_account_id(self, account_code: str, currency: str) -> Optional[int]:
        """Obtiene el account_id para un código de cuenta y moneda via API cache."""
        # Build full account code like U12345678_USD
        full_account_code = f"{account_code}_{currency}"
        
        if full_account_code in self._account_cache:
            return self._account_cache[full_account_code]
        
        # Buscar cuenta usando el cache del APIClient (expects full code)
        account_id = self.api.get_account_id(full_account_code)
        
        self._account_cache[full_account_code] = account_id
        return account_id
    
    def _normalize_side(self, value: Any) -> str:
        """Normaliza el lado de la operación."""
        if not value:
            return "BUY"
        side = str(value).strip().upper()
        if "SELL" in side:
            return "SELL"
        return "BUY"
    
    def _parse_decimal(self, value: Any) -> Optional[Decimal]:
        """Parsea un valor a Decimal."""
        if value is None or str(value).strip() in ("", "-", "nan", "None", "N/A"):
            return None
        try:
            clean = str(value).replace(",", "").replace("$", "").replace(" ", "").strip()
            if clean.startswith("<"):
                return None
            return Decimal(clean)
        except (InvalidOperation, ValueError):
            return None
    
    def _parse_date(self, value: Any) -> Optional[datetime]:
        """Parsea una fecha (sin hora). Devuelve solo date, no datetime."""
        if value is None or str(value).strip() in ("", "-", "nan", "None"):
            return None
        
        s = str(value).strip()
        
        # Formatos comunes
        formats = [
            "%d/%m/%Y",  # 21/01/2026
            "%Y-%m-%d",  # 2026-01-21
            "%Y%m%d",    # 20260121
            "%m/%d/%Y",  # 01/21/2026
            "%m/%d/%y",  # 01/21/26
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(s, fmt)
                return dt.date()  # Devolver solo la fecha sin hora
            except ValueError:
                continue
        
        return None
    
    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        """Parsea fecha con hora."""
        if value is None or str(value).strip() in ("", "-", "nan", "None"):
            return None
        
        s = str(value).strip()
        
        # Formato IBKR: 21/01/2026;130854
        if ";" in s:
            try:
                date_part, time_part = s.split(";")
                # Parsear fecha
                dt = None
                for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y"]:
                    try:
                        dt = datetime.strptime(date_part, fmt)
                        break
                    except ValueError:
                        continue
                
                if dt and len(time_part) == 6:
                    hour = int(time_part[:2])
                    minute = int(time_part[2:4])
                    second = int(time_part[4:6])
                    return dt.replace(hour=hour, minute=minute, second=second)
                return dt
            except Exception:
                pass
        
        # Intentar formatos estándar
        return self._parse_date(s)


def process_trades_report(api_client: APIClient, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Función de entrada para procesar el reporte TRADES via API.
    
    Args:
        api_client: Cliente de API para comunicación con backend
        rows: Lista de diccionarios con los datos del CSV
        
    Returns:
        Diccionario con estadísticas y errores
    """
    processor = TradesProcessor(api_client)
    return processor.process(rows)
