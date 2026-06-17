# Power Guide Survival Assistant ⚡

> A Smart Blackout Management System that helps communities stay informed, prepared, and connected during power outages through crowdsourced reporting, battery management, charging station discovery, and real-time outage monitoring.

![PHP](https://img.shields.io/badge/PHP-Backend-blue)
![MySQL](https://img.shields.io/badge/MySQL-Database-orange)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Frontend-06B6D4)
![JWT](https://img.shields.io/badge/JWT-Authentication-green)
![Google OAuth](https://img.shields.io/badge/Google-OAuth-red)

---

## 📌 Project Overview

Power Guide Survival Assistant is a web-based emergency assistance platform designed to support residents during electricity outages. The system enables users to report, monitor, and verify power outages through a crowdsourced reporting mechanism while providing valuable resources such as charging station locations, battery-saving recommendations, maintenance schedules, and hazard reporting.

The platform integrates secure authentication using Google OAuth and JSON Web Tokens (JWT), ensuring secure user access and data management. Location-based services are powered by Geoapify, while outage data is collected and distributed through a dedicated Crowdsourced API.

The current implementation focuses on power outage monitoring and reporting within **Dagupan City, Philippines**.

---

## 👨‍💻 Development Team

### Members

* Luigi B. Barte
* Walter Jr. F. Ballesteros
* Don Rudyrick L. Barberan
* Christian A. Blanco
* Noerly Yvonne Mae G. Idos
* Angela G. Martin

---

## 🚀 Key Features

### 🔌 Outage Reporting System

* Submit power outage reports in real-time.
* Monitor ongoing and resolved outages.
* Community-driven reporting within Dagupan City.

### 👥 Crowdsourced Outage Monitoring

* View reports submitted by other users.
* Access real-time outage updates.
* Improve outage awareness through community participation.

### 🔋 Battery Usage Tracker

* Monitor device battery percentage.
* Track battery consumption during emergencies.
* Receive battery-related recommendations.

### 💡 Smart Power-Saving Tips

* Personalized battery conservation suggestions.
* Emergency preparedness guidance.
* Recommendations based on current battery level.

### 📍 Charging Station Finder

* Locate nearby charging stations.
* Allow users to contribute charging station locations.
* Share available power sources with the community.

### 🛠 Maintenance Schedule Monitoring

* Display scheduled power interruptions.
* Provide restoration estimates when available.
* Notify affected users of upcoming maintenance activities.

### ✅ Outage Verification System

* Allow electrical companies to verify outage reports.
* Mark incidents as resolved.
* Improve report accuracy and reliability.

### ⚠ Hazard Reporting

Users can report electrical hazards, including:

* Fallen power lines
* Electrical sparks
* Smoke incidents
* Fire hazards
* Other safety concerns related to power infrastructure

### 📊 User Dashboard

* Interactive outage map
* Active outage monitoring
* Charging station locations
* Maintenance schedules
* User notifications and alerts

### 🔔 Smart Notifications

* Nearby outage alerts
* Scheduled maintenance reminders
* Low battery notifications
* Restoration updates

### 🔐 Secure Authentication

* Google OAuth integration
* JWT-based authentication
* Protected user sessions
* Secure API access

---

## 🏗 Technology Stack

### Frontend

* HTML5
* CSS3
* JavaScript
* Tailwind CSS

### Backend

* PHP
* RESTful API Architecture

### Database

* MySQL

### Authentication & Security

* Google OAuth
* JSON Web Tokens (JWT)
* phpdotenv
* firebase/php-jwt

### APIs & Services

* Geoapify API (Maps, Geolocation, Routing)
* CrowdsourcedAPI (Custom Outage Reporting API)

---

## 🔗 Repositories

### Main System

PowerGuides Repository

https://github.com/Luigibarte4563/PowerGuides

### Crowdsourced API

Custom API Repository

https://github.com/Luigibarte4563/CrowdsourcedAPI

### CrowdsourcedAPI Responsibilities

* Collect outage reports from users
* Process community-submitted outage data
* Manage outage verification workflows
* Provide outage information to connected clients
* Support real-time outage monitoring

---

## 📦 Installation

### Clone the Repository

```bash
git clone https://github.com/Luigibarte4563/PowerGuides.git
cd PowerGuides
```

### Install Dependencies

```bash
composer install
```

### Configure Environment Variables

Create a `.env` file in the project root:

```env
DB_HOST=localhost
DB_NAME=powerguides
DB_USER=root
DB_PASS=

JWT_SECRET=your_jwt_secret

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GEOAPIFY_API_KEY=your_geoapify_api_key

CROWDSOURCED_API_URL=your_api_endpoint
```

### Run the Application

```bash
php -S localhost:8000
```

Access the application through:

```text
http://localhost:8000
```

---

## 🔒 Security Features

* JWT Authentication
* Google OAuth Login
* Protected API Endpoints
* Environment Variable Configuration
* Secure Session Management
* Input Validation and Sanitization

---

## 🎯 Project Objectives

The Power Guide Survival Assistant aims to:

* Improve public awareness during power outages.
* Deliver real-time outage information.
* Help users maximize battery life during emergencies.
* Connect communities with available charging stations.
* Strengthen communication between residents and electrical providers.
* Improve public safety through hazard reporting and outage verification.

---

## 📄 License

This project was developed as an academic capstone/project requirement and is intended for educational and research purposes.

---

## 📬 Contact

Repository Owner:

GitHub: https://github.com/Luigibarte4563

For questions, suggestions, or collaboration opportunities, please open an issue in the repository.
