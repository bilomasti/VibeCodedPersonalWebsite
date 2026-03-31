import { config } from 'dotenv'
import fetch from 'node-fetch'
import https from 'https'
config()

const agent = new https.Agent({ rejectUnauthorized: false })

const WIKI_URL = 'https://wiki.bilomasti.pk/api.php'
const USERNAME = 'bilomasti'
const PASSWORD = process.env.WIKI_PASSWORD

async function login() {
  // Step 1: Get login token
  const tokenRes = await fetch(`${WIKI_URL}?action=query&meta=tokens&type=login&format=json`, {
    method: 'GET',
    headers: { 'Cookie': '' },
    agent
  })
  const tokenData = await tokenRes.json()
  const loginToken = tokenData.query.tokens.logintoken
  const cookies = tokenRes.headers.get('set-cookie')

  // Step 2: Login
  const loginRes = await fetch(`${WIKI_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies
    },
    body: new URLSearchParams({
      action: 'login',
      lgname: USERNAME,
      lgpassword: PASSWORD,
      lgtoken: loginToken,
      format: 'json'
    }),
    agent
  })
  const loginData = await loginRes.json()
  const sessionCookies = loginRes.headers.get('set-cookie')

  if (loginData.login.result !== 'Success') {
    throw new Error(`Login failed: ${loginData.login.reason}`)
  }

  console.log('Logged in successfully')
  return sessionCookies + '; ' + cookies
}

async function getCsrfToken(cookies) {
  const res = await fetch(`${WIKI_URL}?action=query&meta=tokens&format=json`, {
    headers: { 'Cookie': cookies },
    agent
  })
  const data = await res.json()
  return data.query.tokens.csrftoken
}

async function createPage(cookies, csrfToken, title, content) {
  const res = await fetch(`${WIKI_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies
    },
    body: new URLSearchParams({
      action: 'edit',
      title,
      text: content,
      token: csrfToken,
      format: 'json',
      createonly: 'true'
    }),
    agent
  })
  const data = await res.json()
  if (data.edit?.result === 'Success') {
    console.log(`✓ Created: ${title}`)
  } else {
    console.log(`✗ Skipped: ${title} (${data.error?.code || 'already exists'})`)
  }
}

// Pages to create
const pages = [
  {
    title: 'Main Page',
    content: `== Welcome to the Bilomasti Family Wiki ==

This is a private wiki for the Bilomasti family. Here you can find family history, stories, recipes, and more.

== Sections ==
* [[Family Tree]] — Family members and relationships
* [[Events]] — Weddings, reunions, and milestones
* [[Stories & Memories]] — Family stories and memories
* [[Recipes]] — Traditional family recipes
* [[Traditions]] — Family traditions and customs
* [[Contact Directory]] — Family contact information`
  },
  {
    title: 'Family Tree',
    content: `== Family Tree ==

This section contains information about family members and their relationships.

=== How to add a person ===
Create a new page using the format: [[Person:Firstname Lastname]]

=== Family Members ===
''Add family members here.''`
  },
  {
    title: 'Events',
    content: `== Events ==

A record of important family events.

=== Weddings ===
''Add weddings here.''

=== Reunions ===
''Add reunions here.''

=== Milestones ===
''Add milestones here.''`
  },
  {
    title: 'Stories & Memories',
    content: `== Stories & Memories ==

Family stories, memories, and anecdotes passed down through generations.

''Add your stories here.''`
  },
  {
    title: 'Recipes',
    content: `== Recipes ==

Traditional family recipes.

=== How to add a recipe ===
Create a new page using the format: [[Recipe:Recipe Name]]

''Add recipes here.''`
  },
  {
    title: 'Traditions',
    content: `== Traditions ==

Family traditions, customs, and cultural practices.

''Add traditions here.''`
  },
  {
    title: 'Contact Directory',
    content: `== Contact Directory ==

Family contact information. This page is only visible to logged-in members.

{| class="wikitable"
|-
! Name !! Phone !! Email !! Location
|-
| ''Name'' || ''Phone'' || ''Email'' || ''Location''
|}`
  }
]

async function main() {
  const cookies = await login()
  const csrfToken = await getCsrfToken(cookies)

  for (const page of pages) {
    await createPage(cookies, csrfToken, page.title, page.content)
    await new Promise(r => setTimeout(r, 5000))
  }

  console.log('\nDone!')
}

main().catch(console.error)
