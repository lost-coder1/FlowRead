package com.flowread.app;

import android.app.Activity;

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

    private static final String PRODUCT_PRO = "pro_lifetime";
    private static final String PRODUCT_OCR = "ocr_vision";

    private BillingClient billingClient;
    private final Map<String, ProductDetails> productDetailsCache = new HashMap<>();

    // Holds the pending call while the Play billing sheet is open
    private PluginCall pendingPurchaseCall = null;

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
                    call.reject("Billing setup failed: " + billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Connection dropped — JS re-calls initBilling() before next purchase
                billingClient = null;
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

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject("Could not load product information from the store.");
                return;
            }

            productDetailsCache.clear();
            JSArray products = new JSArray();

            for (ProductDetails details : productDetailsList) {
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

            JSObject ret = new JSObject();
            ret.put("products", products);
            call.resolve(ret);
        });
    }

    // ─── purchaseProduct ──────────────────────────────────────────────────────
    @PluginMethod
    public void purchaseProduct(PluginCall call) {
        if (!isBillingReady(call)) return;

        String productId = call.getString("productId");
        if (productId == null || productId.isEmpty()) {
            call.reject("Missing productId");
            return;
        }

        ProductDetails details = productDetailsCache.get(productId);
        if (details == null) {
            call.reject("Product not found. Call queryProducts first.");
            return;
        }

        if (details.getOneTimePurchaseOfferDetails() == null) {
            call.reject("Product offer details unavailable.");
            return;
        }

        pendingPurchaseCall = call;
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
            pendingPurchaseCall = null;
            call.setKeepAlive(false);
            call.reject("Could not open the purchase screen. Please try again.");
        }
    }

    // ─── PurchasesUpdatedListener ─────────────────────────────────────────────
    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;

        int code = billingResult.getResponseCode();

        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            if (call != null) {
                call.setKeepAlive(false);
                call.reject("USER_CANCELED");
            }
            return;
        }

        if (code != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            if (call != null) {
                call.setKeepAlive(false);
                call.reject("Purchase failed. Please try again.");
            }
            return;
        }

        Purchase purchase = purchases.get(0);

        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            if (call != null) {
                call.setKeepAlive(false);
                call.reject("Purchase pending. It will unlock once payment clears.");
            }
            return;
        }

        acknowledgePurchaseAndResolve(purchase, call);
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
                call.reject("Could not restore purchases. Please try again.");
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
            call.reject("Missing purchaseToken");
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
                call.reject("Acknowledgment failed. Purchase is still valid.");
            }
        });
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private void acknowledgePurchaseAndResolve(Purchase purchase, PluginCall call) {
        if (purchase.isAcknowledged()) {
            if (call != null) {
                call.setKeepAlive(false);
                resolveSuccessfulPurchase(purchase, call);
            }
            return;
        }

        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();

        billingClient.acknowledgePurchase(params, billingResult -> {
            if (call == null) return;
            call.setKeepAlive(false);
            // Always resolve — money was charged regardless of acknowledgment outcome.
            // Unacknowledged purchases are retried on next queryPurchases.
            resolveSuccessfulPurchase(purchase, call);
        });
    }

    private void resolveSuccessfulPurchase(Purchase purchase, PluginCall call) {
        JSArray productIds = new JSArray();
        for (String id : purchase.getProducts()) {
            productIds.put(id);
        }
        JSObject ret = new JSObject();
        ret.put("productIds",    productIds);
        ret.put("purchaseToken", purchase.getPurchaseToken());
        ret.put("acknowledged",  true);
        call.resolve(ret);
    }

    private void acknowledgeQuietly(Purchase purchase) {
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        billingClient.acknowledgePurchase(params, result -> {});
    }

    private boolean isBillingReady(PluginCall call) {
        if (billingClient == null || !billingClient.isReady()) {
            call.reject("Billing not initialized. Call initBilling first.");
            return false;
        }
        return true;
    }
}
