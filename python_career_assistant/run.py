# Application entry point
import os
import logging
from app import create_app

# Set up logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

app = create_app()

if __name__ == '__main__':
    # Start server locally on port 5000 if executed directly
    logging.info("Starting local Flash debugger engine on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
