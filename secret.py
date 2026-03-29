import os
from mcp.server.fastmcp import FastMCP
import pyTigerGraph as tg
from dotenv import load_dotenv

# Load Admin Credentials
load_dotenv()

# Initialize MCP Server
mcp = FastMCP("TigerGraph-SmartCity")

# Initialize TigerGraph Connection
conn = tg.TigerGraphConnection(
    host=os.getenv("TG_HOST"),
    graphname=os.getenv("TG_GRAPHNAME"),
    username=os.getenv("TG_USERNAME"),
    apiToken=os.getenv("TG_TOKEN")
)

@mcp.tool()
def query_graph(gsql_query: str):
    """Executes a GSQL query. Use this to fetch city data."""
    return conn.gsql(gsql_query)

@mcp.tool()
def add_incident(incident_id: str, description: str, status: str = "open"):
    """Adds a new incident vertex to the Smart City graph."""
    return conn.upsertVertex("Incident", incident_id, attributes={
        "description": description, 
        "status": status
    })

if __name__ == "__main__":
    mcp.run()