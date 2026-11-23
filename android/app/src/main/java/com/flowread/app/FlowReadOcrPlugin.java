package com.flowread.app;

import android.graphics.Bitmap;
import android.graphics.Rect;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSArray;
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
 * detectText({ base64Image, script?: 'latin'|'devanagari' })
 *   -> { text, script, blockCount, width, height, lines: [{ text, left, top, right, bottom }] }
 *
 * The per-line boxes are what let the parser infer paragraph structure the way
 * pdf.js does from PDF geometry: a line indented past the body margin starts a
 * paragraph, and so does one following a line that stopped short of the right
 * margin. ML Kit computes them anyway; returning only the concatenated text
 * threw them away and left every scanned book with guessed paragraphs.
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

        final int imageWidth = bitmap.getWidth();
        final int imageHeight = bitmap.getHeight();

        recognizer.process(image)
            .addOnSuccessListener(visionText -> {
                JSObject ret = new JSObject();
                ret.put("text", visionText.getText());
                ret.put("script", script);
                ret.put("blockCount", visionText.getTextBlocks().size());
                /* Pixel sizes travel with the boxes: a page re-rendered at the
                   hi-res fallback has different coordinates for the same layout,
                   so the parser normalises against these rather than assuming
                   one scale for the document. */
                ret.put("width", imageWidth);
                ret.put("height", imageHeight);

                /* Block order, which is the order getText() concatenates in --
                   so lines joined by newline reproduce `text`. */
                JSArray lines = new JSArray();
                for (Text.TextBlock block : visionText.getTextBlocks()) {
                    if (block == null || block.getLines() == null) continue;
                    for (Text.Line line : block.getLines()) {
                        if (line == null) continue;
                        JSObject entry = new JSObject();
                        entry.put("text", line.getText());
                        Rect box = line.getBoundingBox();
                        if (box != null) {
                            entry.put("left", box.left);
                            entry.put("top", box.top);
                            entry.put("right", box.right);
                            entry.put("bottom", box.bottom);
                        }
                        lines.put(entry);
                    }
                }
                ret.put("lines", lines);
                call.resolve(ret);
            })
            .addOnFailureListener(e -> call.reject("OCR failed: " + e.getMessage(), e));
    }
}
