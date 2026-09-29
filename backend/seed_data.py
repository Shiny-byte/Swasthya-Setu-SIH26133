from database import SessionLocal, engine, Base
import models
from auth import get_password_hash

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # Clear old records to avoid duplicate username conflicts
    db.query(models.User).delete()
    db.commit()

    users = [
        {"username": "asha", "role": "asha", "password": "sih2026"},
        {"username": "dr_kulkarni", "role": "doctor", "password": "sih2026"},
        {"username": "admin", "role": "admin", "password": "sih2026"},
    ]

    for u in users:
        pwd_hash = get_password_hash(u["password"])
        
        # Check which column exists on the model
        if hasattr(models.User, 'password_hash'):
            user = models.User(
                username=u["username"],
                role=u["role"],
                password_hash=pwd_hash
            )
        elif hasattr(models.User, 'hashed_password'):
            user = models.User(
                username=u["username"],
                role=u["role"],
                hashed_password=pwd_hash
            )
        else:
            user = models.User(
                username=u["username"],
                role=u["role"],
                password=pwd_hash
            )
        db.add(user)

    db.commit()
    print("SUCCESS: Default accounts created including 'dr_kulkarni' (Password: sih2026)!")
except Exception as e:
    print("Error seeding:", e)
finally:
    db.close()