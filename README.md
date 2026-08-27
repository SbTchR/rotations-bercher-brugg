# Rotations Bercher–Brugg

Webapp privée de préparation des inscriptions et appairages pour les échanges linguistiques de 11H. L’interface est publiée sur GitHub Pages; les données d’élèves restent dans une base Supabase protégée par cinq comptes génériques créés à l’avance.

## Ce que l’outil gère

- saisie rapide des bulletins et import du classeur historique à deux tableaux;
- distinction VP/VG à Bercher et Bez/Sek à Brugg, avec préférence souple pour VP ↔ Bez et VG ↔ Sek;
- un seul champ Nom et prénom, genre obligatoire, et participation en trois états (voyage et accueille, voyage sans accueillir, accueille sans voyager);
- uniquement les élèves qui participent, avec indication simple de l’accueil possible ou impossible;
- nom du correspondant actuel et détection automatique de sa présence dans l’application;
- correspondant actuel, autre partenaire, personne imposée ou choix libre;
- préférence non bloquante VP ↔ Bezirksschule et VG ↔ Sekundarschule;
- autre sexe, rotations A/B et un champ unique « Autres infos utiles »;
- binômes et groupes à trois, score expliqué, conflits bloquants et avertissements;
- blocs A/B bien séparés et bilan des départs, arrivées et soldes pour chaque classe et chaque partie de semaine;
- scénarios indépendants, verrouillage, annuler/rétablir, export Excel, impression et sauvegarde JSON;
- enregistrement partagé avec contrôle de version pour éviter l’écrasement silencieux du travail d’une collègue.

Le mode démonstration s’active uniquement sur `localhost`. Sur GitHub Pages, l’application reste entièrement verrouillée tant que Supabase n’est pas configuré, puis demande une connexion avant d’afficher la moindre vue.

## Activation du stockage privé

1. Créer un projet Supabase dans la région souhaitée.
2. Ouvrir l’éditeur SQL et exécuter [`supabase/schema.sql`](supabase/schema.sql).
3. Dans **Authentication → Users**, créer les cinq utilisateurs indiqués à la fin de `supabase/schema.sql`, avec un mot de passe différent pour chacun et l’adresse déjà confirmée. Ces adresses techniques ne sont jamais montrées aux utilisateurs.
4. Dans les réglages du fournisseur **Email**, désactiver la création de nouveaux comptes. Il ne doit rester aucune inscription publique.
5. Copier `public/config.example.js` vers `public/config.js`, puis remplacer l’URL et la clé publique `anon`. Conserver `allowDemo: false`. Cette clé est conçue pour être publique; les règles RLS de la base bloquent tout accès non autorisé.
6. Dans GitHub, ouvrir **Settings → Pages → Build and deployment** et choisir **GitHub Actions**.

L’écran de connexion attend uniquement `responsable1` à `responsable5` et le mot de passe correspondant. Ne jamais enregistrer ces mots de passe dans le dépôt.

## Développement local

```bash
npm install
npm run dev
```

Avant publication :

```bash
npm test
npm run build
```

## Confidentialité

Ne jamais ajouter le fichier Excel réel, un export JSON/Excel, des coordonnées ou une copie de la base dans le dépôt GitHub. Le dépôt ne contient que des élèves fictifs de démonstration, invisibles sur le site public. Les données réelles sont stockées uniquement dans Supabase et protégées par authentification et règles RLS.
