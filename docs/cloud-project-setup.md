# Cloud project setup

Follow these steps whenever you spin up a fresh Firebase project for PortfoliYOU cloud portfolios.

## 1. Deploy the composite index

The renderer queries the `projects` collection with `where('ownerUid', '==', uid)` and `orderBy('updatedAt', 'desc')`. Firestore requires a composite index for that query.

1. Ensure the Firebase CLI is authenticated against the correct project (`firebase login`, then `firebase use portfoli-you`).
2. Deploy the index file that lives in `firestore.indexes.json`:
   ```bash
   firebase deploy --only firestore:indexes
   ```
3. Alternatively, create the index manually in the Firebase console with:
   - Collection: `projects`
   - Fields: `ownerUid` (Ascending), `updatedAt` (Descending)
   - Scope: Collection (not collection group)

## 2. Deploy the updated security rules

Client-side cloud creation now writes directly to `/projects/{projectId}`. The rules in `firestore.rules` permit creates only when the authenticated user matches `ownerUid` and the document sets `serverCreated: true`.

Run:
```bash
firebase deploy --only firestore:rules
```

Without these rules, the renderer surfaces `FirebaseError: Missing or insufficient permissions` during creation.

## 3. Configure Storage CORS for local/dev builds

Firebase Storage blocks requests from `http://localhost:5173` by default, which is why uploads/downloads fail with `Response to preflight request doesn't pass access control check`. Configure the bucket's CORS policy once per project:

1. Make sure the Google Cloud SDK / `gsutil` is authenticated for this Firebase project (`gcloud auth login` and `gcloud config set project portfoli-you`).
2. Tailor the allowed origins inside `storage.cors.json` if you deploy to additional domains.
3. Apply the policy to the default bucket:
   ```bash
   gsutil cors set storage.cors.json gs://portfoli-you.appspot.com
   ```
4. CORS changes can take a couple minutes. Hard refresh the renderer after the command succeeds.

## 4. Repeat after environment changes

Anytime you switch Firebase projects or recreate the Firestore instance, redeploy both the rules and indexes above and re-run the CORS command; otherwise the UI will show the subscription/index errors captured in the browser console (cloud project list fails and create modal falls back to local download).
