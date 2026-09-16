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
import com.google.mlkit.vision.text.TextRecognizerOptionsInterface;
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

        TextRecognizerOptionsInterface options;
        if ("devanagari".equalsIgnoreCase(script)) {
            options = new DevanagariTextRecognizerOptions.Builder().build();
        } else {
            options = TextRecognizerOptions.DEFAULT_OPTIONS;
        }

        InputImage image = InputImage.fromBitmap(bitmap, rotation);
        TextRecognizer recognizer = TextRecognition.getClient(options);

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
