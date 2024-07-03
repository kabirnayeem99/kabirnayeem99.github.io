---
title: "আল হাদিস (Flutter)"
description: "One of the most, if not the most popular Hadith App in Bangladesh."
date: "September 2023"
demoURL: "https://play.google.com/store/apps/details?id=com.ihadis.ihadis&hl=en"
techStack: "Flutter, Firebase, Google Drive API"
---

<div style="display: flex; justify-content: space-between;">
    <img src="/al-hadith/al-hadith-1.webp" alt="App Screenshot 1" style="width: 30%; margin-right: 10px;" />
    <img src="/al-hadith/al-hadith-2.webp" alt="App Screenshot 2" style="width: 30%; margin-right: 10px;" />
    <img src="/al-hadith/al-hadith-6.webp" alt="App Screenshot 3" style="width: 30%; margin-right: 10px;" />
</div>

Al-Hadith (আল হাদিস) stands as one of the most popular Islamic apps in Bangladesh, pioneering the digitalization of Islamic texts in Bangla. It serves as a comprehensive collection of Hadiths of Prophet Muhammad (ﷺ), encompassing over 49,000 Hadiths from the most accepted and authentic Hadith books.

## 📈 Contribution Summary

- ✅ Kept maintaining the legacy Android application, written in Java, before migrating to Flutter.
- ✅ Rewritten the application in Flutter adhering to clean code principles.
- ✅ Ensured smooth user experience with amazing rendering performance and slick animations.
- ✅ Made use of Drift ORM, and GetX state management.

## 🚀 Features

- ✅ 49000+ Ahadith from the Sunnah
- ✅ Hadith grade (Sahih, Hasan, Daif, etc.)
- ✅ Search any word (partial or exact word) - Powerful search engine
- ✅ Adjustable font size for both Arabic and translation (Pinch zoom feature)
- ✅ Share option with ability to share images lets one distribute beautiful Hadiths with loved ones.
- ✅ No Ads
- ✅ Add/Remove Bookmarks/Favorites with online sync via Google Drive
- ✅ Start reading from where you left off (last read)
- ✅ Super quick response & Database load
- ✅ Multiple View Modes: List view and Page mode
- ✅ Inclusion of chapters in some books

## 🛠️ Tech Stack

### Architecture and Database

- **Clean Architecture**: Organizes code into layers for separation of concerns, making it easier to maintain and test.
- **Drift (SQL ORM Library)**: Drift is a powerful and reactive persistence library for Flutter and Dart, designed atop SQLite.
- **SQLite**: Embedded relational database management system, used locally for storing and querying structured data efficiently.

### Frontend Framework

- **Flutter**: Google's UI toolkit for building natively compiled applications for mobile, web, and desktop from a single codebase. Offers expressive and flexible UI components.

### State Management

- **GetX**: Lightweight and powerful state management solution for Flutter, providing dependency injection, route management, and more.

### Backend Services

- **Firebase FCM (Firebase Cloud Messaging)**: Enables reliable delivery of notifications across platforms, keeping users engaged with timely updates.
- **Firestore**: Flexible, scalable database for mobile, web, and server development, facilitating real-time syncing and offline data access.

### Rationale

- **Flutter**: Enabled us to offer both iOS and Android apps from a single codebase, both of which needed a long overdue update.
- **Drift**: Drift was chosen for its robust features tailored for Flutter and Dart, including type-safe code generation that enhances reliability by catching errors at compile time. Its reactive data handling capabilities, which convert SQL queries into auto-updating streams, facilitate seamless real-time data updates, ensuring a responsive user interface.
- **Clean Architecture**: Ensures separation of concerns, making the application more modular and easier to maintain, test, and scale.
- **GetX**: Provides efficient state management and navigation management, reducing boilerplate.

## 📲 Download

[<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Google_Play_Store_badge_EN.svg/240px-Google_Play_Store_badge_EN.svg.png" height="60">](https://play.google.com/store/apps/details?id=com.ihadis.ihadis&hl=en)
&nbsp;&nbsp;
[<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Download_on_the_App_Store_Badge.svg/240px-Download_on_the_App_Store_Badge.svg.png" height="60">](https://apps.apple.com/us/app/al-hadith-24-hadith-books/id1238182914)
