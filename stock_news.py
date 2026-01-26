import requests
import time
from datetime import datetime, timezone, timedelta
import os

# ---------------- SETTINGS ---------------- #
# AGREGA TUS TICKERS AQUÍ ↓
TICKERS = [
    "TSM", "2354", "5930", "AVGO", "2475", "SONY", "GLW", "STM", "CRUS", "LPL",
    "4938", "SWKS", "LITE", "6981", "NXPI", "6762", "6723", "APH", "2018", "QCOM",
    "TXN", "MCHP", "ASX", "3008", "3406", "11070", "2382", "725", "FLEX", "3037",
    "660", "6740", "6269", "300115", "6770", "1415", "2241", "KN", "2600", "6753",
    "300207", "ADI", "9150", "AMSZ", "NJDCY", "6789", "LSCC", "AFXF", "6456"
]   # 49 tickers - MODIFICA ESTA LISTA CON LOS TICKERS QUE QUIERAS

FINNHUB_API_KEY = "d36qps9r01qtvbtis6b0d36qps9r01qtvbtis6bg"
NEWSAPI_KEY = "107317b734194e5289ef88753a9169da"
OUTPUT_DIR = "news_reports"
FINAL_OUTPUT_FILE = "all_stocks_news_report.html"
# ------------------------------------------ #

print("🔧 Iniciando script de noticias...")
print(f"📊 Procesando {len(TICKERS)} tickers")

# Crear directorio si no existe
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
    print(f"📁 Directorio creado: {OUTPUT_DIR}")

def fetch_finnhub_news(ticker):
    """Obtiene noticias de Finnhub de la última semana."""
    today = datetime.now(timezone.utc)
    last_week = today - timedelta(days=7)

    url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={last_week.strftime('%Y-%m-%d')}&to={today.strftime('%Y-%m-%d')}&token={FINNHUB_API_KEY}"
    
    try:
        print(f"   📡 Finnhub: {ticker}...")
        response = requests.get(url, timeout=15)
        if response.status_code != 200:
            print(f"   ❌ Error Finnhub {response.status_code} para {ticker}")
            return [], 0

        data = response.json()
        # Filtrar artículos con contenido válido y único
        seen_headlines = set()
        valid_articles = []
        
        for article in data:
            headline = article.get("headline", "").strip()
            if headline and headline not in seen_headlines:
                seen_headlines.add(headline)
                valid_articles.append(article)
        
        top_news = valid_articles[:20]  # 20 noticias máximo
        
        summaries = []
        for article in top_news:
            link = article.get("url", "#")
            headline = article.get("headline", "No headline").strip()
            source = article.get("source", "Finnhub")
            date = article.get("datetime", "")
            
            if date:
                date_str = datetime.fromtimestamp(date).strftime('%Y-%m-%d')
                summaries.append(f'<li><a href="{link}" target="_blank">{headline}</a> ({source}, {date_str})</li>')
            else:
                summaries.append(f'<li><a href="{link}" target="_blank">{headline}</a> ({source})</li>')
        
        return summaries, len(summaries)
    except Exception as e:
        print(f"   ❌ Error Finnhub: {e}")
        return [], 0

def fetch_newsapi_news(ticker):
    """Obtiene noticias de NewsAPI."""
    today = datetime.now(timezone.utc)
    last_week = today - timedelta(days=7)

    url = (
        f"https://newsapi.org/v2/everything?"
        f"q={ticker} OR {ticker}.TW OR {ticker}.TWO OR {ticker}.T&"
        f"from={last_week.strftime('%Y-%m-%d')}&"
        f"to={today.strftime('%Y-%m-%d')}&"
        f"sortBy=publishedAt&"
        f"language=en&"
        f"pageSize=20&"  # 20 noticias
        f"apiKey={NEWSAPI_KEY}"
    )

    try:
        print(f"   📡 NewsAPI: {ticker}...")
        response = requests.get(url, timeout=15)
        if response.status_code != 200:
            print(f"   ❌ Error NewsAPI {response.status_code} para {ticker}")
            return [], 0

        data = response.json()
        articles = data.get("articles", [])
        
        # Filtrar duplicados
        seen_titles = set()
        unique_articles = []
        
        for article in articles:
            title = article.get("title", "").strip()
            if title and title not in seen_titles:
                seen_titles.add(title)
                unique_articles.append(article)
        
        top_articles = unique_articles[:20]  # 20 noticias máximo
        
        summaries = []
        for article in top_articles:
            link = article.get("url", "#")
            headline = article.get("title", "No title").strip()
            source = article.get("source", {}).get("name", "NewsAPI")
            date = article.get("publishedAt", "")[:10]  # YYYY-MM-DD
            
            if date:
                summaries.append(f'<li><a href="{link}" target="_blank">{headline}</a> ({source}, {date})</li>')
            else:
                summaries.append(f'<li><a href="{link}" target="_blank">{headline}</a> ({source})</li>')
        
        return summaries, len(summaries)
    except Exception as e:
        print(f"   ❌ Error NewsAPI: {e}")
        return [], 0

def main():
    """Función principal."""
    print(f"🚀 Procesando {len(TICKERS)} tickers")
    print("⏳ Esto puede tomar varios minutos...")
    print("💡 Obteniendo hasta 20 noticias por ticker por fuente\n")
    
    total_finnhub = 0
    total_newsapi = 0
    processed_tickers = []
    
    for i, ticker in enumerate(TICKERS, 1):
        print(f"\n[{i}/{len(TICKERS)}] 📊 {ticker}")
        print("-" * 40)
        
        try:
            # Obtener noticias
            finnhub_news, finnhub_count = fetch_finnhub_news(ticker)
            newsapi_news, newsapi_count = fetch_newsapi_news(ticker)
            
            total_finnhub += finnhub_count
            total_newsapi += newsapi_count
            processed_tickers.append(ticker)
            
            print(f"   ✅ RESULTADO: Finnhub: {finnhub_count} | NewsAPI: {newsapi_count}")
            
            # Crear HTML para este ticker
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>{ticker} News Report</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
                    h1 {{ color: #2E86C1; border-bottom: 2px solid #2E86C1; padding-bottom: 10px; }}
                    h2 {{ color: #117A65; margin-top: 25px; }}
                    .stats {{ background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }}
                    ul {{ list-style-type: none; padding: 0; }}
                    li {{ margin: 12px 0; padding: 12px; background: #f5f5f5; border-radius: 6px; border-left: 4px solid #007AFF; }}
                    a {{ text-decoration: none; color: #007AFF; font-weight: 500; }}
                    a:hover {{ text-decoration: underline; color: #0056b3; }}
                    .source-badge {{ font-size: 0.8em; color: #666; margin-left: 5px; }}
                </style>
            </head>
            <body>
                <h1>📈 {ticker} - News Report</h1>
                <div class="stats">
                    <p><strong>Generado:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
                    <p><strong>Total noticias:</strong> {finnhub_count + newsapi_count}</p>
                    <p><strong>Finnhub:</strong> {finnhub_count} | <strong>NewsAPI:</strong> {newsapi_count}</p>
                </div>
                
                <h2>📰 Finnhub News ({finnhub_count})</h2>
                {"<ul>" + "".join(finnhub_news) + "</ul>" if finnhub_news else "<p>No se encontraron noticias en Finnhub</p>"}
                
                <h2>📰 NewsAPI News ({newsapi_count})</h2>
                {"<ul>" + "".join(newsapi_news) + "</ul>" if newsapi_news else "<p>No se encontraron noticias en NewsAPI</p>"}
            </body>
            </html>
            """
            
            # Guardar archivo individual
            filename = os.path.join(OUTPUT_DIR, f"{ticker}_news.html")
            with open(filename, "w", encoding="utf-8") as f:
                f.write(html_content)
            
            # Pausa más larga para evitar límites de API
            if i < len(TICKERS):
                wait_time = 3  # 3 segundos entre tickers
                print(f"   ⏳ Esperando {wait_time} segundos...")
                time.sleep(wait_time)
                
        except Exception as e:
            print(f"❌ Error procesando {ticker}: {e}")
            continue
    
    # Crear reporte final
    print(f"\n{'='*50}")
    print("📊 CREANDO REPORTE FINAL...")
    print(f"{'='*50}")
    
    html_final = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Complete Stock News Report</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
            h1 {{ color: #2E86C1; text-align: center; border-bottom: 3px solid #2E86C1; padding-bottom: 15px; }}
            .summary {{ background: linear-gradient(135deg, #e8f5e8, #d4edda); padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #c3e6cb; }}
            .nav {{ background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e9ecef; }}
            .ticker-list {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }}
            .ticker-item {{ background: white; padding: 15px; border-radius: 8px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
            .ticker-item a {{ text-decoration: none; color: #007AFF; font-weight: bold; font-size: 1.1em; }}
            .ticker-item a:hover {{ text-decoration: underline; }}
            .ticker-stats {{ font-size: 0.9em; color: #555; margin-top: 8px; }}
            .total-stats {{ font-size: 1.1em; font-weight: bold; color: #28a745; }}
        </style>
    </head>
    <body>
        <h1>📊 COMPLETE STOCK NEWS REPORT</h1>
        <div class="summary">
            <h2>📈 Resumen General</h2>
            <p><strong>Fecha de generación:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p><strong>Tickers procesados:</strong> {len(processed_tickers)}/{len(TICKERS)}</p>
            <p class="total-stats">Total noticias Finnhub: {total_finnhub} | Total noticias NewsAPI: {total_newsapi}</p>
            <p class="total-stats">Noticias totales: {total_finnhub + total_newsapi}</p>
        </div>
        
        <div class="nav">
            <strong>🔗 Navegación rápida:</strong><br>
            {"".join([f'<a href="#{ticker}" style="margin-right: 10px;">{ticker}</a>' for ticker in processed_tickers])}
        </div>
        
        <h2>📋 Reportes Individuales por Ticker</h2>
        <div class="ticker-list">
    """
    
    # Leer estadísticas de cada archivo individual
    for ticker in processed_tickers:
        individual_file = os.path.join(OUTPUT_DIR, f"{ticker}_news.html")
        if os.path.exists(individual_file):
            try:
                with open(individual_file, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Extraer conteos
                finn_count = content.count('Finnhub News (')
                news_count = content.count('NewsAPI News (')
                
                html_final += f"""
                <div class="ticker-item" id="{ticker}">
                    <h3><a href="news_reports/{ticker}_news.html" target="_blank">{ticker}</a></h3>
                    <div class="ticker-stats">
                        <p>📰 Finnhub: {finn_count} noticias</p>
                        <p>📰 NewsAPI: {news_count} noticias</p>
                        <p><strong>Total: {finn_count + news_count} noticias</strong></p>
                    </div>
                </div>
                """
            except:
                html_final += f"""
                <div class="ticker-item" id="{ticker}">
                    <h3>{ticker}</h3>
                    <p>Error cargando estadísticas</p>
                </div>
                """
    
    html_final += f"""
        </div>
        
        <div class="summary">
            <h2>✅ Proceso Completado</h2>
            <p><strong>Tickers exitosos:</strong> {len(processed_tickers)} de {len(TICKERS)}</p>
            <p><strong>Noticias totales obtenidas:</strong> {total_finnhub + total_newsapi}</p>
            <p><strong>Directorio de reportes:</strong> {os.path.abspath(OUTPUT_DIR)}</p>
            <p><em>Reporte generado automáticamente</em></p>
        </div>
    </body>
    </html>
    """
    
    with open(FINAL_OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html_final)
    
    print(f"\n🎉 ¡PROCESO COMPLETADO!")
    print(f"📁 Reportes individuales en: {OUTPUT_DIR}/")
    print(f"📄 Reporte final: {FINAL_OUTPUT_FILE}")
    print(f"📍 Ruta completa: {os.path.abspath(FINAL_OUTPUT_FILE)}")
    print(f"\n📊 ESTADÍSTICAS FINALES:")
    print(f"   ✅ Tickers procesados: {len(processed_tickers)}/{len(TICKERS)}")
    print(f"   📰 Noticias Finnhub: {total_finnhub}")
    print(f"   📰 Noticias NewsAPI: {total_newsapi}")
    print(f"   📈 Total noticias: {total_finnhub + total_newsapi}")
    print(f"\n💡 Para ver el reporte:")
    print(f"   Abre Finder → Navega a: {os.getcwd()}")
    print(f"   Doble-clic en: '{FINAL_OUTPUT_FILE}'")

if __name__ == "__main__":
    main()
