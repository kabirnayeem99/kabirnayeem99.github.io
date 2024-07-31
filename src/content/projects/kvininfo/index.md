---
title: "kVinInfo (Kotlin Library for VIN processing)"
description: "Pure Kotlin Library for extracting info from VIN, validating VIN, and generating random/mocked VIN for testing."
date: "July 2024"
demoURL: "https://central.sonatype.com/artifact/io.github.kabirnayeem99/kvininfo"
techStack: "Kotlin, Kotlin Multiplatform"
---

kVINInfo is a pure Kotlin library designed to simplify tasks related to Vehicle Identification
Numbers (VINs), including simple VIN Validation, extracting information from VIN, NHTSA Database
integration to get information like Vehicle type, Make and Model.

Please, note that, This library draws inspiration from the Dart
library [vin-decoder-dart](https://github.com/adaptant-labs/vin-decoder-dart)
by [Adaptant Labs](https://github.com/adaptant-labs)
and [vindecoder.js](https://gist.github.com/kevboutin/3ac029e336fc7cafd20c05adda42ffa5)
by [Kevin Boutin](https://gist.github.com/kevboutin), so big shout out to them.

**Warning**: For more complex VIN processing, professional-grade validation, or in-depth information
extraction, consider implementing custom logic or integrating with your company specific business
logic, or country-specific databases or APIs.

## Install

This library can be installed with ease for both Kotlin Multiplatform projects and Android projects.

### Kotlin Multiplatform Projects

Add the following dependency to your commonMain source set:

```kotlin
val commonMain by getting {
    dependencies {
        implementation("io.github.kabirnayeem99:kvininfo:1.0.0")
    }
}
```

### Android Projects

Use the following dependency in your app module's build.gradle file:

#### Kotlin DSL (`build.gradle.kts`)

```kotlin
dependencies {
  // all other dependencies
  implementation("io.github.kabirnayeem99:kvininfo:1.0.0")
}
```

#### Groovy DSL (`build.gradle`)

```groovy
dependencies {
    // all other dependencies
    implementation "io.github.kabirnayeem99:kvininfo:1.0.0"
}
```

Note: Replace `1.0.0` with the latest version of the library.

## Usage

This library offers a simple API for working with VINs.

```kotlin
val vin = "WBA3A5G59DNP26082"
val vinInfo = VinInfo.fromNumber(vin)

// Access VIN information
println(vinInfo.year) // 2013
println(vinInfo.region) // Europe
println(vinInfo.manufacturer) // BMW AG

// Using the `use` scope for resource management
vinInfo.use {
    println(it.wmi) // WMI part of the VIN
    // ... other operations
}
```

For more concise and expressive code, leverage Kotlin's extension functions:

```kotlin
"WBA3A5G59DNP26082".withVinInfo {
    println(year) // 2013
    println(region) // Europe
    println(manufacturer) // BMW AG
    println(getMakeFromNhtsa())  // BMW
    println(getModelFromNhtsa())  // 328i
    // ... other operations
}
```

**Explanation**:

- The withVinInfo extension function provides a fluent-style API for working with VIN data.
- The lambda passed to withVinInfo receives the VinInfo instance as its receiver, allowing direct  access to its properties.
