// VOX CardSim V0.9.1 validation build
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
        versionCode = 24
        versionName = "0.9.1"
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
}
