# Package initialization file
from flask import Flask
from .config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions and database
    from .database import init_db
    init_db()

    # Register blueprint controllers
    from .routes import main_bp
    app.register_blueprint(main_bp)

    return app
