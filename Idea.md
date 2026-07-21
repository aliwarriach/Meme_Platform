# Project Summary — Meme Creation & Sharing Platform

## 🧠 Core Idea
A **mobile-first, community-focused** meme creation and sharing platform that serves as the ultimate hub for memers.

**Key Focus Areas:**
- ⚡ Fast and intuitive meme creation
- 🧠 AI-assisted humor and captioning
- 🏘️ **Communities** — join/create groups, community-only templates, community feeds
- ⚔️ **Community challenges** — teams within a community, or community vs. community, competing on meme quality
- 🏆 Individual + Community leaderboards, scored by a defined meme-scoring rule set
- 📤 Seamless cross-platform sharing
- 💬 Lightweight social features (friends, meme sending)

**Product Positioning**  
“A high-speed meme creation engine with AI humor assistance, community-driven competition, and smart integration with existing platforms like Instagram.”

Casual users can stick to the public feed and just have fun creating/sharing. But the platform is **built around communities**: joining one, posting for it, competing in challenges, and climbing the community + individual leaderboards is meant to be the core, retained experience — the feed is the on-ramp, communities are the destination.

It is **not** a full social network, but a powerful **creation + distribution + competition tool** for meme enthusiasts and the communities they belong to.

## 🎯 Key Differentiators
- Native mobile app experience (downloadable APK + future iOS)
- Advanced creator tools with templates and AI
- **Communities with private template libraries** and their own feeds
- **Community challenges** (team vs. team inside a community, or community vs. community) with rule-based judging and rewards
- Individual + community competitions (Meme of the Day / Week / Month, plus challenge-driven leaderboards)
- **Instagram Companion Mode**

## 🧱 Tech Stack

### 📱 Frontend
- React Native + Expo (for native Android APK and iOS)
- State Management: Zustand (lightweight) or Redux Toolkit
- Data Fetching: TanStack Query
- Styling: NativeWind / StyleSheet + Tailwind

### ⚙️ Backend
- FastAPI (Python) — Async, high performance
- Authentication: JWT
- WebSockets (via FastAPI or Socket.IO) for real-time meme sending

### 🗄️ Infrastructure
- PostgreSQL (core database)
- Redis (caching + real-time features)
- Cloudinary or AWS S3 (media storage)

### 🤖 AI Integration
- Groq / OpenAI compatible LLMs
- Use cases: caption generation, joke writing, “make it funnier” iterations

## 🚀 MVP Scope

### 🥇 Core Features (Must Build)
1. **Meme Feed**
   - Infinite scroll
   - Image/video memes
   - Reactions & likes

2. **Communities**
   - Create or join a community
   - Community feed, separate from the public feed
   - **Community-private meme templates** — uploaded by members, usable only inside that community, invisible to non-members
   - Community score, aggregated from the meme scores its members produce

3. **Meme Creator**
   - Upload image from camera/gallery
   - Text overlays (top/bottom + custom positioning)
   - Preview, save & publish
   - **Audience selection at publish time**: Friends, Public feed, and/or one or more Communities — not mutually exclusive, user picks explicitly

4. **Meme Scoring System**
   - A defined, rule-based score computed per meme (reactions/votes/comments + challenge-specific judging where relevant)
   - Powers individual leaderboard, community leaderboard, and challenge results — one scoring engine, reused everywhere

5. **Leaderboards**
   - Individual leaderboard — highest meme score
   - Community leaderboard — highest community score

6. **Voting System**
   - Meme of the Day / Week / Month competitions (public feed level)
   - One vote per user per period
   - Leaderboard

7. **Sharing System**
   - Native share sheet (WhatsApp, Instagram, X, etc.)
   - Export as image/video

### 🥈 Enhanced Features
8. **Community Challenges**
   - **Intra-community team challenge**: members split into sides (e.g. 5 vs 5), each side posts memes within a set time window under a defined rule set; evaluated at the end; winning side may earn prizes/rewards
   - **Community vs. community challenge**: same structure, scoped across two communities competing on "whose memes are better"
   - Full lifecycle: setup (participants, rules, time window, rewards) → active submission window → evaluation (via the meme scoring system, optionally with judge/member voting) → results, rewards, and leaderboard updates

9. **Template Library**
   - Pre-loaded popular templates (global, public)
   - User-generated templates with text area definitions — submittable to the global library or to a specific community's private library

10. **AI Joke & Caption Generator**
    - Input context/situation → generate funny captions
    - Iterative improvement option

11. **Meme Sending (Real-time)**
    - Send memes to friends via WebSockets
    - Lightweight inbox for received memes
    - Reactions only (no full chat)

## 📱 Instagram Integration (Companion Mode)

**Concept**: Turn your app into a smart companion for Instagram Reels and posts.

**How it works**:
- User shares a Reel from Instagram to your app (via native share sheet)
- App creates a **MemeContainer** wrapper in the database:
  - Stores original Instagram link
  - Thumbnail/preview
  - Metadata
  - Internal engagement data (reactions, comments, votes)

**User Flows**:
- **Post to Feed**: The Reel appears in your platform’s feed as a container
- **Send to Friend**: Real-time delivery via WebSockets
- **Viewing**: Display the Reel inside the app (WebView or video player)
- **Reactions**: Users react/comment **inside your app** — all data stored on your `MemeContainer`
- **Actions**: “Open Original” button redirects to Instagram for full interaction

**Benefits**:
- External content (Instagram Reels) can participate in your **Meme of the Day/Week** competitions
- Users get centralized reactions and discovery across platforms
- Your platform owns engagement analytics while respecting source platforms

**Technical Notes**:
- Rely on shared URLs (not full video downloads)
- Store reactions independently in your database
- Use WebView for reliable Reel playback

## 🧩 Additional Systems

### 👤 User System
- JWT Authentication
- Basic profiles
- Friends (separate relationship from community membership)

### 🖼️ Meme System
- Native uploads + external containers
- Metadata storage
- Per-post audience: Friends / Public / Community (multi-select)

### ❤️ Interaction System
- Likes / Multi-reactions
- Comments on posts and containers (feed, community, and `MemeContainer` alike)
- Feeds into the meme scoring system

### 🏘️ Community System
- Create/join communities, community feed, community-private templates
- Community score, driven by the meme scoring system
- Community leaderboard

### ⚔️ Challenge System
- Intra-community team challenges and community-vs-community challenges
- Configurable rule sets, time-boxed submission windows, rule-based evaluation
- Rewards/prizes for winners

### 🏆 Scoring & Leaderboards
- Rule-based meme scoring engine (shared across feed, communities, and challenges)
- Individual leaderboard + Community leaderboard
- Meme of the Day/Week/Month competitions at the public feed level

## 🎯 Success Metrics for MVP
- Smooth meme creation flow
- Working share-from-Instagram feature
- Functional real-time meme sending
- Engaging voting/leaderboard system (individual + community)
- Communities feel alive: active membership, community-private templates in use, at least one full challenge lifecycle completed end-to-end
- Polished native mobile experience (Android APK ready)

---

See `Project_Requirements.md` for the detailed, numbered functional-requirements breakdown of everything above (including open questions still to be settled, e.g. exact scoring weights and challenge judging model).