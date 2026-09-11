import { expect, test } from '@playwright/test'

/**
 * A failing map must never take the application down with it.
 *
 * MapLibre throws when it cannot get a WebGL context. React unmounts the whole tree on an
 * uncaught render error, so without the guard in MapCanvas this browser would see a blank
 * page rather than a working app with a degraded map.
 */
test('with WebGL unavailable the app still works and says why the map is missing', async ({ page }) => {
  await page.goto('/')

  // The app rendered at all - this is the regression that matters.
  await expect(page.getByRole('heading', { name: /where should we look from/i })).toBeVisible()
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-kind', 'schematic')
  await expect(page.getByText(/this is not a map/i)).toBeVisible()

  // And the journey is unaffected.
  await page.getByRole('radio', { name: /campus westend/i }).click({ force: true })
  await page.getByRole('button', { name: /search from this campus/i }).click()
  await expect(page.getByRole('listbox', { name: /housing results/i })).toBeVisible({ timeout: 15_000 })
})
