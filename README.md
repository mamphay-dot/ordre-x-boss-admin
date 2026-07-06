# BOSS Admin

Console **super-admin cross-tenant** pour l'exploitant de BOSS.
Voir tous les clients, licences, CA, activité — générer des rapports pour la banque.

- **URL** : https://admin.boss.ordre-x.com
- **Cible** : Mamphay + super-admins désignés
- **Auth** : magic link Supabase + vérification `is_super_admin()` en base
- **Zéro dépendance** runtime (vanilla JS + `bossnet.js` copié depuis le repo BOSS principal)

## Build

```bash
node build.js
```

Génère `docs/index.html` (fichier unique), consommable par GitHub Pages.

## Sécurité

Toutes les données sensibles sont accessibles via **RLS Postgres avec bypass pour `is_super_admin()`**.
Le compte doit être :
1. Inscrit sur BOSS (via `boss.ordre-x.com`)
2. Ajouté dans la table `super_admins` (SQL Editor ou depuis la console admin par un super-admin existant)

Sans passer les 2 étapes → écran « Accès refusé ».
