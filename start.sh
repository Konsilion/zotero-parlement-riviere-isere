#!/usr/bin/env bash
# start.sh — récupère la collection Zotero et lance le serveur local.
# Usage: bash start.sh [port]
set -euo pipefail

cd "$(dirname "$0")"

echo "══════════════════════════════════════════════════"
echo "  Zotero Vitrine — démarrage local"
echo "══════════════════════════════════════════════════"

# 1. Vérifier config.py
if [ ! -f scripts/config.py ]; then
    echo "✗ config.py introuvable."
    echo "  → cp scripts/config.example.py scripts/config.py"
    echo "  → renseigne ZOTERO_GROUP_ID, ZOTERO_API_KEY, ZOTERO_COLLECTION_ID"
    exit 1
fi

# 2. Vérifier requests
if ! python3 -c "import requests" 2>/dev/null; then
    echo "→ Installation de requests…"
    pip install requests -q
fi

# 3. Récupérer les données Zotero
echo ""
echo "→ Synchronisation avec Zotero…"
python3 scripts/fetch_zotero.py

# 4. Lancer le serveur (index.html est à la racine)
PORT="${1:-8000}"
echo ""
echo "→ Serveur local sur http://localhost:${PORT}"
echo "  (Ctrl+C pour arrêter)"
echo ""
python3 -m http.server "$PORT"