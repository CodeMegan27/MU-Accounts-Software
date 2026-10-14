# MU Accounts - Enterprise Cloud ERP & GST Accounting

A modern, fast, and secure Enterprise Cloud Accounting, Billing, and ERP web application built with React, Tailwind CSS, and Firebase Firestore.

## 🚀 Key Features

- **Multi-Tenant Workspace Isolation**: Independent company workspaces with isolated collections in Cloud Firestore and scoped local storage.
- **Enterprise Dynamic Masters**:
  - Branch & Department Master management.
  - Expense & Payment Method configuration.
  - Custom category hierarchies with usage tracking.
- **Tier-Based Subscription Enforcement**:
  - **Free Tier (Trial)**: 1 Branch, 1 Department, up to 20 Vendors, up to 50 Products, core purchase & sales entries.
  - **Basic Tier**: 3 Branches, 5 Departments, up to 50 Vendors, 150 Products, Recycle Bin, GST Reports, Activity Log, Custom App Name & Logo.
  - **Pro Tier**: All Basic features + Unsaved Drafts recovery, Import/Export, scheduled reports, up to 200 Vendors & 500 Products.
  - **Premium Tier**: Unlimited Branches & Departments, full analytics suite, AI Assistant, 24/7 priority workflow.
- **Security & Authentication**:
  - Resend Cloud Email OTP verification for account creation and secure passwordless login.
  - Role-based access control (Admin, MD, Sales, Purchase, Accountant).
  - 6-digit PIN protection for sensitive company profile & security configurations.
- **Developer Hub**:
  - Dedicated Developer Portal (`meganfullsd@gmail.com`) for tracking bugs, live updates, and system diagnostics.
- **Billing & GST Compliance**:
  - Real-time tax separation (CGST / SGST / IGST).
  - GSTR-1, GSTR-3B summary generation with automated reconciliation.
  - Thermal, Standard, and Compact invoice printing with customizable branding.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 6, Tailwind CSS, Lucide Icons, Chart.js
- **Backend / Database**: Firebase Firestore, Firebase Authentication
- **Email Service**: Resend API
- **PDF & Export**: jsPDF, html2canvas, SheetJS (xlsx)

## 📦 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/mu-accounts.git
   cd mu-accounts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   ```bash
   cp .env.example .env
   ```
   Add your Resend API key to `.env` if using cloud email OTP delivery.

4. Start development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## 🔒 Privacy & Data Isolation

All business records, vouchers, transactions, and company configurations are stored per-tenant and strictly isolated. This repository contains only the pure application source code and clean default master templates.

## 📄 License

Proprietary - Developed for MU Accounts.
