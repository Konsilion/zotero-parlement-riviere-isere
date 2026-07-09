# Zotero Vitrine

Site statique (HTML / CSS / JS) qui affiche une **collection Zotero** sous forme de cartes type e-commerce, avec recherche, filtres par tag/année/type, et modale de détail (abstract + BibTeX copiable).

Déployable sur **GitHub Pages** — aucune backend, aucune dépendance côté navigateur.

## Architecture

```
[ Script Python ]  --(API Zotero, lecture seule)-->  data/collection.json
                                                                |
                                                                v
[ index.html + app.js + style.css ]  --(fetch local)-->  affichage
```

- Le **script Python** est le seul à connaître l'API key Zotero (jamais exposée au navigateur).
- Le **JSON** est l'unique source de vérité du front, commité dans le dépôt.
- Le site est **100 % statique** : GitHub Pages le sert tel quel.

## Structure

```
zotero-vitrine/
├── index.html              # page unique (servie par GitHub Pages)
├── css/style.css
├── js/app.js
├── data/collection.json    # généré par fetch_zotero.py (commité)
├── .nojekyll               # désactive Jekyll (nécessaire pour servir le JSON tel quel)
├── scripts/
│   ├── fetch_zotero.py     # récupère la collection via l'API Zotero
│   ├── config.example.py   # template de credentials (à copier en config.py)
│   └── config.py           # credentials réels (.gitignore — JAMAIS commité)
├── start.sh                # lancer en local
├── deploy.sh               # mettre à jour sur GitHub Pages
├── requirements.txt
└── .gitignore
```

## Installation locale

```bash
cd zotero-vitrine
pip install requests
cp scripts/config.example.py scripts/config.py
# → renseigne ZOTERO_GROUP_ID, ZOTERO_API_KEY, ZOTERO_COLLECTION_ID dans config.py
bash start.sh
```
→ ouvre http://localhost:8000

## Déploiement GitHub Pages

### 1. Créer le dépôt sur GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/konsilion/zotero-parlement-riviere-isere.git
git push -u origin main
```

### 2. Activer GitHub Pages

Sur GitHub : **Settings → Pages → Source = Deploy from a branch → Branch = `main` / Root**

→ URL : `https://konsilion.github.io/zotero-parlement-riviere-isere/`

### 3. Mettre à jour la collection

Une seule commande :

```bash
bash deploy.sh
```

Ce script :
1. Récupère les données depuis Zotero (via `fetch_zotero.py`)
2. Commit le nouveau `data/collection.json`
3. Push vers `main`
4. GitHub Pages se met à jour automatiquement (1-2 min)

## Intégration iframe

Pour embarquer la vitrine dans un autre site :

```html
<iframe
  src="https://konsilion.github.io/zotero-parlement-riviere-isere/"
  width="100%"
  height="800"
  frameborder="0"
  title="Collection Zotero"
></iframe>
```

## Sécurité

- `scripts/config.py` est dans `.gitignore` — **ne jamais le commiter**.
- L'API key ne quitte jamais la machine qui exécute le script Python.
- Le site en ligne ne contient que des données publiques (métadonnées Zotero, pas de credentials).