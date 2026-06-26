from flask import Flask, jsonify

from .config import Config
from .extensions import cors, db, verification_codes

DEFAULT_CATEGORIES = ("其他", "地方特产", "新鲜水果", "有机蔬菜", "粮油干货")


def seed_default_categories():
    from .models.entities import Category

    existing_names = {
        item.name
        for item in Category.query.filter(Category.name.in_(DEFAULT_CATEGORIES)).all()
    }
    created_count = 0
    for name in DEFAULT_CATEGORIES:
        if name in existing_names:
            continue
        db.session.add(Category(name=name))
        created_count += 1
    if created_count:
        db.session.commit()
    return created_count


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    verification_codes.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    from .auth.routes import auth_bp
    from .main.routes import main_bp
    from .models import entities  # noqa: F401

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(main_bp, url_prefix="/api")

    from .openapi import docs_bp

    app.register_blueprint(docs_bp, url_prefix="/api/docs")

    @app.get("/api/health")
    def health():
        return jsonify({"data": {"status": "ok"}, "message": "API is running", "error": None})

    @app.cli.command("init-db")
    def init_db():
        db.create_all()
        created_count = seed_default_categories()
        print(f"website2026 tables created. default categories added: {created_count}.")

    return app
