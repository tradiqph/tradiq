# TradIQ Firebase Setup

Project: **tradiq-f4962**

## Status

Firebase MCP and CLI are linked to this project. Firestore database creation is **blocked** until you complete the steps below.

## Required steps (one-time)

### 1. Enable billing
https://console.developers.google.com/billing/enable?project=tradiq-f4962

Firestore requires billing on the GCP project (free tier still applies).

### 2. Enable Firestore API
https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=tradiq-f4962

Click **Enable**.

### 3. Create Firestore database
https://console.firebase.google.com/project/tradiq-f4962/firestore

- Mode: **Production** (Native mode)
- Region: **asia-southeast1** (Singapore — closest to PH)

Or via CLI after steps 1–2:
```bash
npx firebase firestore:databases:create "(default)" --location=asia-southeast1
```

### 4. Add Admin service account (for API routes + seeding)

1. Firebase Console → Project Settings → Service accounts
2. Click **Generate new private key**
3. Copy the JSON contents into `.env.local` as a single line:
   ```
   FIREBASE_ADMIN_SERVICE_ACCOUNT={"type":"service_account",...}
   ```

### 5. Deploy rules & indexes
```bash
npm run firebase:deploy:rules
```

### 6. Seed database
```bash
npm run seed:firestore
```

This creates:
- `appConfig/platform` — rates, presets, platform settings
- `botsCatalog/*` — 4 elite trading bots
- `_meta/schema` — schema version marker

### 7. Set admin user

After registering your account, in Firestore Console set on your user doc:
```
role: "admin"
```

## Collections structure

See [firestore/SCHEMA.md](firestore/SCHEMA.md) for full schema.

## Verify

```bash
npx firebase firestore:databases:list
```

Should show `(default)` in `asia-southeast1`.
