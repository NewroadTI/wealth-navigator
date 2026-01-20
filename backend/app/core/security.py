from passlib.context import CryptContext

# Configuración de hashing (bcrypt es el estándar de la industria)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Transforma una contraseña plana en un hash seguro para la DB."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si una contraseña coincide con el hash guardado."""
    return pwd_context.verify(plain_password, hashed_password)