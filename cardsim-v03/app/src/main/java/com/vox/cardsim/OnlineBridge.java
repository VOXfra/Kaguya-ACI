package com.vox.cardsim;

import android.app.Activity;
import android.os.CancellationSignal;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FieldPath;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Query;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import com.google.firebase.firestore.QuerySnapshot;
import com.google.firebase.firestore.SetOptions;
import com.google.firebase.firestore.Transaction;
import com.google.firebase.firestore.WriteBatch;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class OnlineBridge {
    private static final int SAVE_CHUNK = 360000;
    private final Activity activity;
    private final WebView web;
    private final FirebaseAuth auth;
    private final FirebaseFirestore db;
    private final CredentialManager credentialManager;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String pendingCloudSave = null;
    private volatile boolean cloudWritesEnabled = false;
    private final Runnable cloudSaveRunnable = this::flushPendingCloudSave;

    public OnlineBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        this.auth = FirebaseAuth.getInstance();
        this.db = FirebaseFirestore.getInstance();
        this.credentialManager = CredentialManager.create(activity);
        this.auth.addAuthStateListener(firebaseAuth -> emitAuth());
    }

    public void ensureSignedIn() {
        FirebaseUser u = auth.getCurrentUser();
        if (u != null) {
            emitAuth();
            fetchReceipts();
            return;
        }
        auth.signInAnonymously().addOnCompleteListener(activity, task -> {
            if (task.isSuccessful()) {
                emitAuth();
                requestCloudSave();
                fetchReceipts();
            } else {
                emitError("auth", task.getException());
            }
        });
    }

    private void emitAuth() {
        try {
            FirebaseUser u = auth.getCurrentUser();
            JSONObject o = new JSONObject();
            o.put("signedIn", u != null);
            if (u != null) {
                o.put("uid", u.getUid());
                o.put("anonymous", u.isAnonymous());
                o.put("displayName", u.getDisplayName() == null ? "" : u.getDisplayName());
                o.put("email", u.getEmail() == null ? "" : u.getEmail());
                o.put("photoUrl", u.getPhotoUrl() == null ? "" : u.getPhotoUrl().toString());
            }
            emit("auth", o);
        } catch (Exception ignored) {}
    }

    private void emitError(String scope, Exception e) {
        try {
            JSONObject o = new JSONObject();
            o.put("scope", scope);
            o.put("message", e == null || e.getMessage() == null ? "Erreur inconnue" : e.getMessage());
            emit("error", o);
        } catch (Exception ignored) {}
    }

    private void emit(String type, JSONObject payload) {
        String js = "window.voxOnlineEvent&&window.voxOnlineEvent(" + JSONObject.quote(type) + "," + payload.toString() + ");";
        activity.runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    @JavascriptInterface
    public String authState() {
        try {
            FirebaseUser u = auth.getCurrentUser();
            JSONObject o = new JSONObject();
            o.put("signedIn", u != null);
            if (u != null) {
                o.put("uid", u.getUid());
                o.put("anonymous", u.isAnonymous());
                o.put("displayName", u.getDisplayName() == null ? "" : u.getDisplayName());
                o.put("email", u.getEmail() == null ? "" : u.getEmail());
                o.put("photoUrl", u.getPhotoUrl() == null ? "" : u.getPhotoUrl().toString());
            }
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface
    public void signInGoogle() {
        activity.runOnUiThread(() -> {
            try {
                GetGoogleIdOption option = new GetGoogleIdOption.Builder()
                        .setFilterByAuthorizedAccounts(false)
                        .setServerClientId(activity.getString(R.string.default_web_client_id))
                        .setAutoSelectEnabled(false)
                        .build();
                GetCredentialRequest request = new GetCredentialRequest.Builder()
                        .addCredentialOption(option)
                        .build();
                credentialManager.getCredentialAsync(
                        activity,
                        request,
                        new CancellationSignal(),
                        executor,
                        new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                            @Override public void onResult(GetCredentialResponse result) {
                                handleGoogleCredential(result.getCredential());
                            }
                            @Override public void onError(@NonNull GetCredentialException e) {
                                emitError("google_signin", e);
                            }
                        });
            } catch (Exception e) {
                emitError("google_signin", e);
            }
        });
    }

    private void handleGoogleCredential(Credential credential) {
        try {
            if (!(credential instanceof CustomCredential) ||
                    !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                throw new Exception("Identifiant Google inattendu");
            }
            Bundle data = ((CustomCredential) credential).getData();
            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(data);
            AuthCredential firebaseCredential = GoogleAuthProvider.getCredential(google.getIdToken(), null);
            FirebaseUser current = auth.getCurrentUser();
            if (current != null && current.isAnonymous()) {
                current.linkWithCredential(firebaseCredential).addOnCompleteListener(activity, task -> {
                    if (task.isSuccessful()) {
                        emitAuth();
                        requestCloudSave();
                        fetchReceipts();
                    } else {
                        auth.signInWithCredential(firebaseCredential).addOnCompleteListener(activity, signTask -> {
                            if (signTask.isSuccessful()) {
                                emitAuth();
                                requestCloudSave();
                                fetchReceipts();
                            } else emitError("google_signin", signTask.getException());
                        });
                    }
                });
            } else {
                auth.signInWithCredential(firebaseCredential).addOnCompleteListener(activity, task -> {
                    if (task.isSuccessful()) {
                        emitAuth();
                        requestCloudSave();
                        fetchReceipts();
                    } else emitError("google_signin", task.getException());
                });
            }
        } catch (Exception e) {
            emitError("google_signin", e);
        }
    }

    @JavascriptInterface
    public void setCloudWritesEnabled(boolean enabled) {
        cloudWritesEnabled = enabled;
        if (enabled && pendingCloudSave != null) {
            handler.removeCallbacks(cloudSaveRunnable);
            handler.postDelayed(cloudSaveRunnable, 1500);
        }
    }

    @JavascriptInterface
    public void queueCloudSave(String json) {
        if (json == null || json.isEmpty()) return;
        pendingCloudSave = json;
        if (!cloudWritesEnabled) return;
        handler.removeCallbacks(cloudSaveRunnable);
        handler.postDelayed(cloudSaveRunnable, 7000);
    }

    @JavascriptInterface
    public void flushCloudSave() {
        handler.removeCallbacks(cloudSaveRunnable);
        flushPendingCloudSave();
    }

    private void flushPendingCloudSave() {
        if (!cloudWritesEnabled) return;
        String json = pendingCloudSave;
        pendingCloudSave = null;
        FirebaseUser u = auth.getCurrentUser();
        if (u == null || json == null || json.isEmpty()) return;
        try {
            byte[] utf8 = json.getBytes(StandardCharsets.UTF_8);
            String encoded = Base64.encodeToString(utf8, Base64.NO_WRAP);
            int chunks = Math.max(1, (encoded.length() + SAVE_CHUNK - 1) / SAVE_CHUNK);
            if (chunks > 450) throw new Exception("Sauvegarde cloud trop volumineuse");
            DocumentReference root = db.collection("cloudSaves").document(u.getUid());
            WriteBatch batch = db.batch();
            Map<String,Object> meta = new HashMap<>();
            meta.put("uid", u.getUid());
            meta.put("chunkCount", chunks);
            meta.put("checksum", sha256(json));
            meta.put("bytes", utf8.length);
            meta.put("updatedAt", FieldValue.serverTimestamp());
            try {
                JSONObject j = new JSONObject(json);
                meta.put("saveTime", j.optLong("lastSavedAt", System.currentTimeMillis()));
                meta.put("schemaVersion", j.optInt("schemaVersion", j.optInt("version", 7)));
            } catch (Exception ignored) {
                meta.put("saveTime", System.currentTimeMillis());
            }
            batch.set(root, meta, SetOptions.merge());
            for (int i = 0; i < chunks; i++) {
                int start = i * SAVE_CHUNK, end = Math.min(encoded.length(), start + SAVE_CHUNK);
                Map<String,Object> m = new HashMap<>();
                m.put("index", i);
                m.put("data", encoded.substring(start, end));
                batch.set(root.collection("chunks").document(String.format(Locale.US, "%04d", i)), m);
            }
            batch.commit().addOnSuccessListener(unused -> {
                try {
                    JSONObject o = new JSONObject(); o.put("ok", true); o.put("chunks", chunks); emit("cloudSaved", o);
                } catch (Exception ignored) {}
            }).addOnFailureListener(e -> emitError("cloud_save", e));
        } catch (Exception e) {
            emitError("cloud_save", e);
        }
    }

    @JavascriptInterface
    public void requestCloudSave() {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null) return;
        DocumentReference root = db.collection("cloudSaves").document(u.getUid());
        root.get().addOnSuccessListener(doc -> {
            if (!doc.exists()) {
                try { JSONObject o = new JSONObject(); o.put("exists", false); emit("cloudLoaded", o); } catch (Exception ignored) {}
                return;
            }
            Long c = doc.getLong("chunkCount");
            int count = c == null ? 0 : c.intValue();
            if (count <= 0) {
                try { JSONObject o = new JSONObject(); o.put("exists", false); emit("cloudLoaded", o); } catch (Exception ignored) {}
                return;
            }
            root.collection("chunks").orderBy(FieldPath.documentId()).limit(count).get()
                    .addOnSuccessListener(qs -> {
                        try {
                            StringBuilder b = new StringBuilder();
                            for (DocumentSnapshot d : qs.getDocuments()) b.append(d.getString("data") == null ? "" : d.getString("data"));
                            String json = new String(Base64.decode(b.toString(), Base64.DEFAULT), StandardCharsets.UTF_8);
                            String expected = doc.getString("checksum");
                            if (expected != null && !expected.equals(sha256(json))) throw new Exception("Checksum sauvegarde cloud invalide");
                            JSONObject o = new JSONObject();
                            o.put("exists", true);
                            o.put("json", json);
                            o.put("saveTime", doc.getLong("saveTime") == null ? 0 : doc.getLong("saveTime"));
                            emit("cloudLoaded", o);
                        } catch (Exception e) { emitError("cloud_load", e); }
                    }).addOnFailureListener(e -> emitError("cloud_load", e));
        }).addOnFailureListener(e -> emitError("cloud_load", e));
    }

    @JavascriptInterface
    public void publishProfile(String json) {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null) return;
        try {
            JSONObject src = new JSONObject(json);
            Map<String,Object> map = jsonObjectToMap(src);
            map.put("uid", u.getUid());
            map.put("anonymous", u.isAnonymous());
            map.put("googleName", u.getDisplayName() == null ? "" : u.getDisplayName());
            map.put("googlePhoto", u.getPhotoUrl() == null ? "" : u.getPhotoUrl().toString());
            map.put("updatedAt", FieldValue.serverTimestamp());
            db.collection("publicProfiles").document(u.getUid()).set(map, SetOptions.merge())
                    .addOnFailureListener(e -> emitError("profile_publish", e));
        } catch (Exception e) { emitError("profile_publish", e); }
    }

    @JavascriptInterface
    public void fetchProfiles(int limit) {
        int n = Math.max(1, Math.min(limit, 50));
        db.collection("publicProfiles").orderBy("updatedAt", Query.Direction.DESCENDING).limit(n).get()
                .addOnSuccessListener(qs -> {
                    try {
                        JSONArray a = new JSONArray();
                        for (QueryDocumentSnapshot d : qs) a.put(mapToJson(d.getData()));
                        JSONObject o = new JSONObject(); o.put("profiles", a); emit("profiles", o);
                    } catch (Exception e) { emitError("profiles", e); }
                }).addOnFailureListener(e -> emitError("profiles", e));
    }

    @JavascriptInterface
    public void fetchProfile(String uid) {
        if (uid == null || uid.isEmpty()) return;
        db.collection("publicProfiles").document(uid).get().addOnSuccessListener(d -> {
            try {
                JSONObject o = new JSONObject(); o.put("exists", d.exists()); if (d.exists()) o.put("profile", mapToJson(d.getData())); emit("profile", o);
            } catch (Exception e) { emitError("profile", e); }
        }).addOnFailureListener(e -> emitError("profile", e));
    }

    @JavascriptInterface
    public String publishListing(String json) {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null) return "";
        try {
            JSONObject src = new JSONObject(json);
            String localId = src.optString("localListingId", "LIST");
            String safe = localId.replaceAll("[^A-Za-z0-9_-]", "_");
            String remoteId = u.getUid() + "_" + safe;
            Map<String,Object> map = jsonObjectToMap(src);
            map.put("remoteId", remoteId);
            map.put("sellerUid", u.getUid());
            map.put("status", "active");
            map.put("updatedAt", FieldValue.serverTimestamp());
            if (!map.containsKey("createdAt")) map.put("createdAt", System.currentTimeMillis());
            DocumentReference ref = db.collection("marketListings").document(remoteId);
            db.runTransaction((Transaction.Function<Void>) transaction -> {
                DocumentSnapshot existing = transaction.get(ref);
                if (!existing.exists()) transaction.set(ref, map);
                else if (!u.getUid().equals(existing.getString("sellerUid"))) throw new RuntimeException("Identifiant d'annonce déjà utilisé");
                return null;
            }).addOnSuccessListener(unused -> {
                try { JSONObject o = new JSONObject(); o.put("localListingId", localId); o.put("remoteId", remoteId); emit("listingPublished", o); } catch (Exception ignored) {}
            }).addOnFailureListener(e -> emitError("listing_publish", e));
            return remoteId;
        } catch (Exception e) { emitError("listing_publish", e); return ""; }
    }

    @JavascriptInterface
    public void cancelListing(String remoteId) {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null || remoteId == null || remoteId.isEmpty()) return;
        DocumentReference ref = db.collection("marketListings").document(remoteId);
        db.runTransaction((Transaction.Function<Void>) transaction -> {
            DocumentSnapshot d = transaction.get(ref);
            if (!d.exists()) return null;
            if (!u.getUid().equals(d.getString("sellerUid"))) throw new RuntimeException("Annonce non propriétaire");
            transaction.update(ref, "status", "cancelled", "updatedAt", FieldValue.serverTimestamp());
            return null;
        }).addOnFailureListener(e -> emitError("listing_cancel", e));
    }

    @JavascriptInterface
    public void fetchListings(String assetKey) {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null || assetKey == null || assetKey.isEmpty()) return;
        db.collection("marketListings").whereEqualTo("assetKey", assetKey).limit(60).get()
                .addOnSuccessListener(qs -> {
                    try {
                        JSONArray a = new JSONArray();
                        for (QueryDocumentSnapshot d : qs) {
                            Map<String,Object> m = d.getData();
                            if (!"active".equals(String.valueOf(m.get("status")))) continue;
                            JSONObject x = mapToJson(m); x.put("remoteId", d.getId()); a.put(x);
                        }
                        JSONObject o = new JSONObject(); o.put("assetKey", assetKey); o.put("listings", a); emit("listings", o);
                    } catch (Exception e) { emitError("listings", e); }
                }).addOnFailureListener(e -> emitError("listings", e));
    }

    @JavascriptInterface
    public void fetchOwnListings() {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null) return;
        db.collection("marketListings").whereEqualTo("sellerUid", u.getUid()).limit(150).get()
                .addOnSuccessListener(qs -> {
                    try {
                        JSONArray a = new JSONArray();
                        for (QueryDocumentSnapshot d : qs) { JSONObject x = mapToJson(d.getData()); x.put("remoteId", d.getId()); a.put(x); }
                        JSONObject o = new JSONObject(); o.put("listings", a); emit("ownListings", o);
                    } catch (Exception e) { emitError("own_listings", e); }
                }).addOnFailureListener(e -> emitError("own_listings", e));
    }

    @JavascriptInterface
    public void fetchSellerListings(String sellerUid) {
        if (auth.getCurrentUser() == null || sellerUid == null || sellerUid.isEmpty()) return;
        db.collection("marketListings").whereEqualTo("sellerUid", sellerUid).limit(150).get()
                .addOnSuccessListener(qs -> {
                    try {
                        JSONArray a = new JSONArray();
                        for (QueryDocumentSnapshot d : qs) {
                            Map<String,Object> m = d.getData();
                            if (!"active".equals(String.valueOf(m.get("status")))) continue;
                            JSONObject x = mapToJson(m); x.put("remoteId", d.getId()); a.put(x);
                        }
                        JSONObject o = new JSONObject(); o.put("sellerUid", sellerUid); o.put("listings", a); emit("sellerListings", o);
                    } catch (Exception e) { emitError("seller_listings", e); }
                }).addOnFailureListener(e -> emitError("seller_listings", e));
    }

    @JavascriptInterface
    public void updateOwnListing(String remoteId, int quantity, String status) {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null || remoteId == null || remoteId.isEmpty()) return;
        DocumentReference ref = db.collection("marketListings").document(remoteId);
        db.runTransaction((Transaction.Function<Void>) transaction -> {
            DocumentSnapshot d = transaction.get(ref);
            if (!d.exists()) return null;
            if (!u.getUid().equals(d.getString("sellerUid"))) throw new RuntimeException("Annonce non propriétaire");
            long current = d.getLong("quantity") == null ? 0 : d.getLong("quantity");
            int q = Math.max(0, quantity);
            if (q > current) throw new RuntimeException("Impossible d'augmenter le stock d'une annonce publiée");
            String st = q == 0 ? "sold" : ("cancelled".equals(status) ? "cancelled" : "active");
            transaction.update(ref, "quantity", q, "status", st, "updatedAt", FieldValue.serverTimestamp());
            return null;
        }).addOnFailureListener(e -> emitError("listing_sync", e));
    }

    @JavascriptInterface
    public void buyListing(String remoteId, int quantity) {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null || remoteId == null || remoteId.isEmpty()) return;
        int qty = Math.max(1, Math.min(quantity, 99));
        DocumentReference listingRef = db.collection("marketListings").document(remoteId);
        DocumentReference tradeRef = db.collection("marketTrades").document();
        db.runTransaction(transaction -> {
            DocumentSnapshot listing = transaction.get(listingRef);
            if (!listing.exists()) throw new RuntimeException("Annonce introuvable");
            String status = listing.getString("status");
            String sellerUid = listing.getString("sellerUid");
            Long q = listing.getLong("quantity");
            Double p = listing.getDouble("unitPrice");
            if (!"active".equals(status)) throw new RuntimeException("Annonce indisponible");
            if (sellerUid == null || sellerUid.equals(u.getUid())) throw new RuntimeException("Impossible d'acheter sa propre annonce");
            if (q == null || q < qty) throw new RuntimeException("Stock insuffisant");
            if (p == null || p <= 0) throw new RuntimeException("Prix invalide");
            long remain = q - qty;
            Map<String,Object> upd = new HashMap<>();
            upd.put("quantity", remain);
            upd.put("status", remain == 0 ? "sold" : "active");
            upd.put("lastTradeId", tradeRef.getId());
            upd.put("updatedAt", FieldValue.serverTimestamp());
            transaction.update(listingRef, upd);
            Map<String,Object> trade = new HashMap<>();
            trade.put("tradeId", tradeRef.getId());
            trade.put("listingId", remoteId);
            trade.put("localListingId", listing.getString("localListingId"));
            trade.put("buyerUid", u.getUid());
            trade.put("sellerUid", sellerUid);
            trade.put("quantity", qty);
            trade.put("unitPrice", p);
            trade.put("total", p * qty);
            trade.put("buyerClaimed", false);
            trade.put("sellerClaimed", false);
            trade.put("createdAt", FieldValue.serverTimestamp());
            for (String k : new String[]{"assetKey","itemType","setId","cardId","variant","condition","sku","productId","label","image","sellerName","sellerHandle","sellerAvatar"}) {
                Object v = listing.get(k); if (v != null) trade.put(k, v);
            }
            transaction.set(tradeRef, trade);
            return trade;
        }).addOnSuccessListener(trade -> {
            try { JSONObject o = mapToJson(trade); o.put("tradeId", tradeRef.getId()); emit("purchaseCommitted", o); } catch (Exception e) { emitError("purchase", e); }
        }).addOnFailureListener(e -> emitError("purchase", e));
    }

    @JavascriptInterface
    public void fetchReceipts() {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null) return;
        db.collection("marketTrades").whereEqualTo("sellerUid", u.getUid()).limit(150).get()
                .addOnSuccessListener(qs -> emitTradeList("sellerTrades", qs, "sellerClaimed"))
                .addOnFailureListener(e -> emitError("seller_trades", e));
        db.collection("marketTrades").whereEqualTo("buyerUid", u.getUid()).limit(150).get()
                .addOnSuccessListener(qs -> emitTradeList("buyerTrades", qs, "buyerClaimed"))
                .addOnFailureListener(e -> emitError("buyer_trades", e));
    }

    private void emitTradeList(String type, QuerySnapshot qs, String claimedField) {
        try {
            JSONArray a = new JSONArray();
            for (QueryDocumentSnapshot d : qs) {
                Boolean claimed = d.getBoolean(claimedField);
                if (Boolean.TRUE.equals(claimed)) continue;
                JSONObject x = mapToJson(d.getData()); x.put("tradeId", d.getId()); a.put(x);
            }
            JSONObject o = new JSONObject(); o.put("trades", a); emit(type, o);
        } catch (Exception e) { emitError(type, e); }
    }

    @JavascriptInterface
    public void ackTrade(String tradeId, String side) {
        FirebaseUser u = auth.getCurrentUser();
        if (u == null || tradeId == null || tradeId.isEmpty()) return;
        DocumentReference ref = db.collection("marketTrades").document(tradeId);
        db.runTransaction((Transaction.Function<Void>) transaction -> {
            DocumentSnapshot d = transaction.get(ref);
            if (!d.exists()) return null;
            if ("seller".equals(side)) {
                if (!u.getUid().equals(d.getString("sellerUid"))) throw new RuntimeException("Receipt seller interdit");
                transaction.update(ref, "sellerClaimed", true);
            } else {
                if (!u.getUid().equals(d.getString("buyerUid"))) throw new RuntimeException("Receipt buyer interdit");
                transaction.update(ref, "buyerClaimed", true);
            }
            return null;
        }).addOnFailureListener(e -> emitError("trade_ack", e));
    }

    private static String sha256(String s) {
        try {
            MessageDigest d = MessageDigest.getInstance("SHA-256");
            byte[] b = d.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte x : b) out.append(String.format(Locale.US, "%02x", x));
            return out.toString();
        } catch (Exception e) { return ""; }
    }

    private static Map<String,Object> jsonObjectToMap(JSONObject o) throws Exception {
        Map<String,Object> m = new HashMap<>();
        java.util.Iterator<String> it = o.keys();
        while (it.hasNext()) {
            String k = it.next(); Object v = o.get(k); m.put(k, jsonValue(v));
        }
        return m;
    }

    private static Object jsonValue(Object v) throws Exception {
        if (v == JSONObject.NULL) return null;
        if (v instanceof JSONObject) return jsonObjectToMap((JSONObject) v);
        if (v instanceof JSONArray) {
            JSONArray a = (JSONArray) v; List<Object> out = new ArrayList<>();
            for (int i=0;i<a.length();i++) out.add(jsonValue(a.get(i)));
            return out;
        }
        return v;
    }

    private static JSONObject mapToJson(Map<String,Object> map) throws Exception {
        JSONObject o = new JSONObject();
        for (Map.Entry<String,Object> e : map.entrySet()) o.put(e.getKey(), toJsonValue(e.getValue()));
        return o;
    }

    private static Object toJsonValue(Object v) throws Exception {
        if (v == null) return JSONObject.NULL;
        if (v instanceof Map) {
            JSONObject o = new JSONObject();
            for (Object entryObj : ((Map<?,?>)v).entrySet()) {
                Map.Entry<?,?> e = (Map.Entry<?,?>)entryObj;
                o.put(String.valueOf(e.getKey()), toJsonValue(e.getValue()));
            }
            return o;
        }
        if (v instanceof Iterable) {
            JSONArray a = new JSONArray(); for (Object x : (Iterable<?>)v) a.put(toJsonValue(x)); return a;
        }
        if (v instanceof com.google.firebase.Timestamp) return ((com.google.firebase.Timestamp)v).toDate().getTime();
        return v;
    }
}
