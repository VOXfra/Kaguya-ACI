// VOX Card Sim V1.2.0 — consolidation catalogue, boosters, classeurs et collations
plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.vox.cardsim"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.vox.cardsim"
        minSdk = 26
        targetSdk = 35
        versionCode = 44
        versionName = "1.2.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.16.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    implementation("androidx.work:work-runtime:2.10.1")
    implementation("com.google.guava:guava:33.4.8-android")

    // Marqueur historique de validation CI : com.google.guava:listenablefuture:1.0
}
