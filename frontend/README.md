# Sherwood Partners M&A Platform

An embeddable M&A marketplace module for investment banks and M&A advisors. Integrates into any website like Ghost.io with secure deal workflows, NDA management, and anonymization.

## 🎯 Key Features

- 🔒 **Role-Based Access**: Buyer/Editor/Admin roles with granular permissions
- 🎭 **Anonymization**: Hide company identity until NDA signed
- 🌐 **Website Scraping**: Auto-fill listing data from company websites (Firecrawl)
- 📁 **Secure Data Rooms**: NDA-gated document access (Papermark-ready)
- 🔗 **Multi-Visibility**: Public marketplace, private share links, unlisted drafts

## 🚀 Quick Start

1. Sign in at `/auth`
2. Assign admin role in Cloud backend (see docs)
3. Create listing at `/admin/create`
4. Enter website URL → Click "Scrape Website" → Auto-fills data
5. Toggle "Anonymize Listing" to hide company name until NDA
6. Choose visibility and publish

## 📦 Tech Stack

React 18 • TypeScript • Tailwind • Lovable Cloud (Supabase) • Firecrawl

## 📖 Documentation

See `/docs` folder for complete architecture, API specs, and integration guides.

## How can I edit this code?

Visit [Lovable Project](https://lovable.dev/projects/ece0beec-5112-46ec-8b94-834eb98d6d36) or clone locally with `git clone` → `npm i` → `npm run dev`

## Deploy

Click **Publish** in Lovable or see [deployment docs](https://docs.lovable.dev/features/custom-domain).
