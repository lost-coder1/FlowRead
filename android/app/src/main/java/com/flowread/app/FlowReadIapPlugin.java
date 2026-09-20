package com.flowread.app;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.android.billingclient.api.UnfetchedProduct;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "FlowReadIap")
public class FlowReadIapPlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "FlowReadIap";

    private static final String PRODUCT_PRO = "pro_lifetime";
    private static final String PRODUCT_OCR = "ocr_vision";

    private BillingClient billingClient;
    private final Map<String, ProductDetails> productDetailsCache = new HashMap<>();

    // Holds the pending call while the Play billing sheet is open
    private PluginCall pendingPurchaseCall = null;
    // Which product that pending call was for — needed to recover the existing
    // purchase when Play answers ITEM_ALREADY_OWNED.
    private String pendingProductId = null;

    // ─── Error taxonomy ───────────────────────────────────────────────────────
    // Every non-OK path rejects with a stable machine-readable token as the
    // Capacitor error *code*, so the JS layer can branch on it instead of
    // pattern-matching English prose. Collapsing every failure into one string
    // is what made the H4 purchase bug undiagnosable without a logcat session.

    private static String tokenFor(int responseCode) {
        switch (responseCode) {
            case BillingClient.BillingResponseCode.USER_CANCELED:        return "USER_CANCELED";
            case BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED:   return "ITEM_ALREADY_OWNED";
            case BillingClient.BillingResponseCode.ITEM_NOT_OWNED:       return "ITEM_NOT_OWNED";
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE:     return "ITEM_UNAVAILABLE";
            case BillingClient.BillingResponseCode.SERVICE_DISCONNECTED: return "SERVICE_DISCONNECTED";
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE:  return "SERVICE_UNAVAILABLE";
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE:  return "BILLING_UNAVAILABLE";
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR:      return "DEVELOPER_ERROR";
            case BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED:return "FEATURE_NOT_SUPPORTED";
            case BillingClient.BillingResponseCode.NETWORK_ERROR:        return "NETWORK_ERROR";
            case BillingClient.BillingResponseCode.ERROR:                return "BILLING_ERROR";
            default:                                                     return "UNKNOWN";
        }
    }

    /** Reject carrying the Play response code, plus the debug message for logs. */
    private static void rejectWith(PluginCall call, String where, BillingResult result) {
        if (call == null) return;
        String token = tokenFor(result.getResponseCode());
        Log.w(TAG, where + " failed: " + token
            + " (code=" + result.getResponseCode() + ") " + result.getDebugMessage());
        call.reject(where + ": " + token, token);
    }

    // ─── initBilling ──────────────────────────────────────────────────────────
    @PluginMethod
    public void initBilling(PluginCall call) {
        if (billingClient != null && billingClient.isReady()) {
            JSObject ret = new JSObject();
            ret.put("ready", true);
            call.resolve(ret);
            return;
        }

        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
            )
            .build();

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    JSObject ret = new JSObject();
                    ret.put("ready", true);
                    call.resolve(ret);
                } else {
                    rejectWith(call, "initBilling", billingResult);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Connection dropped. The JS side caches an "initialized" flag, so it
                // must be told to clear it — otherwise every later call fails with
                // NOT_INITIALIZED and never re-inits.
                Log.w(TAG, "Billing service disconnected");
                billingClient = null;
                notifyListeners("billingDisconnected", new JSObject());
            }
        });
    }

    // ─── queryProducts ────────────────────────────────────────────────────────
    @PluginMethod
    public void queryProducts(PluginCall call) {
        if (!isBillingReady(call)) return;

        List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
        productList.add(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_PRO)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        );
        productList.add(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_OCR)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        );

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                rejectWith(call, "queryProducts", billingResult);
                return;
            }

            productDetailsCache.clear();
            JSArray products = new JSArray();

            for (ProductDetails details : productDetailsResult.getProductDetailsList()) {
                productDetailsCache.put(details.getProductId(), details);

                ProductDetails.OneTimePurchaseOfferDetails offerDetails =
                    details.getOneTimePurchaseOfferDetails();

                JSObject product = new JSObject();
                product.put("id",          details.getProductId());
                product.put("title",       details.getTitle());
                product.put("description", details.getDescription());

                if (offerDetails != null) {
                    product.put("price",       offerDetails.getFormattedPrice());
                    product.put("priceMicros", offerDetails.getPriceAmountMicros());
                    product.put("currency",    offerDetails.getPriceCurrencyCode());
                } else {
                    product.put("price",       "");
                    product.put("priceMicros", 0);
                    product.put("currency",    "");
                }

                products.put(product);
            }

            // Billing 8+ reports products Play could not fetch separately rather than
            // leaving them silently absent. Surface them — a misconfigured Play Console
            // product otherwise looks identical to a working one that simply failed.
            JSArray unfetched = new JSArray();
            try {
                List<UnfetchedProduct> unfetchedList = productDetailsResult.getUnfetchedProductList();
                if (unfetchedList != null) {
                    for (UnfetchedProduct u : unfetchedList) {
                        unfetched.put(u.getProductId());
                        Log.w(TAG, "queryProducts: Play could not fetch product " + u.getProductId()
                            + " (statusCode=" + u.getStatusCode() + ")");
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "queryProducts: unfetched product list unavailable", t);
            }

            JSObject ret = new JSObject();
            ret.put("products", products);
            ret.put("unfetched", unfetched);
            call.resolve(ret);
        });
    }

    // ─── purchaseProduct ──────────────────────────────────────────────────────
    @PluginMethod
    public void purchaseProduct(PluginCall call) {
        if (!isBillingReady(call)) return;

        String productId = call.getString("productId");
        if (productId == null || productId.isEmpty()) {
            call.reject("Missing productId", "INVALID_ARGUMENT");
            return;
        }

        ProductDetails details = productDetailsCache.get(productId);
        if (details == null) {
            call.reject("Product not cached. Call queryProducts first.", "PRODUCT_NOT_LOADED");
            return;
        }

        if (details.getOneTimePurchaseOfferDetails() == null) {
            call.reject("Product offer details unavailable.", "ITEM_UNAVAILABLE");
            return;
        }

        pendingPurchaseCall = call;
        pendingProductId = productId;
        call.setKeepAlive(true);

        List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList = new ArrayList<>();
        productDetailsParamsList.add(
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details)
                .build()
        );

        BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(productDetailsParamsList)
            .build();

        Activity activity = getActivity();
        BillingResult result = billingClient.launchBillingFlow(activity, billingFlowParams);

        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            clearPending();
            call.setKeepAlive(false);
            rejectWith(call, "launchBillingFlow", result);
        }
    }

    // ─── PurchasesUpdatedListener ─────────────────────────────────────────────
    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        PluginCall call = pendingPurchaseCall;
        String productId = pendingProductId;
        clearPending();

        int code = billingResult.getResponseCode();

        if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            // NOT a failure: the user owns this product. Telling a paying customer
            // their purchase failed — and leaving them locked out — was the H4 bug.
            recoverOwnedPurchase(productId, call, billingResult);
            return;
        }

        if (code != BillingClient.BillingResponseCode.OK) {
            if (call != null) {
                call.setKeepAlive(false);
                rejectWith(call, "purchase", billingResult);
            }
            return;
        }

        if (purchases == null || purchases.isEmpty()) {
            if (call != null) {
                call.setKeepAlive(false);
                Log.w(TAG, "purchase returned OK with no purchases");
                call.reject("purchase: EMPTY_RESULT", "EMPTY_RESULT");
            }
            return;
        }

        Purchase purchase = purchases.get(0);

        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            // A pending payment (cash, delayed card) is a legitimate outcome, not an
            // error — resolve so the JS layer can say so plainly instead of toasting
            // a failure the user can do nothing about.
            if (call != null) {
                call.setKeepAlive(false);
                JSObject ret = new JSObject();
                ret.put("pending", true);
                ret.put("purchaseToken", purchase.getPurchaseToken());
                call.resolve(ret);
            }
            return;
        }

        acknowledgePurchaseAndResolve(purchase, call);
    }

    /**
     * Play says the account already owns the product. Find the existing purchase,
     * acknowledge it if Play never got an ack, and resolve as a success so the
     * entitlement unlocks.
     */
    private void recoverOwnedPurchase(String productId, PluginCall call, BillingResult originalResult) {
        if (call == null) return;

        if (billingClient == null || !billingClient.isReady()) {
            call.setKeepAlive(false);
            call.reject("purchase: ITEM_ALREADY_OWNED", "ITEM_ALREADY_OWNED");
            return;
        }

        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build();

        billingClient.queryPurchasesAsync(params, (queryResult, purchaseList) -> {
            if (queryResult.getResponseCode() == BillingClient.BillingResponseCode.OK
                    && purchaseList != null) {
                for (Purchase p : purchaseList) {
                    if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                    if (productId != null && !p.getProducts().contains(productId)) continue;
                    Log.i(TAG, "ITEM_ALREADY_OWNED recovered for " + productId);
                    acknowledgePurchaseAndResolve(p, call);
                    return;
                }
            }
            // Owned per Play, but we could not find the record to unlock from.
            Log.w(TAG, "ITEM_ALREADY_OWNED but no matching purchase found for " + productId);
            call.setKeepAlive(false);
            call.reject("purchase: ITEM_ALREADY_OWNED", "ITEM_ALREADY_OWNED");
        });
    }

    // ─── queryPurchases ───────────────────────────────────────────────────────
    @PluginMethod
    public void queryPurchases(PluginCall call) {
        if (!isBillingReady(call)) return;

        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build();

        billingClient.queryPurchasesAsync(params, (billingResult, purchaseList) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                rejectWith(call, "queryPurchases", billingResult);
                return;
            }

            JSArray purchases = new JSArray();
            for (Purchase purchase : purchaseList) {
                if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;

                for (String productId : purchase.getProducts()) {
                    JSObject item = new JSObject();
                    item.put("productId",     productId);
                    item.put("purchaseToken", purchase.getPurchaseToken());
                    item.put("acknowledged",  purchase.isAcknowledged());
                    purchases.put(item);

                    if (!purchase.isAcknowledged()) {
                        acknowledgeQuietly(purchase);
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("purchases", purchases);
            call.resolve(ret);
        });
    }

    // ─── acknowledgePurchase (exposed for edge cases) ─────────────────────────
    @PluginMethod
    public void acknowledgePurchase(PluginCall call) {
        if (!isBillingReady(call)) return;
        String token = call.getString("purchaseToken");
        if (token == null || token.isEmpty()) {
            call.reject("Missing purchaseToken", "INVALID_ARGUMENT");
            return;
        }

        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(token)
            .build();

        billingClient.acknowledgePurchase(params, billingResult -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                JSObject ret = new JSObject();
                ret.put("acknowledged", true);
                call.resolve(ret);
            } else {
                rejectWith(call, "acknowledgePurchase", billingResult);
            }
        });
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private void clearPending() {
        pendingPurchaseCall = null;
        pendingProductId = null;
    }

    private void acknowledgePurchaseAndResolve(Purchase purchase, PluginCall call) {
        if (purchase.isAcknowledged()) {
            if (call != null) {
                call.setKeepAlive(false);
                resolveSuccessfulPurchase(purchase, call, true);
            }
            return;
        }

        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();

        billingClient.acknowledgePurchase(params, billingResult -> {
            boolean acknowledged =
                billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK;
            if (!acknowledged) {
                Log.w(TAG, "acknowledge failed: " + tokenFor(billingResult.getResponseCode())
                    + " " + billingResult.getDebugMessage());
            }
            if (call == null) return;
            call.setKeepAlive(false);
            // Always resolve — money was charged regardless of acknowledgment outcome.
            // Unacknowledged purchases are retried on next queryPurchases.
            resolveSuccessfulPurchase(purchase, call, acknowledged);
        });
    }

    private void resolveSuccessfulPurchase(Purchase purchase, PluginCall call, boolean acknowledged) {
        JSArray productIds = new JSArray();
        for (String id : purchase.getProducts()) {
            productIds.put(id);
        }
        JSObject ret = new JSObject();
        ret.put("productIds",    productIds);
        ret.put("purchaseToken", purchase.getPurchaseToken());
        ret.put("acknowledged",  acknowledged);
        call.resolve(ret);
    }

    private void acknowledgeQuietly(Purchase purchase) {
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        billingClient.acknowledgePurchase(params, result -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.w(TAG, "quiet acknowledge failed: " + tokenFor(result.getResponseCode()));
            }
        });
    }

    private boolean isBillingReady(PluginCall call) {
        if (billingClient == null || !billingClient.isReady()) {
            call.reject("Billing not initialized. Call initBilling first.", "NOT_INITIALIZED");
            return false;
        }
        return true;
    }
}
