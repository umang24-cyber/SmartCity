import sys
sys.path.insert(0, ".")

errors = []
for mod in ["routers.danger", "routers.cctv", "routers.reports", "routers.anomaly"]:
    try:
        m = __import__(mod, fromlist=["router"])
        assert hasattr(m, "router"), f"{mod} missing router"
        print(f"  OK   {mod}  prefix={m.router.prefix}")
    except Exception as e:
        print(f"  FAIL {mod}: {e}")
        import traceback; traceback.print_exc()
        errors.append(mod)

print()
print("PHASE 4 ROUTERS: PASSED" if not errors else f"FAILED: {errors}")
