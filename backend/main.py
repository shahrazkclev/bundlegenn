#!/usr/bin/env python3
import os
import sys
import uvicorn

if __name__ == "__main__":
    # Get port from environment or default to 8001
    port = int(os.environ.get("PORT", 8001))
    host = os.environ.get("HOST", "0.0.0.0")
    
    # Run the FastAPI app
    uvicorn.run(
        "server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
        access_log=True
    )