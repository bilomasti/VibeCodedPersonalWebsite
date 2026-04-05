import { config } from 'dotenv'
import fetch from 'node-fetch'
import https from 'https'
import http from 'http'
config()

const httpsAgent = new https.Agent({ rejectUnauthorized: false })
const httpAgent = new http.Agent()

function getAgent(url) {
  return url.startsWith('https') ? httpsAgent : httpAgent
}

const WIKI_URL = process.env.WIKI_URL || 'http://157.90.191.202:3000'
const USERNAME = process.env.WIKI_ADMIN_USER || 'bilomasti'
const PASSWORD = process.env.WIKI_ADMIN_PASSWORD

async function graphql(cookies, query, variables = {}) {
  const res = await fetch(`${WIKI_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cookies}`
    },
    body: JSON.stringify({ query, variables }),
    agent: getAgent(WIKI_URL)
  })
  return res.json()
}

async function login() {
  const res = await fetch(`${WIKI_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation ($username: String!, $password: String!) {
        authentication {
          login(username: $username, password: $password, strategy: "local") {
            responseResult { succeeded message }
            jwt
          }
        }
      }`,
      variables: { username: USERNAME, password: PASSWORD }
    }),
    agent: getAgent(WIKI_URL)
  })
  const data = await res.json()
  const result = data?.data?.authentication?.login
  if (!result?.responseResult?.succeeded) {
    throw new Error(`Login failed: ${result?.responseResult?.message}`)
  }
  console.log('Logged in successfully')
  return result.jwt
}

async function createPage(token, { title, content, path, description }) {
  const data = await graphql(token, `
    mutation ($content: String!, $description: String!, $editor: String!, $isPublished: Boolean!, $isPrivate: Boolean!, $locale: String!, $path: String!, $tags: [String]!, $title: String!) {
      pages {
        create(content: $content, description: $description, editor: $editor, isPublished: $isPublished, isPrivate: $isPrivate, locale: $locale, path: $path, tags: $tags, title: $title) {
          responseResult { succeeded message }
          page { id }
        }
      }
    }
  `, {
    content,
    description,
    editor: 'markdown',
    isPublished: true,
    isPrivate: false,
    locale: 'en',
    path,
    tags: [],
    title
  })
  const result = data?.data?.pages?.create?.responseResult
  if (result?.succeeded) {
    console.log(`✓ Created: ${title}`)
  } else if (result?.message?.includes('already exists')) {
    // Update existing page
    const pageId = await getPageId(token, path)
    if (pageId) await updatePage(token, pageId, { title, content, description })
  } else {
    console.log(`✗ Skipped: ${title} (${result?.message || JSON.stringify(data?.errors || data)})`)
  }
}

async function getPageId(token, path) {
  const data = await graphql(token, `
    query ($path: String!, $locale: String!) {
      pages { singleByPath(path: $path, locale: $locale) { id } }
    }
  `, { path, locale: 'en' })
  return data?.data?.pages?.singleByPath?.id
}

async function updatePage(token, id, { title, content, description }) {
  const data = await graphql(token, `
    mutation ($id: Int!, $content: String!, $description: String!, $editor: String!, $isPublished: Boolean!, $isPrivate: Boolean!, $locale: String!, $tags: [String]!, $title: String!) {
      pages {
        update(id: $id, content: $content, description: $description, editor: $editor, isPublished: $isPublished, isPrivate: $isPrivate, locale: $locale, tags: $tags, title: $title) {
          responseResult { succeeded message }
        }
      }
    }
  `, {
    id,
    content,
    description,
    editor: 'markdown',
    isPublished: true,
    isPrivate: false,
    locale: 'en',
    tags: [],
    title
  })
  const result = data?.data?.pages?.update?.responseResult
  if (result?.succeeded) {
    console.log(`✓ Updated: ${title}`)
  } else {
    console.log(`✗ Failed to update: ${title} (${result?.message})`)
  }
}

const pages = [
  {
    title: 'Home',
    path: 'home',
    description: 'Welcome to the Bukhari Family Wiki',
    content: `# Bukhari Family Wiki

Welcome to the Bukhari Family Wiki — a private space for our family to document our history, share memories, and stay connected across generations and borders.

---

## How to use this wiki

- **Browse** pages using the sidebar navigation
- **Edit** any page by clicking the edit button (logged-in members only)
- **Create** new pages for people, events, or stories
- **Upload** photos and documents to the Media Library

---

## Sections

| Section | Purpose |
|---|---|
| [Family Tree](/en/family-tree) | Family members, ancestors, and relationships |
| [Branches](/en/branches) | Geographic branches of the family |
| [History](/en/history) | Family origins and historical background |
| [Events](/en/events) | Weddings, reunions, births, and milestones |
| [Stories & Memories](/en/stories) | Personal stories and memories |
| [Photos](/en/photos) | Photo albums and captions |
| [Recipes](/en/recipes) | Traditional family recipes |
| [Traditions](/en/traditions) | Cultural and family traditions |
| [Contact Directory](/en/contacts) | Family contact information |

---

*This wiki is private and only accessible to family members. To get access, contact the admin.*`
  },
  {
    title: 'Family Tree',
    path: 'family-tree',
    description: 'Bukhari family tree and relationships',
    content: `# Family Tree

This section documents family members across generations.

---

## How to add a family member

Create a new page under the **People** section with the format:
\`people/firstname-lastname\`

Include the following information:
- Full name and any nicknames
- Date and place of birth
- Parents, siblings, spouse(s), children
- Brief biography
- Photo (upload to media library)

---

## Generations

### Elders & Ancestors
*Add the earliest known ancestors here. Include what is known about their origin, life, and legacy.*

### Parents Generation
*Add parents and their siblings here.*

### Current Generation
*Add living family members here.*

### Children & Grandchildren
*Add the youngest generation here.*

---

## Adding relationships

When creating a person's page, link to their relatives using wiki links:
\`[[people/firstname-lastname | Full Name]]\`

This keeps everyone connected across pages.`
  },
  {
    title: 'Family Branches',
    path: 'branches',
    description: 'Geographic branches of the Bukhari family',
    content: `# Family Branches

The Bukhari family is spread across many cities and countries. This page outlines the known branches.

---

## How to document a branch

Create a page under \`branches/city-or-country\` with:
- Which family members live there
- When the branch was established (when did the family move there)
- Any notable local history or context

---

## Known Branches

*Add branches below as family members contribute. Each branch should link to the family members who belong to it.*

### Pakistan
*(Add cities and family members)*

### International
*(Add countries and family members)*

---

*If your branch is missing, create a new page and add it here!*`
  },
  {
    title: 'Family History',
    path: 'history',
    description: 'Origins and historical background of the Bukhari family',
    content: `# Family History

This page documents the origins, heritage, and historical background of the Bukhari family.

---

## Origins

*The Bukhari family name derives from Bukhara, a historic city in present-day Uzbekistan, known as a major center of Islamic scholarship. Many families with this name trace their ancestry to scholars or descendants of those who migrated from that region.*

*Add what is known about your specific family's origins here.*

---

## Heritage

- **Cultural background:** *(Add details)*
- **Religious tradition:** *(Add details)*
- **Languages:** *(Add details)*

---

## Notable Ancestors

*Add notable ancestors, scholars, or historical figures in the family lineage.*

---

## Migration History

*Document when and why different branches of the family moved to different places.*

---

*This page should be built collaboratively. If you know something about family history, please add it or contact the admin.*`
  },
  {
    title: 'Events',
    path: 'events',
    description: 'Family events, weddings, reunions and milestones',
    content: `# Events

A record of important family events across generations.

---

## How to add an event

Create a new page under \`events/year-event-name\` with:
- Date and location
- Who was involved
- Photos (upload to media library)
- A description or story about the event

---

## Upcoming Events

*Add upcoming family gatherings, weddings, or reunions here.*

---

## Past Events

### Weddings
*Add wedding entries here.*

### Reunions & Gatherings
*Add family reunions and gatherings here.*

### Births
*Add notable births here.*

### Other Milestones
*Add graduations, achievements, and other milestones here.*`
  },
  {
    title: 'Stories & Memories',
    path: 'stories',
    description: 'Family stories, memories and anecdotes',
    content: `# Stories & Memories

Family stories passed down through generations — funny, emotional, historical, or everyday.

---

## How to contribute a story

Create a new page under \`stories/story-title\` and write freely. Include:
- Who the story is about
- When it happened (approximate is fine)
- The story itself
- Any photos if available

---

## Why document stories?

Stories are the most fragile part of family history. Elders carry memories that disappear when they are gone. Writing them down — even imperfectly — preserves them for future generations.

---

## Stories

*Add your family stories here. No story is too small.*

---

*Encourage elders in the family to share their memories. You can write on their behalf.*`
  },
  {
    title: 'Photos',
    path: 'photos',
    description: 'Family photo albums',
    content: `# Photos

Family photos organized by era and event.

---

## How to add photos

1. Upload photos using the **Media Library** (camera icon in editor toolbar)
2. Create or edit a page in this section to display them
3. Add captions describing who is in the photo, when and where it was taken

---

## Albums

### Old & Vintage Photos
*Scanned old photos — label everyone you can identify.*

### Family Events
*Photos from weddings, reunions, gatherings.*

### Everyday Life
*Regular family photos across the years.*

---

## Tips for labeling photos

When adding a photo caption, try to include:
- Names of everyone visible
- Year or approximate year
- Location
- Occasion (if any)

*A photo without context loses its meaning over time.*`
  },
  {
    title: 'Recipes',
    path: 'recipes',
    description: 'Traditional Bukhari family recipes',
    content: `# Recipes

Traditional family recipes — dishes that have been made for generations.

---

## How to add a recipe

Create a new page under \`recipes/recipe-name\` with:
- Ingredients (with quantities)
- Steps
- Who taught you this recipe
- Any tips or variations
- Photo of the dish

---

## Categories

### Main Dishes
*Add main course recipes.*

### Rice & Pulao
*Add rice dishes.*

### Breads & Rotis
*Add bread recipes.*

### Desserts & Sweets
*Add dessert recipes.*

### Drinks & Sherbets
*Add drinks and beverages.*

### Pickles & Chutneys
*Add condiment recipes.*

---

*Every family recipe is worth documenting. Even simple everyday dishes tell a story.*`
  },
  {
    title: 'Traditions',
    path: 'traditions',
    description: 'Family and cultural traditions',
    content: `# Traditions

Cultural and family traditions that define the Bukhari family.

---

## Categories

### Religious Traditions
*Document religious practices, prayers, and observances that are part of family life.*

### Wedding Traditions
*Document wedding customs, rituals, and what makes a Bukhari family wedding unique.*

### Eid & Festivals
*How the family celebrates Eid, and any special traditions around it.*

### Food Traditions
*Special dishes made only on certain occasions — link to the Recipes section.*

### Family Customs
*Everyday customs and habits that are distinctly "our family".*

---

*Traditions are what make a family unique. Document them before they fade.*`
  },
  {
    title: 'Contact Directory',
    path: 'contacts',
    description: 'Family contact information',
    content: `# Contact Directory

Family contact information. **This page is private — do not share the link externally.**

---

## How to add your contact

Edit this page and add a row to the table below. Only include what you are comfortable sharing with the family.

---

## Directory

| Name | Location | Phone | Email | Notes |
|---|---|---|---|---|
| *(Your name)* | *(City, Country)* | *(optional)* | *(optional)* | *(optional)* |

---

*This directory is only visible to logged-in family members.*`
  }
]

async function main() {
  const token = await login()

  for (const page of pages) {
    await createPage(token, page)
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log('\nDone!')
}

main().catch(console.error)
