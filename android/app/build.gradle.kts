// Android wrapper module for صَرفي / Sarfi (reference implementation).
// The web app in this repository uses the equivalent browser APIs:
//   • navigator.permissions + getUserMedia  ->  Accompanist Permissions
//   • Web Speech API (SpeechRecognition)    ->  android.speech.SpeechRecognizer
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.abuomar.sarfi"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.abuomar.sarfi"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        // Arabic (Syria) is the primary locale; English is bundled too.
        resourceConfigurations += listOf("ar", "en")
    }

    buildFeatures { compose = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    val accompanist = "0.36.0"

    // --- Microphone permission (Accompanist Permissions) ---
    implementation("com.google.accompanist:accompanist-permissions:$accompanist")

    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
