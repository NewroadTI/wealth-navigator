from fastapi import APIRouter

router = APIRouter()

@router.post("/login")
def login():
    """Autenticación para obtener token JWT"""
    return {"access_token": "token_provisional", "token_type": "bearer"}