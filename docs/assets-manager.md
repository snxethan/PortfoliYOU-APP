# Asset Manager

Provides local image (and generic blob) storage with deduplication by SHA-256 content hash and optional Firebase cloud synchronization when the user is signed in.

## Overview

Local persistence uses IndexedDB (`py_assets_v1`) with two object stores:
- `blobs`: Raw `Blob` data keyed by content hash
- `meta`: `AssetMeta` records keyed by content hash

`AssetMeta` fields:
- `hash`: SHA-256 hex digest of file contents
- `name`: Original filename
- `type`: MIME type
- `size`: Size in bytes
- `width` / `height`: Image dimensions (if resolvable)
- `createdAt`: ISO timestamp when first added locally
- `cloudPath`: Firebase Storage path (after sync)
- `cloudUrl`: Public download URL (after sync)
- `syncedAt`: ISO timestamp when successfully uploaded to cloud

## Deduplication
When adding files (`addFiles`), each file's SHA-256 hash is computed. If the hash already exists in `meta`, the existing record is reused and the file is not re-stored. This ensures identical files only occupy space once.

## Cloud Sync
If the user is authenticated (`auth.currentUser`), assets can be synchronized to Firebase Storage:
- `syncToCloud(hash)`: Uploads a specific asset if not already present, sets `cloudPath`, `cloudUrl`, and `syncedAt`.
- `syncAllToCloud()`: Iterates all local assets, synchronizing any missing `cloudUrl` or `syncedAt`.
- Automatic bulk sync occurs immediately after a successful sign-in.

## Lazy Retrieval / Ensure
`ensure(hash)` guarantees the local blob exists. If the blob was removed locally but has a `cloudUrl`, it fetches and re-caches the blob in IndexedDB.

## Preview URLs
`getUrl(hash)` provides an object URL for rendering/preview. URLs are memoized until `remove` revokes them.

## Removal
`remove(hash)` deletes both blob and metadata locally. (Cloud copy is not deleted.) Future enhancement may add cloud deletion support.

## Usage (React)
Wrap the application with `AssetsProvider` then use the `useAssets()` hook:

```tsx
const { list, addFiles, getUrl, syncToCloud, syncAllToCloud, ensure } = useAssets();
```

## Future Enhancements
- Cloud deletion & orphan detection
- Tagging / categorization
- Background sync queue with progress events
- Incremental thumbnail generation
- Quota management & reporting

