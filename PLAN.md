# Fabiana - Virtual Life Assistant

## Vision
An AI life companion that proactively engages, remembers everything, and helps organize your life through natural conversation.

## Core Principles
1. **Initiative Over Reaction** - Agent starts conversations, not just responds
2. **Progressive Memory** - Hot/warm/cold memory tiers for efficient recall
3. **Self-Organizing** - Daily memory consolidation without human intervention
4. **Multi-Modal** - Chat (Telegram), scheduled prompts, reminders
5. **Human in Control** - Review checkpoints, edit memory, set boundaries

---

## Architecture Overview

Built on **pi SDK** (like pibot) with Brave Search and Google Calendar integration.

```
┌─────────────────────────────────────────────────────────────┐
│                     INTERFACES                              │
├─────────────────────────────────────────────────────────────┤
│  Telegram Bot (polling) │  Scheduled Runner (pi sessions)   │
└───────┬─────────────────┴────────────────┬──────────────────┘
        │                                  │
        │  ┌────────────────────────────┐  │
        └──┤  Telegram Message Queue    ├──┘
           │  (processed by pi agent)   │
           └────────────┬───────────────┘
                        │
              ┌─────────▼──────────┐
              │  ORCHESTRATOR      │
              │  (fabiana daemon)  │
              │                    │
              │  - pi session mgmt │
              │  - Schedule handler│
              │  - Initiative eng. │
              │  - Agent TODO list │
              └─────────┬──────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌─────▼──────┐  ┌────▼──────┐
│   MEMORY     │  │   TOOLS    │  │   DATA    │
│   SYSTEM     │  │            │  │  SOURCES  │
├──────────────┤  ├────────────┤  ├───────────┤
│- identity.md │  │- brave_search│  │- Calendar │
│- core.md     │  │- read/edit │  │  (gccli)  │
│- people/     │  │- bash      │  │- Telegram │
│- dates/      │  │- todo mgmt │  │  history  │
│- diary/      │  └────────────┘  └───────────┘
│- agent-todo/ │
└──────────────┘
```

---

## Memory System (Extended from human-context)

### Tier 1: Hot Memory (Every Session)
```
memory/
├── identity.md           # Who you are (name, role, prefs)
├── constitution.md       # Agent's rules, boundaries (read-only)
└── core.md              # Current state, active contexts
```

### Tier 2: Warm Memory (Contextual Load)
```
memory/
├── people/
│   ├── index.md         # List of people with quick refs
│   ├── family.md
│   ├── friends.md
│   ├── colleagues.md
│   └── [person-name].md # Individual profiles
├── dates/
│   ├── birthdays.md
│   ├── anniversaries.md
│   └── recurring.md     # Weekly/monthly patterns
├── interests/
│   ├── topics.md        # Things you care about
│   ├── media.md         # Books, movies, shows
│   └── goals.md         # Current life goals
└── recent/
    ├── this-week.md     # Rolling 7-day summary
    └── last-week.md     # Reference for patterns
```

### Tier 3: Cold Memory (Archive, Search Only)
```
memory/
├── diary/
│   └── 2026/
│       ├── 03-march/
│       │   ├── 13.md    # Daily entries
│       │   └── 14.md
│       └── 04-april/
├── archive/
│   ├── old-sessions.md
│   └── patterns.md      # Long-term patterns detected
└── conversations/
    └── telegram/
        └── 2026-03/     # Chat history by month
```

---

## Daily Rhythm (The Heart of Fabiana)

### Midnight Consolidation (Scheduled)
```
1. READ: Today's chat history, session logs, collected notes
2. ANALYZE: Extract facts, events, mood patterns, decisions
3. WRITE: 
   - Update people/ (new info about contacts)
   - Update dates/ (mentioned events)
   - Update interests/ (new topics, media consumed)
   - Create diary/2026/03/13.md entry
4. SUMMARIZE: Create this-week.md snapshot
5. ARCHIVE: Move old data to cold storage
6. REFLECT: Generate insight about patterns
```

### Morning Brief (Optional, Scheduled)
```
1. READ: core.md + this-week.md + today's calendar
2. PREPARE: Meeting context, birthday reminders, priorities
3. NOTIFY: Send Telegram summary or prompt for mood check
```

### Initiative Triggers (Agent Decides)
```
IF last-contact > 4 hours AND time-between(9am-9pm):
  → Send check-in: "How's the day going?"

IF meal-time (breakfast 8am, lunch 12pm, dinner 7pm):
  → Ask: "What are you having for [meal]?"

IF detected stress in messages:
  → Follow up: "You seemed stressed earlier, feeling better?"

IF upcoming birthday in 3 days:
  → Remind: "Sarah's birthday is Tuesday, any plans?"

IF weekly pattern (e.g., always tired on Mondays):
  → Note: "Monday pattern detected, adjusting expectations"
```

---

## The Initiative Engine

### How Agent Decides to Message You

```typescript
interface InitiativeCheck {
  lastInteraction: Date;
  timeOfDay: number;        // 0-23
  dayOfWeek: number;        // 0-6
  recentMood: 'positive' | 'neutral' | 'negative' | 'unknown';
  upcomingEvents: Event[];
  detectedPatterns: Pattern[];
  memoryGaps: string[];     // Things to ask about
}

function shouldInitiate(check: InitiativeCheck): boolean {
  // Don't spam
  if (hoursSince(check.lastInteraction) < 2) return false;
  
  // Respect sleep hours
  if (check.timeOfDay < 8 || check.timeOfDay > 22) return false;
  
  // Daily check-in if not talked today
  if (hoursSince(check.lastInteraction) > 12) return true;
  
  // Event-driven prompts
  if (check.upcomingEvents.some(e => e.daysUntil <= 3)) return true;
  
  // Pattern-based (e.g., always ask about gym on workout days)
  if (check.detectedPatterns.some(p => p.shouldTriggerNow())) return true;
  
  return false;
}
```

### Types of Initiative

1. **Daily Check-in** ("How's your day?")
2. **Meal Logging** ("What did you have for lunch?")
3. **Mood Tracking** ("Feeling good about the presentation?")
4. **Event Prep** ("Meeting with Sarah tomorrow, want me to prep context?")
5. **Memory Completion** ("You mentioned a new project yesterday—how's that going?")
6. **Pattern Notices** ("You've been mentioning work stress, want to talk?")
7. **Celebrations** ("It's been 30 days since you started gym! 🎉")

---

## Conversation Flow

### Example Interaction

```
[9:00 AM - Agent Initiative]
Fabiana: "Morning! Tuesday energy—how you feeling today?"

You: "Pretty good, had a solid sleep"

Fabiana: "Nice! Sleep quality's been trending up this week. 
         What's on the plate for today?"

You: "Big presentation at 2pm, then dinner with Mike"

[AGENT UPDATES: core.md ("presentation at 2pm"), 
               diary/today.md, 
               people/mike.md ("dinner plans")]

Fabiana: "Oh right, the Q2 review! You've been prepping for 
         two weeks—you got this. Mike from work or the 
         college friend?"

You: "College friend"

[AGENT UPDATES: people/mike.md relationship context]

Fabiana: "Enjoy! Last time you guys met was that Thai place 
         downtown, right? Want me to suggest alternatives?"
```

---

## Technical Implementation

### Project Structure

```
fabiana/
├── src/
│   ├── daemon/              # Main orchestrator
│   │   ├── scheduler.ts     # Cron/timer management
│   │   ├── initiative.ts    # When to initiate
│   │   └── session.ts       # Single session lifecycle
│   │
│   ├── interfaces/          # User-facing layers
│   │   ├── telegram/        # Telegram bot
│   │   │   ├── bot.ts
│   │   │   └── handlers.ts
│   │   └── cli/             # Optional TUI
│   │
│   ├── memory/              # Memory system
│   │   ├── loader.ts        # Progressive disclosure logic
│   │   ├── writer.ts        # Update/create entries
│   │   ├── consolidator.ts  # Midnight consolidation
│   │   └── search.ts        # Cold memory search
│   │
│   ├── agent/               # AI core
│   │   ├── client.ts        # LLM API client
│   │   ├── prompts/         # System prompts
│   │   │   ├── init.ts      # Initiative prompts
│   │   │   ├── chat.ts      # Conversation prompts
│   │   │   └── consolidate.ts
│   │   └── tools/           # Available actions
│   │
│   └── services/            # External integrations
│       ├── calendar.ts      # Calendar API
│       ├── reminders.ts     # Notification service
│       └── weather.ts       # Optional context
│
├── memory/                  # The skill/memory storage
│   ├── identity.md
│   ├── core.md
│   ├── people/
│   ├── dates/
│   ├── diary/
│   └── archive/
│
├── config/
│   ├── telegram.json        # Bot token, chat ID
│   ├── schedule.json        # When to run what
│   └── personality.json     # Agent voice/settings
│
├── logs/                    # Activity logs
└── package.json
```

### Key Components

#### 1. Scheduler (`src/daemon/scheduler.ts`)
```typescript
interface Schedule {
  consolidate: '0 0 * * *';      // Midnight daily
  morningBrief: '0 9 * * *';     // 9 AM (optional)
  checkIns: '0 */4 * * *';       // Every 4 hours (initiative check)
}

// Uses node-cron or similar
// Triggers daemon wake-up
```

#### 2. Progressive Memory Loader (`src/memory/loader.ts`)
```typescript
interface MemoryContext {
  hot: string[];    // Always load
  warm: string[];   // Load based on context
  cold: string[];   // Search only
}

async function loadMemory(
  sessionType: 'chat' | 'consolidate' | 'initiative',
  context?: string
): Promise<MemoryContext> {
  // Tier 1: Always
  const hot = await read(['identity.md', 'core.md', 'constitution.md']);
  
  // Tier 2: Contextual
  const warm = await loadBasedOnContext(sessionType, context);
  
  // Tier 3: Search if needed
  const cold = [];
  
  return { hot, warm, cold };
}
```

#### 3. Consolidator (`src/memory/consolidator.ts`)
```typescript
async function midnightConsolidation() {
  // 1. Gather sources
  const todayChats = await getTelegramHistory(today);
  const sessions = await getSessionLogs(today);
  
  // 2. Extract with LLM
  const extraction = await llm.extract({
    prompt: `Extract from today's interactions:
             - Events that happened
             - People mentioned (new info)
             - Mood/emotional state
             - Decisions made
             - Topics discussed
             - Food consumed
             - Work accomplished`,
    input: todayChats + sessions
  });
  
  // 3. Write to appropriate files
  await updatePeople(extraction.people);
  await createDiaryEntry(today, extraction.summary);
  await updateCoreState(extraction.currentState);
  
  // 4. Archive raw data
  await archiveToColdStorage(todayChats, sessions);
}
```

#### 4. Telegram Bot (`src/interfaces/telegram/bot.ts`)
```typescript
import { Telegraf } from 'telegraf';

class FabianaBot {
  private bot: Telegraf;
  private sessionManager: SessionManager;
  
  constructor(token: string) {
    this.bot = new Telegraf(token);
    this.setupHandlers();
  }
  
  private setupHandlers() {
    // Incoming messages
    this.bot.on('text', async (ctx) => {
      const response = await this.sessionManager.handleMessage({
        text: ctx.message.text,
        timestamp: new Date(),
        source: 'telegram'
      });
      
      await ctx.reply(response.text, {
        parse_mode: 'Markdown'
      });
    });
    
    // Commands
    this.bot.command('memory', this.showMemoryHandler);
    this.bot.command('remind', this.setReminderHandler);
    this.bot.command('quiet', this.silenceHandler);
  }
  
  // Called by initiative engine
  async sendInitiative(message: string) {
    await this.bot.telegram.sendMessage(
      this.config.chatId, 
      message,
      { parse_mode: 'Markdown' }
    );
  }
}
```

---

## Data Flow Examples

### Scenario 1: Casual Chat → Memory

```
You (Telegram): "Had lunch with Sarah at that new Italian place"
        ↓
Bot receives message
        ↓
Session Manager creates agent session
        ↓
Load Memory: identity + core + people/sarah + recent
        ↓
LLM processes with context:
  "User had lunch with Sarah (colleague/friend?) at new Italian place"
        ↓
Agent Response: "Oh nice! How was it? Sarah from work or the 
                college friend? I can add it to your food log"
        ↓
WRITE to memory:
  - diary/today.md: "Lunch with Sarah at [Italian place]"
  - people/sarah.md: "Had lunch 2026-03-13, likes Italian food"
  - Update core.md: "Last meal: Italian, Last social: Sarah"
        ↓
Send reply to Telegram
```

### Scenario 2: Initiative Trigger

```
[Scheduler wakes daemon at 2:00 PM]
        ↓
Initiative Engine checks:
  - Last contact: 5 hours ago ✓
  - Time: 2 PM (within 9-9) ✓
  - Recent mood: stressed (from morning chat) ✓
  → Trigger: "Check on stress level"
        ↓
Load Memory: identity + core + recent
        ↓
LLM generates message:
  "Hey, you seemed stressed about the presentation this morning.
   How did it go? Hope you're breathing easier now 🌬️"
        ↓
Send Telegram message
        ↓
Log: initiative-sent, reason: stress-follow-up
```

### Scenario 3: Midnight Consolidation

```
[00:00 - Cron triggers]
        ↓
Consolidator runs
        ↓
READ: All Telegram chats from today
READ: All session logs from today
        ↓
LLM extraction:
  Events: ["lunch with Sarah", "presentation at 2pm"]
  People updates: [{name: "sarah", info: "likes Italian"}]
  Mood: morning-stress → afternoon-relief
  Food: Italian lunch
  Decisions: None significant
        ↓
WRITE:
  - people/sarah.md: Add "2026-03-13: Italian lunch"
  - diary/2026/03/13.md: Full day summary
  - core.md: Update "lastConsolidated", clear daily buffer
  - this-week.md: Add day summary
        ↓
ARCHIVE raw chats to cold storage
        ↓
Log: consolidation-complete, facts-extracted: 5
```

---

## Pi SDK Foundation

Like pibot, Fabiana runs **pi sessions** for all intelligence work:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Scheduler  │────▶│  pi Session  │────▶│   Memory    │
│  /Trigger   │     │  (Agent)     │     │   Update    │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌─────────┐   ┌──────────┐
              │ Telegram│   │  Tools   │
              │  Send   │   │ brave,   │
              │         │   │ calendar │
              └─────────┘   └──────────┘
```

### Why Pi Sessions?
- **Structured tools**: Brave Search, file operations, bash commands
- **Cost control**: Session-based billing, easy to budget
- **Safety**: Permission system, read-only vs writable files
- **Skills**: Reusable patterns (like the memory system we built)

### Session Types

1. **Chat Session**: Triggered by Telegram message
2. **Scheduled Session**: Cron-initiated (midnight, check-ins)
3. **Initiative Session**: Agent decides to start conversation

Each session loads relevant memory (hot + contextual warm) and has access to tools.

---

## Tools & Capabilities

### 1. Brave Search (Web & News)

**Purpose**: Make Fabiana feel "informed" and human

**Use Cases**:
```
- User mentions "did you see the news?" → Search news
- Need context: "What's the capital of..." → Search web
- Conversation starter: "Latest in blockchain since you care about that"
- Verify facts: "Is that restaurant still open?"
```

**Implementation**:
```typescript
interface SearchTool {
  name: 'brave_search';
  parameters: {
    query: string;
    type: 'web' | 'news';
    count?: number;
  };
}

// In agent prompt:
"You can search the web for information you don't know.
 You can also search news for conversation starters related to user's interests."
```

### 2. Google Calendar (gccli skill)

**Purpose**: Know upcoming events, prep for meetings, schedule reminders

**Use Cases**:
```
- Morning brief: "You have 3 meetings today"
- Meeting prep: "Meeting with Sarah in 30 min—what's it about?"
- Recording context: "You said it's about Q2 budget"
- Smart reminders: "Don't forget to bring the report"
```

**Implementation**:
```typescript
interface CalendarTools {
  listEvents: (days: number) => Promise<Event[]>;
  getEvent: (id: string) => Promise<Event>;
}

// Agent workflow:
// 1. Check calendar for next 24h
// 2. For each meeting, ask: "What's this about?"
// 3. Record context in memory/people/ or memory/dates/
// 4. Add to agent-todo: "Remind about meeting X at time Y"
```

**Meeting Context Recording**:
```
Agent: "I see you have 'Sync with Sarah' at 2pm. What's this meeting about?"

You: "Q2 budget review"

[Agent writes to memory/people/sarah.md: "2026-03-14: Q2 budget review meeting"]
[Agent writes to agent-todo/: "Remind about Q2 budget docs before 2pm meeting"]
```

---

## Telegram Integration (Polling)

Since running locally (not on VM with webhook), we use **long polling**:

```typescript
class TelegramPoller {
  private bot: Telegraf;
  private messageQueue: Message[];
  
  start() {
    // Method 1: Polling (for local dev)
    this.bot.launch({
      polling: {
        interval: 3000,  // Check every 3 seconds
        timeout: 30      // Long-polling timeout
      }
    });
    
    // On message, queue for pi session processing
    this.bot.on('text', (ctx) => {
      this.messageQueue.push({
        text: ctx.message.text,
        from: ctx.from.id,
        timestamp: new Date(),
        chatId: ctx.chat.id
      });
    });
  }
  
  // Daemon periodically checks queue and spawns pi sessions
  async processQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      await this.spawnPiSession(msg);
    }
  }
}
```

**Why Polling?**
- Works behind NAT/firewall (no public IP needed)
- Perfect for local development
- Can run on laptop, home server, Raspberry Pi
- Lower latency than webhook for small scale

**Alternative: Webhook (Future)**
If deployed to VPS/cloud later, switch to webhook for efficiency.

---

## Agent TODO List

Fabiana maintains her **own** task list—things she needs to do for you:

```
agent-todo/
├── pending/
│   ├── ask-about-meeting-001.md
│   ├── remind-birthday-sarah.md
│   └── check-in-mood-evening.md
├── scheduled/
│   └── 2026-03-14/
│       └── 14-00-remind-meeting.md
└── completed/
    └── 2026-03-13/
        └── ask-about-lunch.md
```

### TODO Types

1. **Ask Questions**: "What was the meeting about?"
2. **Send Reminders**: "Meeting in 30 min"
3. **Check-ins**: "How are you feeling now?"
4. **Follow-ups**: "Did you finish that task?"
5. **Research**: "Search for news about blockchain"

### Example TODO Lifecycle

```
[Morning - Calendar Check]
Agent sees: Meeting "Sync with Team" at 3pm
→ Creates: agent-todo/pending/ask-meeting-context-001.md

[1:30 PM - Initiative Session]
Agent reads TODO list
→ Sees: "Ask about meeting context"
→ Sends: "You have a team sync at 3. What's on the agenda?"

[You reply]: "Q2 planning"
→ Agent updates: memory/dates/upcoming.md
→ Agent marks TODO complete
→ Agent creates new TODO: "Remind about Q2 docs at 2:45pm"

[2:45 PM - Scheduled]
Agent reads TODO
→ Sends: "Meeting in 15! Got your Q2 docs ready?"
→ Marks complete
```

### TODO Format

```markdown
<!-- agent-todo/pending/ask-about-meeting-001.md -->
# Ask About Meeting Context

## Trigger
Meeting "Sync with Team" detected in calendar at 15:00

## Action
Ask user: "What's the 'Sync with Team' meeting about?"

## Record Answer To
- memory/dates/upcoming.md
- memory/people/team.md (if relevant)

## Priority
medium

## Due
2026-03-14 14:00 (1 hour before meeting)
```

---

## Enhanced Initiative Engine (with Web & Calendar)

### New Triggers

| Trigger | Source | Action |
|---------|--------|--------|
| Morning (9am) | Schedule | Check calendar → Send brief → Create TODOs for meetings |
| Pre-meeting (30min) | TODO list | Remind + ask if prepared |
| News matching interests | Brave Search | "Saw this about blockchain, thought of you" |
| Birthday in 3 days | Calendar + memory | Plan celebration, ask about gift ideas |
| 4h no contact | Time + last msg | Mood check-in |
| User mentioned stress | Pattern detection | Follow-up TODO in 2 hours |

### Conversation Starter with News

```
[Agent checks interests: "blockchain", "AI", "Elixir"]
[Agent searches: "blockchain news today"]

Agent: "Yo, saw Ethereum just had that major upgrade. 
       Still following the space closely or you over it?"

You: "Yeah still into it, that's big news"

[Agent records: interests/topics.md - "still active in blockchain"]
```

---

## Data Flow: Full Example

```
[8:55 AM - Scheduled Session Starts]
        ↓
Load Memory: identity + core + recent + dates/birthdays
        ↓
Check Calendar (gccli): 
  → 10:00 "Standup"
  → 14:00 "Client Call - Acme Corp"
        ↓
Agent thinks:
  → Create TODO: "Ask about Acme context before 2pm"
  → Check if news relevant to interests
        ↓
Search News: "Elixir programming latest"
        ↓
Send Telegram:
  "Morning! 3 things today: standup, big client call at 2.
   Also—Elixir 1.18 dropped, figured you'd want to know 🔥"
        ↓
Log: morning-brief-sent, todos-created: 1

[1:30 PM - TODO Triggered]
        ↓
Read TODO: "Ask about Acme context"
        ↓
Send: "Acme call in 30! What's this one about? 
       Need me to remind you of anything?"
        ↓
You: "New project proposal, need to mention the timeline concern"
        ↓
WRITE:
  - memory/people/acme-rep.md: "Timeline concerns 2026-03"
  - core.md: "Active: Acme proposal, timeline risk"
  - agent-todo/completed/ask-acme-context.md
  - agent-todo/scheduled/14-00-remind-timeline.md
        ↓
Send: "Got it, noted. Want me to ping you at 1:55 
       to mention the timeline thing?"

[1:55 PM - Reminder Sent]
        ↓
"🔔 Don't forget to bring up the timeline concern!"
```

---

## MVP Priorities

### Phase 1: Foundation (Week 1)
- [ ] Pi SDK setup with custom tools (read, edit, brave-search)
- [ ] Memory system (human-context skill structure)
- [ ] Telegram bot (polling) scaffold
- [ ] Basic chat → pi session → memory write loop
- [ ] Manual midnight consolidation

### Phase 2: Calendar & TODO (Week 2)
- [ ] Google Calendar integration (gccli skill)
- [ ] Morning brief with calendar check
- [ ] Agent TODO system (ask questions, reminders)
- [ ] Meeting prep flow (ask context, record answers)

### Phase 3: Initiative & Web (Week 3)
- [ ] Scheduled daemon (cron)
- [ ] Initiative engine (decide when to message)
- [ ] Brave Search integration (web + news)
- [ ] News-based conversation starters
- [ ] Mood/meal/work check-ins

### Phase 4: Intelligence (Week 4)
- [ ] Pattern detection (stress patterns, routines)
- [ ] Automatic TODO creation from calendar
- [ ] Smart reminders (context-aware)
- [ ] Search cold memory when needed

### Phase 5: Polish (Week 5+)
- [ ] Voice/personality tuning
- [ ] TUI for memory browsing
- [ ] Safety controls & kill switches
- [ ] Cost tracking & budget limits

---

## Configuration

### `config/personality.json`
```json
{
  "name": "Fabiana",
  "voice": {
    "tone": "friendly",
    "banter": true,
    "formality": "casual"
  },
  "initiative": {
    "enabled": true,
    "minHoursBetween": 4,
    "activeHours": [9, 22],
    "checkInTypes": ["mood", "meal", "work", "social"],
    "newsSearch": true,
    "newsInterests": ["blockchain", "Elixir", "AI"]
  },
  "memory": {
    "consolidateAt": "00:00",
    "morningBrief": true,
    "morningBriefTime": "09:00"
  },
  "calendar": {
    "enabled": true,
    "checkAheadHours": 24,
    "askContextBeforeMeeting": true,
    "defaultReminderMinutes": 30
  }
}
```

### `config/telegram.json`
```json
{
  "botToken": "${TELEGRAM_BOT_TOKEN}",
  "allowedChatIds": [123456789],
  "polling": {
    "enabled": true,
    "interval": 3000,
    "timeout": 30
  }
}
```

---

## Open Questions

1. **Privacy**: All local storage or encrypted cloud backup?
2. **Multi-device**: Sync memory across phone/computer?
3. **Voice**: Text-only or voice messages too?
4. **Family mode**: Multiple users, shared memory boundaries?
5. **Cost**: OpenRouter API costs - set daily/monthly limits?
6. **Calendar scope**: Which calendars to read? Work + personal?
7. **News frequency**: How often to search? Daily? Per interest?
8. **Daemon hosting**: Always-on machine vs wake-on-demand?

---

## File Structure (Updated)

```
fabiana/
├── src/
│   ├── daemon/
│   │   ├── index.ts           # Main entry, scheduler
│   │   ├── telegram-poller.ts # Telegram polling
│   │   └── session-runner.ts  # Pi session orchestrator
│   │
│   ├── pi-session/
│   │   ├── prompts/
│   │   │   ├── chat.ts        # Reply to messages
│   │   │   ├── initiative.ts  # Start conversations
│   │   │   ├── consolidate.ts # Midnight processing
│   │   │   └── meeting-prep.ts # Calendar context gathering
│   │   └── tools/
│   │       ├── memory.ts      # Read/write memory files
│   │       ├── calendar.ts    # gccli integration
│   │       ├── todo.ts        # Agent TODO management
│   │       └── telegram.ts    # Send messages
│   │
│   └── config/
│       ├── index.ts
│       └── schema.ts
│
├── memory/                    # Human-context skill
│   ├── identity.md
│   ├── core.md
│   ├── constitution.md
│   ├── people/
│   ├── dates/
│   ├── diary/
│   └── archive/
│
├── agent-todo/                # Agent's task list
│   ├── pending/
│   ├── scheduled/
│   └── completed/
│
├── logs/                      # Activity logs
│   └── sessions/
│
├── config/
│   ├── personality.json
│   ├── telegram.json
│   └── schedule.json
│
├── package.json
└── README.md
```

---

*This is Fabiana. Not just a chatbot—a presence.*