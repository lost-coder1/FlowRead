# FlowRead R8 configuration.
#
# Play Console flags "DEX code optimization is below our threshold" when R8 is
# off: with minifyEnabled false the only obfuscated bytes in the APK are the
# ones that arrived pre-obfuscated inside third-party AARs, which is where the
# reported 1% came from. None of it was ours.
#
# Built against proguard-android-optimize.txt, NOT proguard-android.txt -- the
# latter contains -dontoptimize, which would leave Play's Optimization category
# at zero while fixing Obfuscation. capacitor-android itself uses the optimize
# variant (its build.gradle:56), so this matches the library we are built on.
#
# What is already handled elsewhere, and must not be duplicated here:
#   - Capacitor plugins. capacitor-android declares consumerProguardFiles
#     (build.gradle:50), so its "-keep public class * extends
#     com.getcapacitor.Plugin { *; }" reaches this build and covers all four
#     FlowRead* plugins and their @PluginMethod members.
#   - MainActivity, FlowReadNudgeService and the FileProvider. AGP generates
#     keep rules from the merged manifest for every declared component.
#   - ML Kit and Play Billing, which ship their own consumer rules.

# Readable crash reports. Without these a Play vitals stack trace is a list of
# a.b.c() with no line numbers, which costs more than the few KB it saves.
# SourceFile is renamed rather than kept so the original file names still do
# not ship.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Generic signatures and annotations. Gson arrives via @capacitor/camera and
# resolves types reflectively; erased signatures turn that into runtime
# failures that only appear in a minified build.
-keepattributes Signature,*Annotation*,InnerClasses,EnclosingMethod

# NudgeGate is reached only by direct calls from the service, the plugin and
# MainActivity, so it is free to be renamed -- but it is the one class whose
# breakage would be silent rather than loud (the gate would simply stop
# deciding to nudge), so its method names are kept to make any stack trace
# from it legible.
-keepnames class com.flowread.app.NudgeGate

# The accessibility service is instantiated by the system from the manifest
# name. AGP's generated rules cover the class; this keeps the lifecycle
# methods the framework calls reflectively on some OEM builds.
-keepclassmembers class com.flowread.app.FlowReadNudgeService {
    public <init>(...);
    public void onAccessibilityEvent(...);
    public void onServiceConnected();
    public void onInterrupt();
}

# Resource shrinking is deliberately NOT enabled alongside this.
# notifications.js passes smallIcon: 'ic_stat_notify' as a string, which the
# LocalNotifications plugin resolves by name at runtime. No Java code
# references R.drawable.ic_stat_notify, so the shrinker would consider it
# unused and strip it, and reading reminders would lose their icon. Enabling it
# later needs a res/raw/keep.xml naming that drawable first.
