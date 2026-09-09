import logging
from fastapi import FastAPI,Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError
import httpx
from app.api.routes import router
from app.infrastructure.database import engine

logging.basicConfig(level=logging.INFO)
logger=logging.getLogger('bidguard')
app=FastAPI(title='BIDGUARD API',version='2.0.0',description='Evidence-grounded procurement assessment modular monolith.')
app.include_router(router)
@app.middleware('http')
async def response_headers(request:Request,call_next):
    response=await call_next(request);response.headers['X-Content-Type-Options']='nosniff';response.headers['Cache-Control']='no-store';return response
@app.exception_handler(ValueError)
async def invalid_input(request:Request,exc:ValueError):return JSONResponse({'detail':str(exc)},status_code=400)
@app.exception_handler(StaleDataError)
async def conflict(request:Request,exc:StaleDataError):return JSONResponse({'detail':'Assessment changed concurrently. Refresh before retrying.'},status_code=409)
@app.exception_handler(SQLAlchemyError)
async def database_error(request:Request,exc:SQLAlchemyError):
    logger.error('Database operation failed: %s',type(exc).__name__)
    return JSONResponse({'detail':'The database could not complete the operation. No partial change was committed.'},status_code=503)
@app.exception_handler(httpx.HTTPError)
async def provider_error(request:Request,exc:httpx.HTTPError):return JSONResponse({'detail':'AI extraction service is unavailable. Choose the rule-based extractor or try again later.'},status_code=502)
@app.get('/health')
def health():
    with engine.connect() as connection:connection.execute(text('SELECT 1'))
    return {'status':'ok','service':'bidguard','version':'2.0.0'}
