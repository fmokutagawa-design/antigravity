import os
import json

_config = None

def load_config():
    global _config
    if _config is not None:
        return _config
    config_path = os.path.join(os.path.dirname(__file__), "nexus_config.json")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            _config = json.load(f)
    else:
        _config = {}
    return _config

def get_manuscript_dirs():
    config = load_config()
    return config.get("manuscript_dirs", [])

def get_rules_path():
    config = load_config()
    explicit = config.get("rules_path")
    if explicit and os.path.exists(explicit):
        return explicit
    # 自動検出: nexus_backend の親ディレクトリ → リポジトリルート
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "nexus_proof_rules.json"),
        os.path.join(os.path.dirname(__file__), "nexus_proof_rules.json"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None
