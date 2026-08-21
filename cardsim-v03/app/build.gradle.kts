// VOX Card Sim V1.1.0 — import universel, hors-ligne persistant et grading physique
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
        versionCode = 36
        versionName = "1.1.0"
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

    // WorkManager persiste les téléchargements hors ligne lorsque l'écran est éteint
    // ou que l'Activity n'est plus au premier plan. Son API Java publique expose
    // ListenableFuture : la dépendance légère ci-dessous rend ce contrat explicite
    // au compilateur sans embarquer l'implémentation Guava complète.
    implementation("androidx.work:work-runtime:2.10.1")
    implementation("com.google.guava:listenablefuture:1.0")
}
