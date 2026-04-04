import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

try:
    from db import mock_db
    print("✅ mock_db imported successfully")
except Exception as e:
    import traceback
    traceback.print_exc()
