#!/usr/bin/env python3
"""Entrée release de l'importeur universel VOX Card Sim.

TCGdex applique actuellement `recordToQuery(data.filters ?? data)` avant ses
arguments historiques `pagination` et `sort`. Sans `filters:{}`, ces deux objets
sont interprétés comme des filtres et le serveur échoue avec
`value.indexOf is not a function`.

On corrige ici le document GraphQL au démarrage sans dégrader l'importeur vers le
fallback REST incomplet. Cette couche est volontairement minuscule et pourra être
supprimée dès que l'API TCGdex n'aura plus ce comportement.
"""
from __future__ import annotations

import import_all_collections as importer

needle = "sets(pagination:{page:$page,itemsPerPage:$count},sort:"
replacement = "sets(filters:{},pagination:{page:$page,itemsPerPage:$count},sort:"

if needle not in importer.GRAPHQL_QUERY_TEMPLATE:
    raise RuntimeError("Contrat GraphQL TCGdex inattendu : patch release non appliqué")

importer.GRAPHQL_QUERY_TEMPLATE = importer.GRAPHQL_QUERY_TEMPLATE.replace(needle, replacement, 1)

if __name__ == "__main__":
    raise SystemExit(importer.main())
