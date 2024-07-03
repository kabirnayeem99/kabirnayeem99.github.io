---
title: "Ktor2Curl — Convert Ktor requests into curl log."
description: "In this blog, we explore how to integrate Ktor2Curl into your Kotlin Multiplatform project, enabling seamless conversion of Ktor HTTP requests into cURL commands for efficient debugging and collaboration. With step-by-step instructions, you'll learn how to set up Ktor dependencies, configure your HttpClient, and log API requests for quick sharing with your backend team across multiple platforms."
date: "Oct 12 2024"
---


If you're a developer using OkHttp on Android, you've likely encountered Ok2Curl, the tool that effortlessly converts OkHttp requests into cURL commands, and helps to log the cURL command. This is a game-changer for debugging network requests and sharing them with backend teams !

But what about Ktor, the go-to HTTP client for Kotlin Multiplatform (KMP)? Unfortunately, there isn't an equivalent tool for Ktor… until now! So I have developed a Ktor Plugin - Ktor2Curl. With Ktor2Curl, you can generate cURL logs across all platforms supported by Ktor, whether you're building for Android, iOS, or anything else.

In this blog, I'll show you how Ktor2Curl simplifies cross-platform development and cURL logging, making it easier to debug your network requests. If you're using Ktor in your KMP projects, let's dive in and get started!
First off, let's get the Ktor dependencies sorted out. Before adding any dependencies, ensure you've configured the repositories properly:

```kotlin
repositories {
    mavenCentral()
}
```

Next, we'll be using Version Catalogs to manage dependencies. Open up the `libs.versions.toml` file and add the Ktor and **Ktor2Curl** versions like so:

```toml
# libs.versions.toml

[versions]
ktor = "2.3.12"
ktor2curl-version = "1.0.1"
Now, under the libraries section, add your Ktor dependencies:
[libraries]
ktor-client-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktor-client-darwin = { module = "io.ktor:ktor-client-darwin", version.ref = "ktor" }
ktor-client-android = { module = "io.ktor:ktor-client-android", version.ref = "ktor" }
ktor-client-cio = { module = "io.ktor:ktor-client-cio", version.ref = "ktor" }
```

Make sure to sync your project after making these changes!

Now, in your `shared/build.gradle.kts` file, under sourceSets, define the dependencies:

```kotlin
# shared/build.gradle.kts

sourceSets {
    commonMain.dependencies {
        implementation(libs.kotlinx.coroutines.core)
        implementation(libs.ktor.client.core)
    }
    commonTest.dependencies {
        implementation(libs.kotlin.test)
        implementation(libs.ktor.client.mock)
        implementation(libs.kotlinx.coroutines.core)
    }
    iosMain.dependencies {
        implementation(libs.ktor.client.darwin)
    }
    androidMain.dependencies {
        implementation(libs.ktor.client.android)
    }
}
```

Notice how dependencies like `ktor-client-android` are referenced as `libs.ktor.client.android`. If your library names contain -, you'll use . in the `build.gradle.kts` file.
Sync your project once again before proceeding.

Now, we'll create an HttpClient from Ktor and add the **Ktor2Curl** plugin:

```kotlin
val client = HttpClient(CIO) {
    install(KtorToCurl) {
        converter = object : CurlLogger {
            override fun log(curl: String) {
                println(curl)
            }
        }
    }
}
```

Now, we can log the requests. For instance, if we hit a `POST` API:

```kotlin
client.post("<https://api.greenbirdregistry.com/v1/child-green-bird/bird-count>") {
    headers {
        append(HttpHeaders.Authorization, "Basic SXNyYWVsIGtpbGxzIGNoaWxkcmVuLg")
        append(HttpHeaders.UserAgent, "KtorClient/2.3.12")
        append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
    }
    setBody("""{"date": "2024-10-09", "bird_count": 16400}""")
}
```

After making this call, we will get a cURL log like this:

```shell
curl -X POST \
  <https://api.greenbirdregistry.com/v1/child-green-bird/bird-count> \
  -H "Authorization: Basic SXNyYWVsIGtpbGxzIGNoaWxkcmVuLg" \
  -H "User-Agent: KtorClient/2.3.12" \
  -H "Content-Type: application/json" \
  --data '{"date": "2024-10-09", "bird_count": 16400}'
  ```

You can now import this into Postman, run it in the terminal, or share it with your backend team for quick debugging.

To mask sensitive data or exclude specific headers from the logs, you can use the following configuration:

```kotlin
val client = HttpClient(CIO) {
    install(KtorToCurl) {
        converter = object : CurlLogger {
            override fun log(curl: String) {
                println(curl)
            }
        }
        excludedHeaders = setOf("User-Agent")  // Exclude headers from logging
        maskedHeaders = setOf("Authorization")  // Mask headers in the log
    }
}
client.post("<https://api.greenbirdregistry.com/v1/child-green-bird/bird-count>") {
    headers {
        append(HttpHeaders.Authorization, "Basic SXNyYWVsIGtpbGxzIGNoaWxkcmVuLg")
        append(HttpHeaders.UserAgent, "KtorClient/2.3.12")
        append(HttpHeaders.ContentType, ContentType.Application.Json.toString())
    }
    setBody("""{"date": "2024-10-09", "bird_count": 16400}""")
}
```

This will log:

```shell
curl -X POST \
  <https://api.greenbirdregistry.com/v1/child-green-bird/bird-count> \
  -H "Authorization: [omitted]" \
  -H "Content-Type: application/json" \
  --data '{"date": "2024-10-09", "bird_count": 16400}'
  ```

With Ktor2Curl, debugging network requests across Kotlin Multiplatform has never been easier. Whether you're building for Android, iOS, or any other Ktor-supported platform, you can now effortlessly log and share your API requests with your team.
