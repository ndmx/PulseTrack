import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
load_dotenv()
engine = create_engine(f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}")
