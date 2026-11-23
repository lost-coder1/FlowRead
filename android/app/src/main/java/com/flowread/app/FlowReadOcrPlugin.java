package com.flowread.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Multi-script OCR plugin.
 * detectText({ base64Image, script?: 'latin'|'devanagari' }) -> { text, blocks: [...] }
 *
 * Why custom: the only published Capacitor 6 ML Kit text plugin hardcodes the Latin
 * recognizer, which silently drops Devanagari (Hindi) characters. Real users on this
 * app test with Hindi PDFs, so we ship both scripts and let the JS layer pick or fall
 * back. Adding more scripts later is a one-dependency + one-case change.
 */
@CapacitorPlugin(name = "FlowReadOcr")
public class FlowReadOcrPlugin extends Plugin {

    /* One recognizer per script, built once and kept.
       TextRecognition.getClient() is not free — it resolves the model pipeline on
       every call — and a 100-page scan was building (and leaking) one per page per
       script. process() is safe to call repeatedly on a single client. */
    private TextRecognizer latinRecognizer;
    private TextRecognizer devanagariRecognizer;

    private synchronized TextRecognizer recognizerFor(String script) {
        if ("devanagari".equalsIgnoreCase(script)) {
            if (devanagariRecognizer == null) {
                devanagariRecognizer = TextRecognition.getClient(
                        new DevanagariTextRecognizerOptions.Builder().build());
            }
            return devanagariRecognizer;
        }
        if (latinRecognizer == null) {
            latinRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        }
        return latinRecognizer;
    }

    @Override
    protected void handleOnDestroy() {
        if (latinRecognizer != null) { latinRecognizer.close(); latinRecognizer = null; }
        if (devanagariRecognizer != null) { devanagariRecognizer.close(); devanagariRecognizer = null; }
    }

    @PluginMethod
    public void detectText(PluginCall call) {
        String encodedImage = call.getString("base64Image");
        if (encodedImage == null) {
            call.reject("No image is given");
            return;
        }
        String script = call.getString("script", "latin");
        int rotation = call.getInt("rotation", 0);

        Bitmap bitmap;
        try {
            byte[] bytes = Base64.decode(encodedImage, Base64.DEFAULT);
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException e) {
            call.reject("Base64 decode failed: " + e.getMessage());
            return;
        }
        if (bitmap == null) {
            call.reject("Bitmap decode returned null — unsupported image format");
            return;
        }

        InputImage image = InputImage.fromBitmap(bitmap, rotation);
        TextRecognizer recognizer = recognizerFor(script);

        recognizer.process(image)
            .addOnSuccessListener(visionText -> {
                JSObject ret = new JSObject();
                ret.put("text", visionText.getText());
                ret.put("script", script);
                ret.put("blockCount", visionText.getTextBlocks().size());
                call.resolve(ret);
            })
            .addOnFailureListener(e -> call.reject("OCR failed: " + e.getMessage(), e));
    }
}
