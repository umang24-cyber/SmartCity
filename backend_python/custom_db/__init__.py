"""DB adapter facade that selects the active backend via ``DB_TYPE``."""

from config import DB_TYPE

if DB_TYPE.lower() == "postgres":
    from .postgres_client import (  # noqa: F401
        PostgresClient,
        get_all_zones,
        get_client,
        get_zone_data,
        update_zone_danger_score,
        upsert_incident_to_graph,
    )

    __all__ = [
        "PostgresClient",
        "get_all_zones",
        "get_client",
        "get_zone_data",
        "update_zone_danger_score",
        "upsert_incident_to_graph",
    ]
else:
    from .tigergraph_client import (  # noqa: F401
        TigerGraphClient,
        get_all_zones,
        get_client,
        get_zone_data,
        update_zone_danger_score,
        upsert_incident_to_graph,
    )

    __all__ = [
        "TigerGraphClient",
        "get_all_zones",
        "get_client",
        "get_zone_data",
        "update_zone_danger_score",
        "upsert_incident_to_graph",
    ]
