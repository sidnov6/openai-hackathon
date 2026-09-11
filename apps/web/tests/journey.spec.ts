import { expect, test, type Page } from '@playwright/test'

/**
 * On a phone the map fills the screen and results live behind a Map/List toggle, so the
 * results list is only rendered once List is chosen. Desktop shows the rail always.
 */
async function searchFromCampus(page: Page, campus: RegExp) {
  await page.getByRole('radio', { name: campus }).click({ force: true })
  await page.getByRole('button', { name: /search from this campus/i }).click()
  const listToggle = page.getByRole('radio', { name: /^List/i })
  if (await listToggle.isVisible().catch(() => false)) {
    await listToggle.click({ force: true })
  }
  await expect(page.getByRole('listbox', { name: /housing results/i })).toBeVisible({ timeout: 20_000 })
}

/**
 * The principal browser journey, plus the truthfulness checks that matter most:
 * sample data must never read as live, and a residence must never read as a free room.
 */

test('the opening screen is Frankfurt with a location card, and never asks for geolocation on load', async ({ page }) => {
  let geolocationAsked = false
  await page.addInitScript(() => {
    const original = navigator.geolocation?.getCurrentPosition
    if (original) {
      // @ts-expect-error test shim
      navigator.geolocation.getCurrentPosition = (...args) => {
        ;(window as never as { __geo: boolean }).__geo = true
        return original.apply(navigator.geolocation, args)
      }
    }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /where should we look from/i })).toBeVisible()
  await expect(page.getByTestId('map-canvas')).toBeVisible()
  // With no Google key the keyless MapLibre basemap is used, and it must actually load.
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-kind', 'maplibre')
  await expect(page.getByTestId('maplibre-container')).toBeVisible()
  geolocationAsked = await page.evaluate(() => Boolean((window as never as { __geo?: boolean }).__geo))
  expect(geolocationAsked).toBe(false)
})

test('sample data is labelled and never presented as live', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Sample data', { exact: false }).first()).toBeVisible()
  await expect(page.getByText(/was retrieved from a real housing provider/i)).toBeVisible()
})

test('declining geolocation still allows a campus origin and a search', async ({ page }) => {
  await page.goto('/')
  await searchFromCampus(page, /campus westend/i)

  // Literal counts: residences and offers are counted separately.
  await expect(page.getByText(/found;.*source-reported/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/saved discovery/i)).toBeVisible()
})

test('the full demo journey reaches cited lease findings and a legal flag', async ({ page }) => {
  await page.goto('/')
  await searchFromCampus(page, /campus bockenheim/i)

  // Only a listing bound to a ready demo slot offers the sample lease.
  // Bockenheim is the one sample record whose demo slot has an imported document.
  await page.getByRole('option').filter({ hasText: /Bockenheim student residence/i }).first().click()
  await expect(page.getByText(/paired with a fictional lease/i).first()).toBeVisible()

  await page.getByRole('button', { name: /open sample lease demo/i }).click()
  await expect(page.getByText(/you are entering a demonstration/i)).toBeVisible()
  await page.getByRole('button', { name: /continue to the demo/i }).click()

  // Simulated acceptance is explicit and cannot be mistaken for a provider response.
  await expect(page.getByText(/simulated acceptance — no real provider responded/i)).toBeVisible({ timeout: 20_000 })

  const workspaceTabs = page.getByRole('tablist', { name: /tenancy workspace sections/i })
  await workspaceTabs.getByRole('tab', { name: 'Lease & rules', exact: true }).click()
  await expect(page.getByText(/Der Mieter leistet eine Sicherheit/i).first()).toBeVisible({ timeout: 25_000 })

  // An absent clause says so rather than being filled in from a typical tenancy.
  await expect(page.getByText(/not specified in the supplied document/i).first()).toBeVisible()

  await workspaceTabs.getByRole('tab', { name: 'Legal review', exact: true }).click()
  await expect(page.getByText(/BGB §551 generally caps it at three/i)).toBeVisible()
  await expect(page.getByText(/where the agents disagreed/i)).toBeVisible()
})

test('move-in shows no invented deadline until a date is confirmed', async ({ page }) => {
  await page.goto('/')
  await searchFromCampus(page, /campus bockenheim/i)
  await page.getByRole('option').filter({ hasText: /Bockenheim student residence/i }).first().click({ timeout: 15_000 })
  await page.getByRole('button', { name: /open sample lease demo/i }).click()
  await page.getByRole('button', { name: /continue to the demo/i }).click()
  await expect(page.getByText(/simulated acceptance/i)).toBeVisible({ timeout: 20_000 })

  await page
    .getByRole('tablist', { name: /tenancy workspace sections/i })
    .getByRole('tab', { name: 'Move-in', exact: true })
    .click()
  await expect(page.getByText(/no date yet/i).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/does not state a calendar start date/i).first()).toBeVisible()
})

test('keyboard-only: the results list is reachable and navigable', async ({ page }) => {
  await page.goto('/')
  await searchFromCampus(page, /campus westend/i)
  const list = page.getByRole('listbox', { name: /housing results/i })
  await list.focus()
  await page.keyboard.press('ArrowDown')
  await expect(list.getByRole('option', { selected: true })).toBeVisible()
})

test('the map credits its tile source visibly, not behind an icon', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('maplibre-container')).toBeVisible()
  // Required attribution must be readable at this viewport without opening anything.
  const attribution = page.locator('.maplibregl-ctrl-attrib')
  await expect(attribution).toBeVisible({ timeout: 20_000 })
  await expect(attribution).toContainText(/OpenStreetMap/i)
})

test('address search works with no API key and credits OpenStreetMap', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: /^Address$/i }).click({ force: true })
  await page.getByLabel(/address or district/i).fill('Bockenheimer Landstrasse')
  await expect(page.getByText(/Address search . OpenStreetMap contributors/i)).toBeVisible({ timeout: 20_000 })
})

test('a reserved slot with no document does not claim a lease is available', async ({ page }) => {
  await page.goto('/')
  await searchFromCampus(page, /campus westend/i)

  // No card may promise an available sample lease - only the details panel can say so.
  await expect(page.getByText(/sample lease available/i)).toHaveCount(0)

  // Westend-Sud's slot is reserved but has no imported document.
  await page.getByRole('option').filter({ hasText: /Westend-S/i }).first().click()
  await expect(page.getByText(/awaiting policy document/i)).toBeVisible()
})
