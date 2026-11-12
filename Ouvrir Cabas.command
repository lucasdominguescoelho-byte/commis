#!/bin/sh
# Lance Cabas sur un petit serveur local (accessible uniquement depuis ce Mac) et ouvre le navigateur.
cd "$(dirname "$0")" || exit 1
PORT=8765
echo "Cabas tourne sur http://localhost:$PORT — fermez cette fenêtre pour l'arrêter."
( sleep 1; open "http://localhost:$PORT/" ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
